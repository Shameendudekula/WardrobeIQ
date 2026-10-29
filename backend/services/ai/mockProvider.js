// Deterministic mock provider for automated tests and offline UI development.
// It is only used when AI_PROVIDER=mock (or injected by tests), and every response it
// produces is labelled as mock output — it is never presented as AI-generated.
import { AIError } from "./errors.js";

const MOCK_NOTE = "Mock provider response for development — not AI-generated.";

// Default behaviour: build simple combinations from the refs it was given, in order
function defaultRespond({ task, context }) {
  if (task === "outfits") {
    const refs = (context?.wardrobe || []).map((i) => i.ref);
    const keep = context?.mustKeep || [];
    const previous = new Set((context?.previousOutfit || []).map((i) => i.ref));
    if (context?.previousOutfit) {
      // Regeneration: keep the requested refs and swap in items that weren't in the previous outfit
      const fresh = refs.filter((r) => !previous.has(r) && !keep.includes(r)).slice(0, Math.max(1, 2 - keep.length));
      const chosen = [...keep, ...fresh];
      return {
        message: MOCK_NOTE,
        missingItems: [],
        outfits: fresh.length ? [{
          title: "Mock variation", description: MOCK_NOTE, style: "mock", occasion: "any", formality: "smart-casual",
          weatherSuitability: "unknown", colorNotes: MOCK_NOTE, weatherNotes: MOCK_NOTE, preferenceNotes: MOCK_NOTE,
          explanation: MOCK_NOTE, tips: [], items: chosen.map((ref) => ({ ref, role: "other", reason: MOCK_NOTE })),
        }] : [],
      };
    }
    const count = Math.min(context?.count || 3, Math.floor(refs.length / 2));
    const outfits = Array.from({ length: count }, (_, n) => ({
      title: `Mock outfit ${n + 1}`,
      description: MOCK_NOTE,
      style: "mock",
      occasion: context?.request?.occasion || "any",
      formality: "smart-casual",
      weatherSuitability: "unknown",
      colorNotes: MOCK_NOTE,
      weatherNotes: MOCK_NOTE,
      preferenceNotes: MOCK_NOTE,
      explanation: MOCK_NOTE,
      tips: [],
      items: [refs[n * 2], refs[n * 2 + 1]].map((ref) => ({ ref, role: "other", reason: MOCK_NOTE })),
    }));
    return { message: MOCK_NOTE, outfits, missingItems: [] };
  }
  throw new AIError("AI_BAD_OUTPUT", 502, `Mock provider has no default response for task "${task}"`);
}

/**
 * @param {object} [opts]
 * @param {(args) => object|Promise<object>} [opts.respond] returns the model's JSON (or throws an AIError)
 */
export function createMockProvider({ respond = defaultRespond } = {}) {
  const calls = [];
  return {
    name: "mock",
    model: "mock",
    calls,
    async generateJSON(args) {
      calls.push(args);
      const data = await respond(args);
      return { data, model: "mock", usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
}
