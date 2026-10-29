// Unit tests: AI response validation, ref resolution, weather summarising, image sniffing, provider config
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { outfit } from "./helpers.js";
import { buildWardrobeContext, resolveOutfits } from "../services/stylist.js";
import { summarizeForecast } from "../services/weather.js";
import { sniffImageType } from "../lib/imageType.js";
import { getAIStatus, getProvider } from "../services/ai/index.js";
import { parseModelJSON, AIError } from "../services/ai/errors.js";

const ids = ["64b000000000000000000001", "64b000000000000000000002", "64b000000000000000000003", "64b000000000000000000004"];
const items = ids.map((id, i) => ({ _id: id, itemName: `Item ${i + 1}`, category: "shirt", colors: ["blue"], lastWornDate: null }));
const { refToId } = buildWardrobeContext(items);
const response = (outfits, extra = {}) => ({ message: "ok", outfits, missingItems: [], ...extra });

describe("buildWardrobeContext", () => {
  test("assigns per-request refs and never exposes database IDs", () => {
    const { wardrobe, refToId: map } = buildWardrobeContext(items, new Map([[ids[0], 3]]));
    assert.deepEqual(wardrobe.map((w) => w.ref), ["i1", "i2", "i3", "i4"]);
    assert.equal(map.get("i1"), ids[0]);
    assert.equal(wardrobe[0].timesWorn, 3);
    assert.equal(wardrobe[0].lastWorn, "never");
    assert.ok(!JSON.stringify(wardrobe).includes(ids[0]), "database id leaked into context");
  });

  test("truncates long untrusted notes and drops empty fields", () => {
    const [ctx] = buildWardrobeContext([{ _id: ids[0], itemName: "X", category: "top", notes: "a".repeat(500), colors: [] }]).wardrobe;
    assert.equal(ctx.notes.length, 200);
    assert.ok(!("colors" in ctx));
  });
});

describe("resolveOutfits", () => {
  test("resolves refs to the user's real item IDs", () => {
    const r = resolveOutfits(response([outfit(["i1", "i2"])]), refToId);
    assert.equal(r.outfits.length, 1);
    assert.deepEqual(r.outfits[0].items.map((i) => i.item), [ids[0], ids[1]]);
  });

  test("discards an outfit that references an unknown ref", () => {
    const r = resolveOutfits(response([outfit(["i1", "i99"]), outfit(["i3", "i4"])]), refToId);
    assert.equal(r.outfits.length, 1);
    assert.equal(r.rejected, 1);
    assert.deepEqual(r.outfits[0].items.map((i) => i.item), [ids[2], ids[3]]);
  });

  test("rejects raw database IDs (including another user's) used as refs", () => {
    const otherUsersId = "64b0000000000000000000ff";
    assert.throws(() => resolveOutfits(response([outfit([otherUsersId, ids[0]])]), refToId), (e) => e.code === "AI_BAD_OUTPUT");
  });

  test("rejects outfits that repeat an item and duplicate combinations", () => {
    const r = resolveOutfits(response([outfit(["i1", "i1"]), outfit(["i1", "i2"]), outfit(["i2", "i1"])]), refToId);
    assert.equal(r.outfits.length, 1);
    assert.equal(r.rejected, 2);
  });

  test("enforces must-keep refs and excluded combinations (regeneration)", () => {
    const r = resolveOutfits(response([outfit(["i3", "i4"]), outfit(["i1", "i2"]), outfit(["i1", "i3"])]), refToId, {
      mustKeepRefs: ["i1"], excludeKeys: ["i1,i2"],
    });
    assert.equal(r.outfits.length, 1);
    assert.deepEqual(r.outfits[0].items.map((i) => i.item), [ids[0], ids[2]]);
  });

  test("caps the number of outfits", () => {
    const r = resolveOutfits(response([outfit(["i1"]), outfit(["i2"]), outfit(["i3"])]), refToId, { count: 2 });
    assert.equal(r.outfits.length, 2);
  });

  test("normalises unknown enum values instead of trusting them", () => {
    const r = resolveOutfits(response([outfit(["i1"], { formality: "Super Fancy", weatherSuitability: "great" })]), refToId);
    assert.equal(r.outfits[0].formality, undefined);
    assert.equal(r.outfits[0].weatherSuitability, "unknown");
    assert.equal(r.outfits[0].items[0].role, "top");
  });

  test("accepts zero outfits with missing-item guidance (wardrobe can't satisfy request)", () => {
    const r = resolveOutfits(response([], { missingItems: [{ category: "formal shoes", reason: "none in wardrobe" }] }), refToId);
    assert.equal(r.outfits.length, 0);
    assert.equal(r.missingItems[0].category, "formal shoes");
  });

  test("rejects malformed responses", () => {
    for (const bad of [null, {}, { outfits: "nope" }, { message: "x", outfits: [{ title: "no items" }], missingItems: [] }]) {
      assert.throws(() => resolveOutfits(bad, refToId), (e) => e instanceof AIError && e.code === "AI_BAD_OUTPUT");
    }
  });

  test("clamps oversized text fields", () => {
    const r = resolveOutfits(response([outfit(["i1"], { explanation: "x".repeat(5000) })]), refToId);
    assert.equal(r.outfits[0].explanation.length, 800);
  });
});

describe("parseModelJSON", () => {
  test("parses JSON and rejects empty or invalid text", () => {
    assert.deepEqual(parseModelJSON('{"a":1}'), { a: 1 });
    assert.throws(() => parseModelJSON(""), (e) => e.code === "AI_BAD_OUTPUT");
    assert.throws(() => parseModelJSON("{oops"), (e) => e.code === "AI_BAD_OUTPUT");
  });
});

describe("summarizeForecast", () => {
  const list = [
    { dt_txt: "2026-11-02 09:00:00", main: { temp: 4.2, humidity: 80 }, weather: [{ description: "light rain" }], wind: { speed: 9.1 }, pop: 0.7, rain: { "3h": 1 } },
    { dt_txt: "2026-11-02 15:00:00", main: { temp: 7.9, humidity: 70 }, weather: [{ description: "overcast clouds" }], wind: { speed: 6 }, pop: 0.2 },
    { dt_txt: "2026-11-03 09:00:00", main: { temp: 20, humidity: 50 }, weather: [{ description: "clear sky" }], wind: { speed: 1 }, pop: 0 },
  ];
  test("summarises only the requested date", () => {
    const s = summarizeForecast(list, "2026-11-02");
    assert.equal(s.minTemperature, 4.2);
    assert.equal(s.maxTemperature, 7.9);
    assert.equal(s.precipitationProbability, 70);
    assert.equal(s.rain, true);
    assert.equal(s.snow, false);
    assert.equal(s.maxWindSpeed, 9.1);
    assert.equal(s.humidity, 75);
  });
  test("returns null when there is no data for the date", () => {
    assert.equal(summarizeForecast(list, "2026-12-25"), null);
    assert.equal(summarizeForecast(undefined, "2026-11-02"), null);
  });
});

describe("sniffImageType", () => {
  test("detects real image bytes and rejects everything else", () => {
    assert.equal(sniffImageType(Buffer.from("ffd8ffe000104a4649460001", "hex")), "image/jpeg");
    assert.equal(sniffImageType(Buffer.from("89504e470d0a1a0a0000000d", "hex")), "image/png");
    assert.equal(sniffImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")])), "image/webp");
    assert.equal(sniffImageType(Buffer.from("GIF89a000000")), "image/gif");
    assert.equal(sniffImageType(Buffer.from("#!/bin/sh\nrm -rf /")), null);
    assert.equal(sniffImageType(Buffer.from("<svg onload=alert(1)>")), null);
    assert.equal(sniffImageType(Buffer.alloc(3)), null);
  });
});

describe("AI provider configuration", () => {
  test("reports missing credentials without exposing anything secret", () => {
    process.env.AI_PROVIDER = "anthropic";
    const status = getAIStatus();
    assert.equal(status.configured, false);
    assert.match(status.reason, /ANTHROPIC_API_KEY/);
    assert.throws(() => getProvider(), (e) => e.code === "AI_NOT_CONFIGURED" && e.status === 503);
  });

  test("OpenAI-compatible provider requires an explicit model", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    assert.match(getAIStatus().reason, /AI_MODEL/);
    process.env.AI_MODEL = "some-model";
    assert.equal(getAIStatus().configured, true);
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_MODEL;
  });

  test("rejects unknown providers and only uses mock when explicitly selected", () => {
    process.env.AI_PROVIDER = "magic";
    assert.equal(getAIStatus().configured, false);
    process.env.AI_PROVIDER = "mock";
    assert.equal(getAIStatus().isMock, true);
    assert.equal(getProvider().name, "mock");
    delete process.env.AI_PROVIDER;
  });
});
