// Provider tests: the real Anthropic and OpenAI SDKs talk to a local fake HTTP server,
// so request shape, structured-output parsing and error mapping are exercised without paid API calls.
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { z } from "zod";
import { createAnthropicProvider } from "../services/ai/anthropicProvider.js";
import { createOpenAIProvider } from "../services/ai/openaiProvider.js";

const schema = z.object({ answer: z.string() });
let server, baseURL, handler, lastRequest;

before(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      lastRequest = { url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null };
      handler(req, res, lastRequest);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((r) => server.close(r)));
beforeEach(() => { lastRequest = null; });

const json = (res, status, obj, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(obj));
};
const anthropicMessage = (text, extra = {}) => ({
  id: "msg_1", type: "message", role: "assistant", model: "claude-test",
  content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 }, ...extra,
});
const anthropicError = (type, message = "x") => ({ type: "error", error: { type, message } });

describe("Anthropic provider", () => {
  const make = (overrides = {}) => createAnthropicProvider({
    apiKey: "test-key", model: "claude-haiku-5-5", timeoutMs: 2000, maxRetries: 0, baseURL, ...overrides,
  });

  test("sends a structured-output request and parses the JSON result", async () => {
    handler = (req, res) => json(res, 200, anthropicMessage('{"answer":"blue blazer"}'));
    const out = await make().generateJSON({ system: "sys", prompt: "hello", schema });
    assert.deepEqual(out.data, { answer: "blue blazer" });
    assert.deepEqual(out.usage, { inputTokens: 10, outputTokens: 5 });
    assert.equal(lastRequest.url, "/v1/messages");
    assert.equal(lastRequest.headers.authorization, "Bearer test-key");
    assert.equal(lastRequest.body.output_config.format.type, "json_schema");
    assert.equal(lastRequest.body.output_config.format.schema.additionalProperties, false);
    assert.equal(lastRequest.body.system, "sys");
    assert.equal(lastRequest.body.fallbacks, undefined);
  });

  test("uses the server-side refusal fallback for supported models", async () => {
    handler = (req, res) => json(res, 200, anthropicMessage('{"answer":"ok"}'));
    await make({ model: "claude-opus-5-5", refusalFallback: true }).generateJSON({ system: "s", prompt: "p", schema });
    assert.equal(lastRequest.url, "/v1/messages");
    assert.equal(lastRequest.body.fallbacks, "default");
    assert.match(lastRequest.headers["anthropic-beta"], /server-side-fallback-2026-07-01/);
  });

  test("sends images as base64 content blocks", async () => {
    handler = (req, res) => json(res, 200, anthropicMessage('{"answer":"ok"}'));
    await make().generateJSON({ system: "s", prompt: "p", schema, images: [{ mediaType: "image/png", base64: "AAAA" }] });
    const [img, text] = lastRequest.body.messages[0].content;
    assert.deepEqual(img, { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } });
    assert.equal(text.type, "text");
  });

  const cases = [
    ["rate limit", 429, anthropicError("rate_limit_error"), "AI_RATE_LIMITED", { "retry-after": "17" }],
    ["auth failure", 401, anthropicError("authentication_error"), "AI_AUTH_FAILED"],
    ["overload", 529, anthropicError("overloaded_error"), "AI_UNAVAILABLE"],
    ["server error", 500, anthropicError("api_error"), "AI_UNAVAILABLE"],
    ["bad request", 400, anthropicError("invalid_request_error"), "AI_BAD_OUTPUT"],
  ];
  for (const [name, status, body, code, headers] of cases) {
    test(`maps ${name} to ${code}`, async () => {
      handler = (req, res) => json(res, status, body, headers);
      await assert.rejects(make().generateJSON({ system: "s", prompt: "p", schema }), (e) => {
        assert.equal(e.code, code);
        if (headers?.["retry-after"]) assert.equal(e.retryAfter, 17);
        return true;
      });
    });
  }

  test("maps a slow response to AI_TIMEOUT", async () => {
    handler = (req, res) => setTimeout(() => json(res, 200, anthropicMessage("{}")), 500);
    await assert.rejects(make({ timeoutMs: 100 }).generateJSON({ system: "s", prompt: "p", schema }), (e) => e.code === "AI_TIMEOUT");
  });

  test("retries transient failures a bounded number of times", async () => {
    let hits = 0;
    handler = (req, res) => (++hits < 2
      ? json(res, 500, anthropicError("api_error"), { "retry-after-ms": "1" })
      : json(res, 200, anthropicMessage('{"answer":"ok"}')));
    const out = await make({ maxRetries: 2 }).generateJSON({ system: "s", prompt: "p", schema });
    assert.equal(out.data.answer, "ok");
    assert.equal(hits, 2);
  });

  test("handles refusals, truncation and non-JSON output", async () => {
    handler = (req, res) => json(res, 200, anthropicMessage("", { content: [], stop_reason: "refusal" }));
    await assert.rejects(make().generateJSON({ system: "s", prompt: "p", schema }), (e) => e.code === "AI_REFUSED");
    handler = (req, res) => json(res, 200, anthropicMessage('{"answer":"cut', { stop_reason: "max_tokens" }));
    await assert.rejects(make().generateJSON({ system: "s", prompt: "p", schema }), (e) => e.code === "AI_BAD_OUTPUT");
    handler = (req, res) => json(res, 200, anthropicMessage("Sure! Here is an outfit..."));
    await assert.rejects(make().generateJSON({ system: "s", prompt: "p", schema }), (e) => e.code === "AI_BAD_OUTPUT");
  });
});

describe("OpenAI-compatible provider", () => {
  const make = (overrides = {}) => createOpenAIProvider({
    apiKey: "sk-test", model: "test-model", timeoutMs: 2000, maxRetries: 0, baseURL: `${baseURL}/v1`, ...overrides,
  });
  const completion = (content, extra = {}) => ({
    id: "c1", object: "chat.completion", created: 0, model: "test-model",
    choices: [{ index: 0, message: { role: "assistant", content, refusal: null }, finish_reason: "stop", ...extra }],
    usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
  });

  test("sends a json_schema response_format and parses the result", async () => {
    handler = (req, res) => json(res, 200, completion('{"answer":"linen shirt"}'));
    const out = await make().generateJSON({ system: "sys", prompt: "hello", schema });
    assert.deepEqual(out.data, { answer: "linen shirt" });
    assert.equal(lastRequest.url, "/v1/chat/completions");
    assert.equal(lastRequest.headers.authorization, "Bearer sk-test");
    assert.equal(lastRequest.body.response_format.type, "json_schema");
    assert.equal(lastRequest.body.messages[0].role, "system");
  });

  test("uses max_tokens for third-party compatible servers and max_completion_tokens for OpenAI", async () => {
    handler = (req, res) => json(res, 200, completion('{"answer":"ok"}'));
    await make().generateJSON({ system: "s", prompt: "p", schema, maxTokens: 1234 });
    assert.equal(lastRequest.body.max_tokens, 1234);
    assert.equal(lastRequest.body.max_completion_tokens, undefined);
  });

  test("json_object mode puts the schema in the instructions for providers without strict schemas", async () => {
    handler = (req, res) => json(res, 200, completion('{"answer":"ok"}'));
    const out = await make({ jsonMode: "json_object" }).generateJSON({ system: "sys", prompt: "p", schema });
    assert.deepEqual(out.data, { answer: "ok" });
    assert.deepEqual(lastRequest.body.response_format, { type: "json_object" });
    assert.match(lastRequest.body.messages[0].content, /^sys\n\nRespond with a single JSON object/);
    assert.match(lastRequest.body.messages[0].content, /"answer"/);
  });

  test("maps errors, refusals and truncation", async () => {
    handler = (req, res) => json(res, 429, { error: { message: "slow down" } });
    await assert.rejects(make().generateJSON({ system: "s", prompt: "p", schema }), (e) => e.code === "AI_RATE_LIMITED");
    handler = (req, res) => setTimeout(() => json(res, 200, completion("{}")), 500);
    await assert.rejects(make({ timeoutMs: 100 }).generateJSON({ system: "s", prompt: "p", schema }), (e) => e.code === "AI_TIMEOUT");
    handler = (req, res) => json(res, 200, completion(null, { message: { role: "assistant", content: null, refusal: "no" } }));
    await assert.rejects(make().generateJSON({ system: "s", prompt: "p", schema }), (e) => e.code === "AI_REFUSED");
    handler = (req, res) => json(res, 200, completion('{"ans', { finish_reason: "length" }));
    await assert.rejects(make().generateJSON({ system: "s", prompt: "p", schema }), (e) => e.code === "AI_BAD_OUTPUT");
  });
});
