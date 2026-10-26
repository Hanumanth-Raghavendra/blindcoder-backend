import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createGeminiProvider } from "../src/ai/providers/gemini.js";
import { createOpenAICompatibleProvider } from "../src/ai/providers/openaiCompatible.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const req = { system: "sys", user: "hi", temperature: 0.2, maxTokens: 100 };

test("gemini: sends key in header, skips thought parts", async () => {
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) };
    return json(200, {
      modelVersion: "gemini-3.8-flash",
      candidates: [{ content: { parts: [{ text: "thinking...", thought: true }, { text: "answer" }] } }],
    });
  };
  const p = createGeminiProvider({ apiKey: "k", baseUrl: "https://g", models: ["gemini-flash-latest"], timeoutMs: 1000 });
  const r = await p.complete("gemini-flash-latest", req);
  assert.equal(r.text, "answer");
  assert.equal(r.model, "gemini-3.8-flash");
  assert.equal(seen.init.headers["x-goog-api-key"], "k");
  assert.ok(!seen.url.includes("key="), "API key must not be in the URL");
  assert.equal(seen.body.generationConfig.thinkingConfig.thinkingLevel, "low");
  assert.equal(seen.body.systemInstruction.parts[0].text, "sys");
});

test("gemini: retries without thinking config when a model rejects it", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    if (body.generationConfig.thinkingConfig) return json(400, { error: { message: "thinking_level is not supported" } });
    return json(200, { candidates: [{ content: { parts: [{ text: "ok" }] } }] });
  };
  const p = createGeminiProvider({ apiKey: "k", baseUrl: "https://g", models: ["m"], timeoutMs: 1000 });
  assert.equal((await p.complete("m", req)).text, "ok");
  assert.equal((await p.complete("m", req)).text, "ok");
  assert.equal(bodies.length, 3, "second call should skip thinking config directly");
});

test("gemini: surfaces 429 with retry-after", async () => {
  globalThis.fetch = async () => json(429, { error: { message: "quota" } }, { "retry-after": "30" });
  const p = createGeminiProvider({ apiKey: "k", baseUrl: "https://g", models: ["m"], timeoutMs: 1000 });
  await assert.rejects(p.complete("m", req), (e) => e.status === 429 && e.retryAfterMs === 30000);
});

test("timeouts become status 0 errors", async () => {
  globalThis.fetch = (_url, init) =>
    new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("a"), { name: "AbortError" }))));
  const p = createGeminiProvider({ apiKey: "k", baseUrl: "https://g", models: ["m"], timeoutMs: 20 });
  await assert.rejects(p.complete("m", req), (e) => e.status === 0 && /Timed out/.test(e.message));
});

test("openai-compatible: discovers live models, drops retired ones", async () => {
  globalThis.fetch = async (url) => {
    if (url.endsWith("/models")) return json(200, { data: [{ id: "openai/gpt-oss-20b" }, { id: "whisper-large-v3" }] });
    throw new Error("unexpected");
  };
  const p = createOpenAICompatibleProvider({
    name: "groq",
    label: "Groq",
    apiKey: "k",
    baseUrl: "https://q",
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    timeoutMs: 1000,
    discoverModels: true,
  });
  assert.deepEqual(await p.listModels(), ["openai/gpt-oss-20b"]);
});

test("openai-compatible: self-heals when every preferred model is gone", async () => {
  globalThis.fetch = async () =>
    json(200, { data: [{ id: "whisper-large-v3" }, { id: "qwen/qwen9-32b" }, { id: "some-llama-70b" }] });
  const p = createOpenAICompatibleProvider({
    name: "groq", label: "Groq", apiKey: "k", baseUrl: "https://q", models: ["gone"], timeoutMs: 1000, discoverModels: true,
  });
  assert.deepEqual(await p.listModels(), ["some-llama-70b", "qwen/qwen9-32b"]);
});

test("openai-compatible: sets low reasoning for gpt-oss and parses content", async () => {
  let body;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return json(200, { model: "openai/gpt-oss-120b", choices: [{ message: { content: " code " } }] });
  };
  const p = createOpenAICompatibleProvider({ name: "groq", label: "Groq", apiKey: "k", baseUrl: "https://q", models: [], timeoutMs: 1000 });
  const r = await p.complete("openai/gpt-oss-120b", req);
  assert.equal(r.text, "code");
  assert.equal(body.reasoning_effort, "low");
  assert.equal(body.messages[0].role, "system");
});
