import { fetchJson } from "../utils/http.js";
import { normalizeLanguage } from "../utils/language.js";

/**
 * Runs code on Wandbox (https://wandbox.org) — a free, public, sandboxed
 * compiler service supporting dozens of languages. No API key needed.
 */

// BlindCoder language id -> Wandbox "language" field (case-insensitive).
const WANDBOX_LANGUAGE = {
  c: "C",
  cpp: "C++",
  java: "Java",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  ruby: "Ruby",
  php: "PHP",
  perl: "Perl",
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  swift: "Swift",
  scala: "Scala",
  haskell: "Haskell",
  lua: "Lua",
  r: "R",
  bash: "Bash script",
  sql: "SQL",
  elixir: "Elixir",
  erlang: "Erlang",
  julia: "Julia",
  d: "D",
  nim: "Nim",
  zig: "Zig",
  ocaml: "OCaml",
  pascal: "Pascal",
  groovy: "Groovy",
  lisp: "Lisp",
  kotlin: "Kotlin",
  dart: "Dart",
  fsharp: "F#",
};

// Used only if Wandbox's compiler list can't be fetched.
const FALLBACK_COMPILER = {
  c: "gcc-head-c",
  cpp: "gcc-head",
  java: "openjdk-head",
  csharp: "mono-head",
  go: "go-head",
  rust: "rust-head",
  ruby: "ruby-head",
  php: "php-head",
  perl: "perl-head",
  python: "cpython-head",
  javascript: "nodejs-head",
  typescript: "typescript-head",
  swift: "swift-head",
  haskell: "ghc-head",
  lua: "lua-head",
  bash: "bash",
};

const LIST_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_OUTPUT = 12000;

const clip = (s) => {
  const text = String(s || "");
  return text.length > MAX_OUTPUT ? text.slice(0, MAX_OUTPUT) + "\n… (output truncated)" : text;
};

/** Wandbox compiles Java as prog.java, so run the class holding main() as "prog". */
export function prepareJava(code) {
  const mainClass = code.match(/class\s+(\w+)[^{]*\{(?:(?!\bclass\s)[\s\S])*?\bstatic\s+void\s+main\s*\(/);
  if (!mainClass || mainClass[1] === "prog") return code;
  return code.replace(new RegExp(`\\b${mainClass[1]}\\b`, "g"), "prog");
}

export function createRunner({ baseUrl, timeoutMs }) {
  let compilers = null;
  let fetchedAt = 0;

  async function compilerFor(language) {
    const target = WANDBOX_LANGUAGE[language]?.toLowerCase();
    if (!target) return null;

    if (!compilers || Date.now() - fetchedAt > LIST_TTL_MS) {
      try {
        compilers = await fetchJson(`${baseUrl}/list.json`, { timeoutMs: 10000 });
        fetchedAt = Date.now();
      } catch {
        compilers = compilers || [];
      }
    }

    const matches = (compilers || []).filter((c) => String(c.language || "").toLowerCase() === target);
    // Prefer the newest stable release over nightly "head" builds.
    const stable = matches.find((c) => !/head|dev|nightly/i.test(c.name));
    return stable?.name || matches[0]?.name || FALLBACK_COMPILER[language] || null;
  }

  return {
    supports(language) {
      return Boolean(WANDBOX_LANGUAGE[normalizeLanguage(language)]);
    },

    async run({ code, language }) {
      const lang = normalizeLanguage(language);
      const compiler = await compilerFor(lang);
      if (!compiler) {
        return {
          ok: false,
          unsupported: true,
          output: "",
          error: `Running ${language || "this language"} online isn't supported yet. Save the file and run it on your computer.`,
        };
      }

      const source = lang === "java" ? prepareJava(code) : code;
      const data = await fetchJson(`${baseUrl}/compile.json`, {
        method: "POST",
        timeoutMs,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compiler, code: source, stdin: "", save: false }),
      });

      const status = data.status === undefined ? null : Number(data.status);
      const compileError = (data.compiler_error || "").trim();
      const programError = (data.program_error || "").trim();
      const signal = data.signal || "";
      const ok = status === 0 && !signal;

      let error = "";
      if (!ok) {
        error =
          compileError ||
          programError ||
          (signal ? `Program was stopped (${signal}). It may have run too long or used too much memory.` : "") ||
          `Program exited with code ${status}.`;
      }

      return {
        ok,
        output: clip(data.program_output),
        error: clip(error),
        warnings: ok ? clip(compileError || programError) : "",
        exitCode: status,
        compiler,
      };
    },
  };
}
