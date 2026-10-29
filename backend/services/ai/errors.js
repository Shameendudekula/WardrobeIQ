// Provider-independent AI errors. Providers translate their SDK errors into these,
// so routes and the UI never depend on a specific vendor's error classes.
export class AIError extends Error {
  constructor(code, status, message, { retryAfter, cause } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
    if (cause) this.cause = cause;
  }
}

export const aiErrors = {
  notConfigured: (reason) =>
    new AIError("AI_NOT_CONFIGURED", 503, `The AI stylist is not configured on this server. ${reason}`),
  timeout: (cause) =>
    new AIError("AI_TIMEOUT", 504, "The AI provider took too long to respond. Please try again.", { cause }),
  rateLimited: (retryAfter, cause) =>
    new AIError("AI_RATE_LIMITED", 503, "The AI provider is busy right now. Please try again in a moment.", { retryAfter, cause }),
  unavailable: (cause) =>
    new AIError("AI_UNAVAILABLE", 502, "The AI provider is unavailable. Please try again later.", { cause }),
  authFailed: (cause) =>
    new AIError("AI_AUTH_FAILED", 503, "The AI provider rejected the server's credentials. Check the API key configuration.", { cause }),
  badOutput: (detail, cause) =>
    new AIError("AI_BAD_OUTPUT", 502, `The AI returned a response that could not be used${detail ? ` (${detail})` : ""}. Please try again.`, { cause }),
  refused: () =>
    new AIError("AI_REFUSED", 422, "The AI declined this request. Try rephrasing it."),
};

// Parse a model's JSON text. Structured outputs should make this always succeed; guard anyway.
export function parseModelJSON(text) {
  if (!text || !text.trim()) throw aiErrors.badOutput("empty response");
  try {
    return JSON.parse(text);
  } catch (err) {
    throw aiErrors.badOutput("invalid JSON", err);
  }
}
