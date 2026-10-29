// Shared test setup: in-memory MongoDB, the Express app, and small helpers.
// Environment is set before the app is imported so modules read test values.
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";

process.env.JWT_SECRET = "test-secret";
process.env.AUTH_RATE_LIMIT_PER_15MIN = "10000";
process.env.AI_RATE_LIMIT_PER_HOUR = "10000";
delete process.env.OPENWEATHER_API_KEY; // never call the real weather API from tests
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.AI_API_KEY;

const { default: app } = await import("../lib/app.js");
export const ai = await import("../services/ai/index.js");
export const { createMockProvider } = await import("../services/ai/mockProvider.js");
export const { aiErrors } = await import("../services/ai/errors.js");
export { app, request };

// 1x1 PNG
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

let mongod;
export async function startDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}
export async function stopDb() {
  await mongoose.disconnect();
  await mongod?.stop();
}
export async function clearDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

let n = 0;
/** Sign up + log in a fresh user; returns { token, auth } where auth is the header value */
export async function createUser(name = "Test User") {
  const email = `user${++n}-${Date.now()}@test.dev`;
  await request(app).post("/api/auth/signup").send({ name, email, password: "secret123" }).expect(201);
  const res = await request(app).post("/api/auth/login").send({ email, password: "secret123" }).expect(200);
  return { token: res.body.token, auth: `Bearer ${res.body.token}`, email };
}

/** Create a wardrobe item through the real upload endpoint */
export async function addItem(user, fields) {
  let req = request(app).post("/api/wardrobe").set("Authorization", user.auth).attach("image", PNG, "item.png");
  for (const [k, v] of Object.entries(fields)) req = req.field(k, Array.isArray(v) ? v.join(",") : v);
  const res = await req.expect(201);
  return res.body;
}

/** Extract the wardrobe refs the stylist sent to the model, keyed by item name */
export function refsByName(call) {
  const match = call.prompt.match(/<wardrobe_data>\n(.*)\n<\/wardrobe_data>/s);
  const wardrobe = JSON.parse(match[1]);
  return Object.fromEntries(wardrobe.map((w) => [w.name, w.ref]));
}

/** A schema-valid outfit for mock responses */
export function outfit(refs, overrides = {}) {
  return {
    title: "Test look", description: "d", style: "smart-casual", occasion: "office", formality: "smart-casual",
    weatherSuitability: "suitable", colorNotes: "c", weatherNotes: "w", preferenceNotes: "p", explanation: "e",
    tips: ["t"], items: refs.map((ref) => ({ ref, role: "top", reason: "r" })), ...overrides,
  };
}
