import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCodeResponse, toSpeech } from "../src/ai/parse.js";
import { detectLanguage, normalizeLanguage } from "../src/utils/language.js";

test("parses summary, language and code", () => {
  const r = parseCodeResponse("SUMMARY: Prints the factorial of 5, which is 120.\n```python\nprint(120)\n```");
  assert.equal(r.summary, "Prints the factorial of 5, which is 120.");
  assert.equal(r.language, "python");
  assert.equal(r.code, "print(120)");
});

test("normalizes language aliases from the fence", () => {
  assert.equal(parseCodeResponse("```c++\nint main(){}\n```").language, "cpp");
  assert.equal(parseCodeResponse("```cs\nclass Program{}\n```").language, "csharp");
  assert.equal(parseCodeResponse("```js\nconsole.log(1)\n```").language, "javascript");
});

test("handles unterminated fences and think tags", () => {
  const r = parseCodeResponse("<think>hmm</think>SUMMARY: x\n```java\npublic class Main {}\n");
  assert.equal(r.language, "java");
  assert.equal(r.code, "public class Main {}");
});

test("handles bare code without fences", () => {
  const r = parseCodeResponse("console.log('hi')");
  assert.equal(r.code, "console.log('hi')");
  assert.equal(r.language, "javascript");
});

test("detects languages heuristically", () => {
  assert.equal(detectLanguage('#include <stdio.h>\nint main(){printf("x");}'), "c");
  assert.equal(detectLanguage("#include <iostream>\nint main(){std::cout<<1;}"), "cpp");
  assert.equal(detectLanguage("public class Main { public static void main(String[] a){} }"), "java");
  assert.equal(detectLanguage("package main\nimport \"fmt\"\nfunc main(){fmt.Println(1)}"), "go");
  assert.equal(detectLanguage('fn main() { println!("x"); }'), "rust");
  assert.equal(detectLanguage("def f(n):\n    return n\nprint(f(2))"), "python");
  assert.equal(normalizeLanguage("Python3"), "python");
  assert.equal(normalizeLanguage("klingon"), "");
});

test("toSpeech strips markdown but keeps identifiers", () => {
  assert.equal(toSpeech("**Line 3**: `my_var` is undefined"), "Line 3: my_var is undefined");
});
