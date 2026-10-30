// Selects and configures the AI provider from environment variables.
//   AI_PROVIDER = anthropic (default) | openai | mock
//   AI_MODEL    = model ID (defaults per provider)
//   AI_FALLBACK_MODEL = model to retry on when the main one is rate limited or overloaded
// Keys are read only here, on the server, and never sent to the client.
import { createAnthropicProvider } from "./anthropicProvider.js";
import { createOpenAIProvider } from "./openaiProvider.js";
import { createMockProvider } from "./mockProvider.js";
import { aiErrors } from "./errors.js";

// OpenAI-compatible servers host many models, so AI_MODEL must be set explicitly for that provider
const DEFAULT_MODELS = { anthropic: "claude-opus-5-5", mock: "mock" };
// Gemini's free tier rate-limits each model separately, so a lighter model usually still has quota
const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_CODES = new Set(["AI_RATE_LIMITED", "AI_UNAVAILABLE"]);

let testOverride = null;
let cached = null; // { signature, provider }

/** Tests inject a provider (usually the mock) here; pass null to reset. */
export function setProviderForTests(provider) {
  testOverride = provider;
}

function readConfig() {
  const name = (process.env.AI_PROVIDER || "anthropic").trim().toLowerCase();
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 60000;
  const maxRetries = process.env.AI_MAX_RETRIES === undefined ? 2 : Number(process.env.AI_MAX_RETRIES);
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[name];

  if (name === "anthropic") {
    const apiKey = (process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY)?.trim();
    return {
      name, model, timeoutMs, maxRetries, apiKey,
      effort: process.env.AI_EFFORT?.trim() || undefined,
      refusalFallback: process.env.AI_REFUSAL_FALLBACK !== "false",
      missing: apiKey ? null : "Set ANTHROPIC_API_KEY in the server environment.",
    };
  }
  if (name === "openai") {
    const apiKey = (process.env.OPENAI_API_KEY || process.env.AI_API_KEY)?.trim();
    const baseURL = process.env.AI_BASE_URL?.trim() || undefined;
    const fallbackModel = process.env.AI_FALLBACK_MODEL?.trim()
      || (baseURL?.includes("generativelanguage.googleapis.com") ? GEMINI_FALLBACK_MODEL : undefined);
    return {
      name, model, timeoutMs, maxRetries, apiKey, baseURL,
      fallbackModel: fallbackModel && fallbackModel !== model ? fallbackModel : undefined,
      jsonMode: process.env.AI_JSON_MODE === "json_object" ? "json_object" : "json_schema",
      missing: !apiKey ? "Set OPENAI_API_KEY (or AI_API_KEY) in the server environment."
        : !model ? "Set AI_MODEL to the model ID your OpenAI-compatible endpoint serves."
        : null,
    };
  }
  if (name === "mock") return { name, model, missing: null };
  return { name, model, missing: `Unknown AI_PROVIDER "${name}". Use anthropic, openai or mock.` };
}

/** Safe-to-expose status (no secrets) */
export function getAIStatus() {
  if (testOverride) return { configured: true, provider: testOverride.name, model: testOverride.model, isMock: testOverride.name === "mock" };
  const cfg = readConfig();
  return {
    configured: !cfg.missing,
    provider: cfg.name,
    model: cfg.model,
    isMock: cfg.name === "mock",
    ...(cfg.missing && { reason: cfg.missing }),
  };
}

/** Returns the configured provider or throws AI_NOT_CONFIGURED. */
export function getProvider() {
  if (testOverride) return testOverride;
  const cfg = readConfig();
  if (cfg.missing) throw aiErrors.notConfigured(cfg.missing);

  const signature = JSON.stringify(cfg);
  if (cached?.signature === signature) return cached.provider;

  const provider =
    cfg.name === "anthropic" ? createAnthropicProvider(cfg)
    : cfg.name === "openai" ? withFallback(createOpenAIProvider(cfg), cfg)
    : createMockProvider();
  cached = { signature, provider };
  return provider;
}

// Retries a request once on cfg.fallbackModel when the main model is rate limited or overloaded
function withFallback(provider, cfg) {
  if (!cfg.fallbackModel) return provider;
  const fallback = createOpenAIProvider({ ...cfg, model: cfg.fallbackModel });
  return {
    ...provider,
    async generateJSON(args) {
      try {
        return await provider.generateJSON(args);
      } catch (err) {
        if (!FALLBACK_CODES.has(err.code)) throw err;
        console.warn(`AI ${err.code} on ${cfg.model}; retrying on ${cfg.fallbackModel}`);
        return fallback.generateJSON(args);
      }
    },
  };
}
