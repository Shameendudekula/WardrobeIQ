// OpenAI-compatible provider (OpenAI, or any server exposing the Chat Completions API via AI_BASE_URL)
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { aiErrors, AIError, parseModelJSON } from "./errors.js";

function mapError(err) {
  if (err instanceof AIError) return err;
  if (err instanceof OpenAI.APIConnectionTimeoutError) return aiErrors.timeout(err);
  if (err instanceof OpenAI.RateLimitError) {
    return aiErrors.rateLimited(Number(err.headers?.get?.("retry-after")) || undefined, err);
  }
  if (err instanceof OpenAI.AuthenticationError || err instanceof OpenAI.PermissionDeniedError) return aiErrors.authFailed(err);
  if (err instanceof OpenAI.APIConnectionError) return aiErrors.unavailable(err);
  if (err instanceof OpenAI.InternalServerError) return aiErrors.unavailable(err);
  if (err instanceof OpenAI.APIError) return aiErrors.badOutput(`provider error ${err.status}`, err);
  return aiErrors.unavailable(err);
}

export function createOpenAIProvider({ apiKey, model, baseURL, timeoutMs, maxRetries }) {
  const client = new OpenAI({ apiKey, baseURL: baseURL || undefined, timeout: timeoutMs, maxRetries });

  return {
    name: "openai",
    model,
    async generateJSON({ system, prompt, schema, images = [], maxTokens = 16000 }) {
      const userContent = images.length
        ? [
            ...images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.base64}` } })),
            { type: "text", text: prompt },
          ]
        : prompt;

      let res;
      try {
        res = await client.chat.completions.create({
          model,
          max_completion_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userContent },
          ],
          response_format: zodResponseFormat(schema, "wardrobeiq_response"),
        });
      } catch (err) {
        throw mapError(err);
      }

      const choice = res.choices?.[0];
      if (!choice) throw aiErrors.badOutput("no choices returned");
      if (choice.message?.refusal) throw aiErrors.refused();
      if (choice.finish_reason === "length") throw aiErrors.badOutput("response was cut off");
      return {
        data: parseModelJSON(choice.message?.content),
        model: res.model,
        usage: { inputTokens: res.usage?.prompt_tokens ?? null, outputTokens: res.usage?.completion_tokens ?? null },
      };
    },
  };
}
