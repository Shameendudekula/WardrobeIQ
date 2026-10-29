// Frontend rendering tests: loads public/stylist-render.js in a sandbox (no browser needed)
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/stylist-render.js", import.meta.url), "utf8");
const sandbox = {};
vm.runInNewContext(source, sandbox);
const R = sandbox.StylistRender;

const item = (id, name, extra = {}) => ({
  role: "top", reason: "Pairs well", item: { id, itemName: name, category: "shirt", imageUrl: `/api/images/${id}`, colors: ["white"], ...extra },
});
const outfit = (extra = {}) => ({
  id: "6650000000000000000000aa", title: "Smart casual", description: "Clean and easy", formality: "smart-casual",
  occasion: "office", style: "minimal", weatherSuitability: "suitable", explanation: "Balanced neutrals.",
  colorNotes: "White and navy contrast.", weatherNotes: "Light layers for 18°C.", preferenceNotes: "Uses your favourite navy.",
  tips: ["Roll the sleeves"], saved: false, feedback: null,
  items: [item("6650000000000000000000a1", "White oxford"), item("6650000000000000000000a2", "Navy chinos", { category: "trousers" })],
  ...extra,
});

describe("outfit card", () => {
  test("renders every real wardrobe item with its image and name", () => {
    const html = R.renderOutfitCard(outfit());
    assert.match(html, /src="\/api\/images\/6650000000000000000000a1"/);
    assert.match(html, /src="\/api\/images\/6650000000000000000000a2"/);
    assert.match(html, /White oxford/);
    assert.match(html, /Navy chinos/);
    assert.match(html, /data-outfit-id="6650000000000000000000aa"/);
  });

  test("shows explanations: colours, weather, preferences and tips", () => {
    const html = R.renderOutfitCard(outfit());
    assert.match(html, /Balanced neutrals/);
    assert.match(html, /White and navy contrast/);
    assert.match(html, /Light layers for 18°C/);
    assert.match(html, /Uses your favourite navy/);
    assert.match(html, /Roll the sleeves/);
  });

  test("escapes untrusted text (XSS) from item names and AI output", () => {
    const html = R.renderOutfitCard(outfit({
      title: '<img src=x onerror=alert(1)>',
      items: [item("6650000000000000000000a1", '"><script>alert(1)</script>')],
    }));
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<img src=x"));
    assert.match(html, /&lt;script&gt;/);
  });

  test("never renders external or model-supplied image URLs", () => {
    const html = R.renderOutfitCard(outfit({ items: [item("x", "Hat", { imageUrl: "https://evil.example/track.png" })] }));
    assert.ok(!html.includes("evil.example"));
    assert.equal(R.safeImg("/api/images/6650000000000000000000a1"), "/api/images/6650000000000000000000a1");
    assert.equal(R.safeImg("/uploads/kurta_set.webp"), "/uploads/kurta_set.webp");
    assert.equal(R.safeImg("javascript:alert(1)"), "");
    assert.equal(R.safeImg("//evil.example/x.png"), "");
  });

  test("save, rating and feedback controls reflect state accessibly", () => {
    let html = R.renderOutfitCard(outfit());
    assert.match(html, /data-action="save" aria-pressed="false" aria-label="Save outfit"/);
    html = R.renderOutfitCard(outfit({ saved: true, feedback: { rating: "like", tags: ["great-colors"] } }));
    assert.match(html, /aria-pressed="true" aria-label="Unsave outfit"/);
    assert.match(html, /st-thumb on" data-action="rate" data-rating="like" aria-pressed="true"/);
    assert.match(html, /fchip active" data-action="tag" data-tag="great-colors" aria-pressed="true"/);
  });

  test("includes a regenerate form with keep checkboxes for each item", () => {
    const html = R.renderOutfitCard(outfit());
    assert.match(html, /<form class="st-modify" data-action="modify" hidden>/);
    assert.match(html, /name="keep" value="6650000000000000000000a1"/);
    assert.match(html, /name="keep" value="6650000000000000000000a2"/);
    assert.match(html, /Use different shoes/);
    assert.match(html, /<label class="sr-only" for="mod-6650000000000000000000aa">/);
  });

  test("flags outfits whose items were deleted and only offers delete when allowed", () => {
    assert.match(R.renderOutfitCard(outfit({ incomplete: true })), /were deleted/);
    assert.ok(!R.renderOutfitCard(outfit()).includes('data-action="delete"'));
    assert.match(R.renderOutfitCard(outfit(), { deletable: true }), /data-action="delete"/);
  });
});

describe("loading, errors and result header", () => {
  test("loading state is announced to assistive tech", () => {
    const html = R.renderLoading("Checking the weather…");
    assert.match(html, /role="status"/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /Checking the weather/);
  });

  test("retryable errors offer a retry button; configuration errors do not", () => {
    const timeout = R.renderError({ code: "AI_TIMEOUT", message: "Took too long" });
    assert.match(timeout, /role="alert"/);
    assert.match(timeout, /Took too long/);
    assert.match(timeout, /data-action="retry"/);
    const config = R.renderError({ code: "AI_NOT_CONFIGURED", message: "Not configured" });
    assert.match(config, /AI stylist unavailable/);
    assert.ok(!config.includes('data-action="retry"'));
  });

  test("labels mock output clearly and shows weather and missing items", () => {
    const html = R.renderResultHeader({
      message: "Two looks for you.",
      source: { provider: "mock", model: "mock", isMock: true },
      weather: { available: true, kind: "forecast", city: "Karlskrona", date: "2026-11-02", minTemperature: 3.6, maxTemperature: 7.2, description: "light rain", precipitationProbability: 80 },
      missingItems: [{ category: "waterproof jacket", reason: "rain expected" }],
      rejected: 1,
    });
    assert.match(html, /Mock provider — not AI-generated/);
    assert.match(html, /Karlskrona/);
    assert.match(html, /4–7°C/);
    assert.match(html, /80% rain/);
    assert.match(html, /waterproof jacket/);
    assert.match(html, /1 invalid suggestion filtered/);
  });

  test("reports when weather was not used", () => {
    const html = R.renderResultHeader({ weather: { available: false, reason: "No location provided" }, source: { provider: "anthropic", model: "claude-opus-5-5" } });
    assert.match(html, /Weather not used: No location provided/);
    assert.match(html, /claude-opus-5-5/);
  });
});
