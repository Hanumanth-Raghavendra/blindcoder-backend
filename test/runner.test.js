import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRunner, prepareJava } from "../src/services/runner.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const json = (status, body) => new Response(JSON.stringify(body), { status });

const LIST = [
  { name: "gcc-head", language: "C++" },
  { name: "gcc-13.2.0", language: "C++" },
  { name: "gcc-13.2.0-c", language: "C" },
  { name: "openjdk-jdk-22+36", language: "Java" },
];

test("picks a stable compiler and returns program output", async () => {
  let compileBody;
  globalThis.fetch = async (url, init) => {
    if (url.endsWith("/list.json")) return json(200, LIST);
    compileBody = JSON.parse(init.body);
    return json(200, { status: "0", program_output: "120\n" });
  };
  const r = await createRunner({ baseUrl: "https://w", timeoutMs: 1000 }).run({ code: "int main(){}", language: "cpp" });
  assert.equal(compileBody.compiler, "gcc-13.2.0");
  assert.deepEqual([r.ok, r.output], [true, "120\n"]);
});

test("reports compile errors", async () => {
  globalThis.fetch = async (url) =>
    url.endsWith("/list.json") ? json(200, LIST) : json(200, { status: "1", compiler_error: "prog.c:3: error: expected ';'" });
  const r = await createRunner({ baseUrl: "https://w", timeoutMs: 1000 }).run({ code: "x", language: "c" });
  assert.equal(r.ok, false);
  assert.match(r.error, /expected ';'/);
});

test("reports signals (infinite loops)", async () => {
  globalThis.fetch = async (url) => (url.endsWith("/list.json") ? json(200, LIST) : json(200, { signal: "Killed" }));
  const r = await createRunner({ baseUrl: "https://w", timeoutMs: 1000 }).run({ code: "x", language: "cpp" });
  assert.equal(r.ok, false);
  assert.match(r.error, /stopped/);
});

test("renames the Java main class for Wandbox's prog.java", () => {
  const src = 'public class Main {\n  public static void main(String[] a) { System.out.println("Main"); }\n}';
  assert.match(prepareJava(src), /public class prog \{/);
  const helper = "class Helper { int x; }\npublic class App { public static void main(String[] a){ new Helper(); } }";
  const out = prepareJava(helper);
  assert.match(out, /class Helper/);
  assert.match(out, /public class prog/);
});

test("unsupported language returns a friendly message without calling out", async () => {
  globalThis.fetch = async () => {
    throw new Error("should not fetch");
  };
  const r = await createRunner({ baseUrl: "https://w", timeoutMs: 1000 }).run({ code: "x", language: "cobol" });
  assert.equal(r.unsupported, true);
});
