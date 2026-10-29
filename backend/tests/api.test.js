// Integration tests: real Express app + in-memory MongoDB, AI provider replaced by the mock
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  app, request, ai, createMockProvider, aiErrors, startDb, stopDb, clearDb,
  createUser, addItem, refsByName, outfit, PNG,
} from "./helpers.js";

before(startDb);
after(async () => { ai.setProviderForTests(null); await stopDb(); });
beforeEach(async () => { await clearDb(); ai.setProviderForTests(null); });

/* ---------- Existing functionality ---------- */
describe("auth", () => {
  test("signup, login, and protected routes", async () => {
    const user = await createUser();
    await request(app).get("/api/wardrobe").expect(401);
    await request(app).get("/api/wardrobe").set("Authorization", "Bearer not-a-token").expect(401);
    await request(app).get("/api/wardrobe").set("Authorization", user.auth).expect(200);
  });

  test("rejects duplicate emails, short passwords and wrong passwords", async () => {
    const user = await createUser();
    await request(app).post("/api/auth/signup").send({ name: "A", email: user.email, password: "secret123" }).expect(400);
    await request(app).post("/api/auth/signup").send({ name: "A", email: "new@test.dev", password: "123" }).expect(400);
    await request(app).post("/api/auth/login").send({ email: user.email, password: "wrong-pass" }).expect(400);
  });
});

describe("wardrobe", () => {
  test("creates items with metadata, validates image bytes, edits and deletes", async () => {
    const user = await createUser();
    const item = await addItem(user, { itemName: "Navy Blazer", category: "Blazer", colors: "Navy, white", formality: "business", seasons: "autumn,winter" });
    assert.equal(item.category, "blazer");
    assert.deepEqual(item.colors, ["navy", "white"]);
    assert.deepEqual(item.seasons, ["autumn", "winter"]);
    assert.match(item.imageUrl, /^\/api\/images\/[a-f0-9]{24}$/);

    const img = await request(app).get(item.imageUrl).expect(200);
    assert.equal(img.headers["content-type"], "image/png");

    // A script disguised as a PNG is rejected by byte sniffing
    await request(app).post("/api/wardrobe").set("Authorization", user.auth)
      .field("itemName", "x").field("category", "x")
      .attach("image", Buffer.from("#!/bin/sh\necho pwned\n"), { filename: "evil.png", contentType: "image/png" })
      .expect(400);
    await request(app).post("/api/wardrobe").set("Authorization", user.auth)
      .field("itemName", "x").field("category", "x").field("formality", "ultra").attach("image", PNG, "a.png")
      .expect(400);

    const edited = await request(app).patch(`/api/wardrobe/${item._id}`).set("Authorization", user.auth)
      .send({ itemName: "Navy wool blazer", colors: ["navy"], notes: "slim fit" }).expect(200);
    assert.equal(edited.body.itemName, "Navy wool blazer");
    assert.equal(edited.body.notes, "slim fit");
    await request(app).patch(`/api/wardrobe/${item._id}`).set("Authorization", user.auth).send({ userId: "x" }).expect(400);
    const cleared = await request(app).patch(`/api/wardrobe/${item._id}`).set("Authorization", user.auth)
      .send({ colors: "", notes: "", formality: null }).expect(200);
    assert.deepEqual(cleared.body.colors, []);
    assert.equal(cleared.body.notes, null);
    assert.equal(cleared.body.formality, null);

    await request(app).post(`/api/wardrobe/${item._id}/wear`).set("Authorization", user.auth).expect(200);
    const history = await request(app).get("/api/wardrobe/history").set("Authorization", user.auth).expect(200);
    assert.equal(history.body.length, 1);

    await request(app).delete(`/api/wardrobe/${item._id}`).set("Authorization", user.auth).expect(200);
    await request(app).get(item.imageUrl).expect(404);
    const list = await request(app).get("/api/wardrobe").set("Authorization", user.auth).expect(200);
    assert.equal(list.body.length, 0);
  });

  test("users cannot read, edit, wear or delete each other's items", async () => {
    const alice = await createUser("Alice");
    const bob = await createUser("Bob");
    const item = await addItem(alice, { itemName: "Red dress", category: "dress" });

    const bobsList = await request(app).get("/api/wardrobe").set("Authorization", bob.auth).expect(200);
    assert.equal(bobsList.body.length, 0);
    await request(app).patch(`/api/wardrobe/${item._id}`).set("Authorization", bob.auth).send({ itemName: "mine" }).expect(404);
    await request(app).post(`/api/wardrobe/${item._id}/wear`).set("Authorization", bob.auth).expect(404);
    await request(app).delete(`/api/wardrobe/${item._id}`).set("Authorization", bob.auth).expect(404);
    await request(app).delete("/api/wardrobe/not-an-id").set("Authorization", bob.auth).expect(404);
  });
});

/* ---------- AI stylist ---------- */
async function seedWardrobe(user) {
  const items = {};
  for (const [itemName, category, colors] of [
    ["White oxford shirt", "shirt", "white"], ["Navy chinos", "trousers", "navy"],
    ["Brown loafers", "loafers", "brown"], ["Grey hoodie", "hoodie", "grey"], ["Blue jeans", "jeans", "blue"],
  ]) items[itemName] = await addItem(user, { itemName, category, colors });
  return items;
}

describe("stylist: configuration and validation", () => {
  test("requires authentication", async () => {
    await request(app).post("/api/stylist/recommend").send({ prompt: "office outfit" }).expect(401);
    await request(app).get("/api/stylist/outfits").expect(401);
  });

  test("returns a clear 503 when no AI provider is configured (no silent fallback)", async () => {
    const user = await createUser();
    await seedWardrobe(user);
    process.env.AI_PROVIDER = "anthropic";
    const res = await request(app).post("/api/stylist/recommend").set("Authorization", user.auth).send({ prompt: "office outfit" }).expect(503);
    assert.equal(res.body.code, "AI_NOT_CONFIGURED");
    assert.ok(!JSON.stringify(res.body).match(/sk-|key=/i));
    const status = await request(app).get("/api/stylist/status").set("Authorization", user.auth).expect(200);
    assert.equal(status.body.configured, false);
    assert.equal(status.body.reason, undefined, "status endpoint should not leak config details");
    delete process.env.AI_PROVIDER;
  });

  test("validates the request body", async () => {
    const user = await createUser();
    ai.setProviderForTests(createMockProvider());
    for (const body of [{}, { prompt: "x" }, { prompt: "ok outfit", count: 9 }, { prompt: "ok outfit", date: "tomorrow" }, { prompt: "ok outfit", admin: true }]) {
      const res = await request(app).post("/api/stylist/recommend").set("Authorization", user.auth).send(body).expect(400);
      assert.equal(res.body.code, "VALIDATION_ERROR");
    }
  });

  test("an empty wardrobe explains the limitation without calling the AI", async () => {
    const user = await createUser();
    const mock = createMockProvider();
    ai.setProviderForTests(mock);
    const res = await request(app).post("/api/stylist/recommend").set("Authorization", user.auth).send({ prompt: "office outfit" }).expect(200);
    assert.equal(res.body.aiUsed, false);
    assert.equal(res.body.outfits.length, 0);
    assert.match(res.body.message, /empty/i);
    assert.equal(mock.calls.length, 0);
  });
});

describe("stylist: recommendations", () => {
  test("returns validated outfits that resolve to the user's real items", async () => {
    const user = await createUser();
    const items = await seedWardrobe(user);
    const mock = createMockProvider({
      respond: ({ prompt }) => {
        const r = refsByName({ prompt });
        return {
          message: "Two office looks.",
          outfits: [
            outfit([r["White oxford shirt"], r["Navy chinos"], r["Brown loafers"]], { title: "Classic office" }),
            outfit([r["Grey hoodie"], r["Blue jeans"]], { title: "Casual Friday" }),
          ],
          missingItems: [{ category: "blazer", reason: "would make it more formal" }],
        };
      },
    });
    ai.setProviderForTests(mock);

    const res = await request(app).post("/api/stylist/recommend").set("Authorization", user.auth)
      .send({ prompt: "Something for a university presentation", occasion: "presentation", count: 3 }).expect(201);

    assert.equal(res.body.aiUsed, true);
    assert.equal(res.body.source.provider, "mock");
    assert.equal(res.body.source.isMock, true);
    assert.equal(res.body.outfits.length, 2);
    const [first] = res.body.outfits;
    assert.equal(first.title, "Classic office");
    assert.deepEqual(first.items.map((i) => i.item.id), [items["White oxford shirt"]._id, items["Navy chinos"]._id, items["Brown loafers"]._id]);
    assert.equal(first.items[0].item.imageUrl, items["White oxford shirt"].imageUrl);
    assert.equal(res.body.missingItems[0].category, "blazer");
    assert.equal(res.body.weather.available, false, "weather limitation is reported");

    // What the model saw: refs only, no database IDs, untrusted data clearly delimited
    const { prompt, system } = mock.calls[0];
    for (const it of Object.values(items)) assert.ok(!prompt.includes(it._id), "database id sent to the model");
    assert.match(prompt, /<wardrobe_data>/);
    assert.match(prompt, /university presentation/);
    assert.match(system, /untrusted data/);

    // Opening history does not call the AI again
    const hist = await request(app).get("/api/stylist/outfits").set("Authorization", user.auth).expect(200);
    assert.equal(hist.body.outfits.length, 2);
    await request(app).get(`/api/stylist/outfits/${first.id}`).set("Authorization", user.auth).expect(200);
    assert.equal(mock.calls.length, 1);
  });

  test("drops outfits that use another user's item IDs and rejects responses with only invented items", async () => {
    const alice = await createUser("Alice");
    const bob = await createUser("Bob");
    await seedWardrobe(alice);
    const bobsItem = await addItem(bob, { itemName: "Bob's watch", category: "accessories" });

    let mode = "mixed";
    ai.setProviderForTests(createMockProvider({
      respond: ({ prompt }) => {
        const r = refsByName({ prompt });
        const valid = outfit([r["White oxford shirt"], r["Navy chinos"]]);
        const forged = outfit([r["Grey hoodie"], bobsItem._id]);
        const invented = outfit(["i999", "gucci-belt"]);
        return { message: "m", outfits: mode === "mixed" ? [forged, valid, invented] : [forged, invented], missingItems: [] };
      },
    }));

    const res = await request(app).post("/api/stylist/recommend").set("Authorization", alice.auth).send({ prompt: "dinner date" }).expect(201);
    assert.equal(res.body.outfits.length, 1);
    assert.equal(res.body.rejected, 2);
    assert.ok(!JSON.stringify(res.body).includes(bobsItem._id));

    mode = "bad";
    const bad = await request(app).post("/api/stylist/recommend").set("Authorization", alice.auth).send({ prompt: "dinner date" }).expect(502);
    assert.equal(bad.body.code, "AI_BAD_OUTPUT");
  });

  test("returns zero outfits with missing-item advice when the wardrobe can't satisfy the request", async () => {
    const user = await createUser();
    await seedWardrobe(user);
    ai.setProviderForTests(createMockProvider({
      respond: () => ({ message: "No formal shoes or suit.", outfits: [], missingItems: [{ category: "formal shoes", reason: "needed for a black-tie event" }] }),
    }));
    const res = await request(app).post("/api/stylist/recommend").set("Authorization", user.auth).send({ prompt: "black tie gala" }).expect(201);
    assert.equal(res.body.outfits.length, 0);
    assert.equal(res.body.missingItems[0].category, "formal shoes");
  });

  const failures = [
    ["timeout", () => aiErrors.timeout(), 504, "AI_TIMEOUT"],
    ["rate limit", () => aiErrors.rateLimited(20), 503, "AI_RATE_LIMITED"],
    ["outage", () => aiErrors.unavailable(), 502, "AI_UNAVAILABLE"],
    ["refusal", () => aiErrors.refused(), 422, "AI_REFUSED"],
  ];
  for (const [name, makeErr, status, code] of failures) {
    test(`maps provider ${name} to ${status} ${code}`, async () => {
      const user = await createUser();
      await seedWardrobe(user);
      ai.setProviderForTests(createMockProvider({ respond: () => { throw makeErr(); } }));
      const res = await request(app).post("/api/stylist/recommend").set("Authorization", user.auth).send({ prompt: "office outfit" }).expect(status);
      assert.equal(res.body.code, code);
      if (code === "AI_RATE_LIMITED") assert.equal(res.headers["retry-after"], "20");
    });
  }

  test("malformed model output is rejected safely", async () => {
    const user = await createUser();
    await seedWardrobe(user);
    ai.setProviderForTests(createMockProvider({ respond: () => ({ outfits: [{ title: 42 }] }) }));
    const res = await request(app).post("/api/stylist/recommend").set("Authorization", user.auth).send({ prompt: "office outfit" }).expect(502);
    assert.equal(res.body.code, "AI_BAD_OUTPUT");
    const hist = await request(app).get("/api/stylist/outfits").set("Authorization", user.auth).expect(200);
    assert.equal(hist.body.outfits.length, 0, "nothing persisted on failure");
  });

  test("enforces the per-user hourly AI limit", async () => {
    const user = await createUser();
    await seedWardrobe(user);
    ai.setProviderForTests(createMockProvider());
    process.env.AI_RATE_LIMIT_PER_HOUR = "2";
    try {
      for (let i = 0; i < 2; i++) await request(app).post("/api/stylist/recommend").set("Authorization", user.auth).send({ prompt: "office outfit" }).expect(201);
      const res = await request(app).post("/api/stylist/recommend").set("Authorization", user.auth).send({ prompt: "office outfit" }).expect(429);
      assert.equal(res.body.code, "RATE_LIMITED");
      // Other users are unaffected
      const other = await createUser();
      await seedWardrobe(other);
      await request(app).post("/api/stylist/recommend").set("Authorization", other.auth).send({ prompt: "office outfit" }).expect(201);
    } finally {
      process.env.AI_RATE_LIMIT_PER_HOUR = "10000";
    }
  });
});

describe("stylist: saving, feedback, regeneration, profile", () => {
  async function setup() {
    const user = await createUser();
    const items = await seedWardrobe(user);
    const mock = createMockProvider({
      respond: ({ prompt }) => {
        const r = refsByName({ prompt });
        if (prompt.includes("<previous_outfit>")) {
          return { message: "Swapped the shoes.", missingItems: [], outfits: [outfit([r["White oxford shirt"], r["Navy chinos"], r["Grey hoodie"]], { title: "Variation" })] };
        }
        return { message: "m", missingItems: [], outfits: [outfit([r["White oxford shirt"], r["Navy chinos"], r["Brown loafers"]])] };
      },
    });
    ai.setProviderForTests(mock);
    const res = await request(app).post("/api/stylist/recommend").set("Authorization", user.auth).send({ prompt: "office outfit" }).expect(201);
    return { user, items, mock, outfitId: res.body.outfits[0].id };
  }

  test("saves an outfit and records feedback; feedback reaches the next prompt", async () => {
    const { user, mock, outfitId } = await setup();
    const res = await request(app).patch(`/api/stylist/outfits/${outfitId}`).set("Authorization", user.auth)
      .send({ saved: true, feedback: { rating: "dislike", tags: ["too-formal"], comment: "prefer sneakers" } }).expect(200);
    assert.equal(res.body.saved, true);
    assert.equal(res.body.feedback.rating, "dislike");
    assert.deepEqual(res.body.feedback.tags, ["too-formal"]);

    await request(app).patch(`/api/stylist/outfits/${outfitId}`).set("Authorization", user.auth).send({ feedback: { tags: ["bogus"] } }).expect(400);

    const saved = await request(app).get("/api/stylist/outfits?saved=true").set("Authorization", user.auth).expect(200);
    assert.equal(saved.body.outfits.length, 1);

    await request(app).post("/api/stylist/recommend").set("Authorization", user.auth).send({ prompt: "office outfit again" }).expect(201);
    const feedbackBlock = mock.calls[1].prompt.match(/<feedback_history>\n(.*)\n<\/feedback_history>/s)[1];
    assert.match(feedbackBlock, /too-formal/);
    assert.match(feedbackBlock, /prefer sneakers/);
    assert.match(feedbackBlock, /Brown loafers/);
  });

  test("regenerates while keeping the requested items", async () => {
    const { user, items, mock, outfitId } = await setup();
    const keep = [items["White oxford shirt"]._id, items["Navy chinos"]._id];
    const res = await request(app).post(`/api/stylist/outfits/${outfitId}/regenerate`).set("Authorization", user.auth)
      .send({ instruction: "use different shoes", keepItemIds: keep }).expect(201);
    const [variant] = res.body.outfits;
    assert.equal(variant.parentId, outfitId);
    for (const id of keep) assert.ok(variant.items.some((i) => i.item.id === id));
    assert.match(mock.calls[1].prompt, /use different shoes/);
    assert.match(mock.calls[1].prompt, /<must_keep_refs>/);

    // Keep-items must come from the outfit being changed
    await request(app).post(`/api/stylist/outfits/${outfitId}/regenerate`).set("Authorization", user.auth)
      .send({ instruction: "different shoes", keepItemIds: [items["Blue jeans"]._id] }).expect(400);
  });

  test("users cannot access each other's outfits", async () => {
    const { outfitId } = await setup();
    const bob = await createUser("Bob");
    await request(app).get(`/api/stylist/outfits/${outfitId}`).set("Authorization", bob.auth).expect(404);
    await request(app).patch(`/api/stylist/outfits/${outfitId}`).set("Authorization", bob.auth).send({ saved: true }).expect(404);
    await request(app).post(`/api/stylist/outfits/${outfitId}/regenerate`).set("Authorization", bob.auth).send({ instruction: "more formal" }).expect(404);
    await request(app).delete(`/api/stylist/outfits/${outfitId}`).set("Authorization", bob.auth).expect(404);
    const list = await request(app).get("/api/stylist/outfits").set("Authorization", bob.auth).expect(200);
    assert.equal(list.body.outfits.length, 0);
  });

  test("deleting a wardrobe item marks saved outfits incomplete instead of breaking them", async () => {
    const { user, items, outfitId } = await setup();
    await request(app).delete(`/api/wardrobe/${items["Brown loafers"]._id}`).set("Authorization", user.auth).expect(200);
    const res = await request(app).get(`/api/stylist/outfits/${outfitId}`).set("Authorization", user.auth).expect(200);
    assert.equal(res.body.incomplete, true);
    assert.equal(res.body.items.length, 2);
  });

  test("deletes an outfit", async () => {
    const { user, outfitId } = await setup();
    await request(app).delete(`/api/stylist/outfits/${outfitId}`).set("Authorization", user.auth).expect(204);
    await request(app).get(`/api/stylist/outfits/${outfitId}`).set("Authorization", user.auth).expect(404);
  });

  test("style profile can be created, used in prompts, updated and deleted", async () => {
    const { user, mock } = await setup();
    let res = await request(app).get("/api/stylist/profile").set("Authorization", user.auth).expect(200);
    assert.equal(res.body.profile, null);

    res = await request(app).put("/api/stylist/profile").set("Authorization", user.auth)
      .send({ favoriteColors: ["navy", "olive"], dislikedColors: ["orange"], goals: "Look professional on a budget" }).expect(200);
    assert.deepEqual(res.body.profile.favoriteColors, ["navy", "olive"]);
    await request(app).put("/api/stylist/profile").set("Authorization", user.auth).send({ age: 30 }).expect(400);

    await request(app).post("/api/stylist/recommend").set("Authorization", user.auth).send({ prompt: "office outfit" }).expect(201);
    const profileBlock = mock.calls.at(-1).prompt.match(/<style_profile>\n(.*)\n<\/style_profile>/s)[1];
    assert.match(profileBlock, /olive/);
    assert.match(profileBlock, /orange/);

    await request(app).delete("/api/stylist/profile").set("Authorization", user.auth).expect(204);
    res = await request(app).get("/api/stylist/profile").set("Authorization", user.auth).expect(200);
    assert.equal(res.body.profile, null);
  });
});
