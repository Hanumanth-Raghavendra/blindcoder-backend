import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { AiRouter } from "../src/ai/router.js";

let server;
let base;
let lastRequest;

before(async () => {
  const provider = {
    name: "fake",
    label: "Fake",
    enabled: true,
    async listModels() {
      return ["m"];
    },
    async complete(_model, request) {
      lastRequest = request;
      if (request.system.includes("read aloud by a screen reader")) return { text: "**Line 2** is missing a colon.", model: "m" };
      return { text: "SUMMARY: Prints hello.\n```python\nprint('hello')\n```", model: "m" };
    },
  };
  const runner = { run: async ({ language }) => ({ ok: true, output: `ran ${language}`, error: "" }) };
  const { app } = createApp({ router: new AiRouter([provider], { log: { info() {}, warn() {} } }), runner });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const post = (path, body) =>
  fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("health", async () => {
  const r = await (await fetch(base + "/api/health")).json();
  assert.deepEqual([r.ok, r.providers], [true, ["fake"]]);
});

test("generate returns code, language and spoken summary", async () => {
  const res = await post("/api/generate", { prompt: "say hello", code: "print(1)" });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual([body.code, body.language, body.summary, body.provider], ["print('hello')", "python", "Prints hello.", "fake"]);
  assert.match(lastRequest.user, /CURRENT CODE \(python\)/, "current code is sent as context for edits");
});

test("generate validates input", async () => {
  assert.equal((await post("/api/generate", {})).status, 400);
  assert.equal((await post("/api/generate", { prompt: "x".repeat(5000) })).status, 400);
});

test("explain accepts the old errMsg field and returns speech-safe text", async () => {
  const body = await (await post("/api/explain", { errMsg: "SyntaxError", code: "if x print(1)" })).json();
  assert.equal(body.explanation, "Line 2 is missing a colon.");
});

test("fix and run", async () => {
  assert.equal((await (await post("/api/fix", { code: "print(", error: "SyntaxError" })).json()).code, "print('hello')");
  assert.equal((await (await post("/api/run", { code: "x", language: "go" })).json()).output, "ran go");
});

test("bad JSON is a 400, not a crash", async () => {
  const res = await fetch(base + "/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(res.status, 400);
});
