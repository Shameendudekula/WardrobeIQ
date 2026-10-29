// Anthropic (Claude) provider using the official SDK and structured outputs (output_config.format)
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { aiErrors, AIError, parseModelJSON } from "./errors.js";

// Models that support the server-side refusal fallback ("default" routing picks the fallback model)
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

function mapError(err) {
  if (err instanceof AIError) return err;
  // Most specific first; APIConnectionTimeoutError extends APIConnectionError, which extends APIError
  if (err instanceof Anthropic.APIConnectionTimeoutError) return aiErrors.timeout(err);
  if (err instanceof Anthropic.RateLimitError) {
    return aiErrors.rateLimited(Number(err.headers?.get?.("retry-after")) || undefined, err);
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return aiErrors.authFailed(err);
  if (err instanceof Anthropic.APIConnectionError) return aiErrors.unavailable(err);
  if (err instanceof Anthropic.InternalServerError) return aiErrors.unavailable(err);
  if (err instanceof Anthropic.APIError) return aiErrors.badOutput(`provider error ${err.status}`, err);
  return aiErrors.unavailable(err);
}

export function createAnthropicProvider({ apiKey, model, timeoutMs, maxRetries, effort, refusalFallback, baseURL }) {
  // The SDK retries 408/409/429/5xx and connection errors with backoff, up to maxRetries
  const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries, ...(baseURL && { baseURL }) });
  const useFallback = refusalFallback && FALLBACK_MODELS.has(model);

  return {
    name: "anthropic",
    model,
    async generateJSON({ system, prompt, schema, images = [], maxTokens = 16000 }) {
      const content = [
        ...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } })),
        { type: "text", text: prompt },
      ];
      const params = {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content }],
        output_config: { format: zodOutputFormat(schema), ...(effort && { effort }) },
      };

      let res;
      try {
        res = useFallback
          ? await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
          : await client.messages.create(params);
      } catch (err) {
        throw mapError(err);
      }

      if (res.stop_reason === "refusal") throw aiErrors.refused();
      if (res.stop_reason === "max_tokens") throw aiErrors.badOutput("response was cut off");
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      return {
        data: parseModelJSON(text),
        model: res.model,
        usage: { inputTokens: res.usage?.input_tokens ?? null, outputTokens: res.usage?.output_tokens ?? null },
      };
    },
  };
}
