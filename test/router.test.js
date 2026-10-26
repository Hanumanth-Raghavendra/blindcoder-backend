import { test } from "node:test";
import assert from "node:assert/strict";
import { AiRouter } from "../src/ai/router.js";

const quiet = { info() {}, warn() {} };

function fakeProvider(name, models, behaviour) {
  const calls = [];
  return {
    name,
    label: name,
    enabled: true,
    calls,
    async listModels() {
      return models;
    },
    async complete(model, req) {
      calls.push(model);
      return behaviour(model, req, calls.length);
    },
  };
}

const fail = (status, message = "boom") => {
  throw Object.assign(new Error(message), { status });
};

test("uses the first provider when healthy", async () => {
  const a = fakeProvider("a", ["a1"], () => ({ text: "A", model: "a1" }));
  const b = fakeProvider("b", ["b1"], () => ({ text: "B", model: "b1" }));
  const r = await new AiRouter([a, b], { log: quiet }).complete({});
  assert.equal(r.text, "A");
  assert.equal(r.provider, "a");
  assert.equal(b.calls.length, 0);
});

test("fails over on 429 and skips the cooling-down provider next time", async () => {
  const a = fakeProvider("a", ["a1"], () => fail(429, "quota"));
  const b = fakeProvider("b", ["b1"], () => ({ text: "B", model: "b1" }));
  const router = new AiRouter([a, b], { log: quiet });
  assert.equal((await router.complete({})).provider, "b");
  assert.equal((await router.complete({})).provider, "b");
  assert.equal(a.calls.length, 1, "provider on cooldown should not be retried immediately");
});

test("tries the next model of the same provider (e.g. retired alias)", async () => {
  const a = fakeProvider("a", ["old", "new"], (m) => (m === "old" ? fail(404, "not found") : { text: "ok", model: m }));
  const r = await new AiRouter([a], { log: quiet }).complete({});
  assert.equal(r.model, "new");
});

test("fails over on timeouts / network errors (status 0)", async () => {
  const a = fakeProvider("a", ["a1"], () => fail(0, "Timed out"));
  const b = fakeProvider("b", ["b1"], () => ({ text: "B", model: "b1" }));
  assert.equal((await new AiRouter([a, b], { log: quiet }).complete({})).provider, "b");
});

test("when every provider is cooling down it still tries them", async () => {
  let n = 0;
  const a = fakeProvider("a", ["a1"], () => (++n === 1 ? fail(503) : { text: "A", model: "a1" }));
  const router = new AiRouter([a], { log: quiet });
  await assert.rejects(router.complete({}), /busy/);
  assert.equal((await router.complete({})).text, "A");
});

test("throws a friendly 503 when all fail", async () => {
  const a = fakeProvider("a", ["a1"], () => fail(500));
  await assert.rejects(new AiRouter([a], { log: quiet }).complete({}), (e) => e.status === 503);
});

test("explains missing configuration", async () => {
  await assert.rejects(new AiRouter([], { log: quiet }).complete({}), /GEMINI_API_KEY/);
});
