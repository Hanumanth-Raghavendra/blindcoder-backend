/** Canonical language ids used across BlindCoder. */
const ALIASES = {
  python: "python", python3: "python", py: "python",
  javascript: "javascript", js: "javascript", node: "javascript", nodejs: "javascript",
  typescript: "typescript", ts: "typescript",
  c: "c",
  cpp: "cpp", "c++": "cpp", cxx: "cpp", cc: "cpp",
  java: "java",
  csharp: "csharp", "c#": "csharp", cs: "csharp",
  go: "go", golang: "go",
  rust: "rust", rs: "rust",
  ruby: "ruby", rb: "ruby",
  php: "php",
  perl: "perl", pl: "perl",
  swift: "swift",
  kotlin: "kotlin", kt: "kotlin",
  scala: "scala",
  haskell: "haskell", hs: "haskell",
  lua: "lua",
  r: "r",
  bash: "bash", sh: "bash", shell: "bash", zsh: "bash",
  sql: "sql", sqlite: "sql",
  elixir: "elixir", ex: "elixir",
  erlang: "erlang",
  julia: "julia", jl: "julia",
  dart: "dart",
  d: "d",
  nim: "nim",
  zig: "zig",
  ocaml: "ocaml", ml: "ocaml",
  pascal: "pascal",
  groovy: "groovy",
  lisp: "lisp", "common-lisp": "lisp",
  fsharp: "fsharp", "f#": "fsharp",
};

export const SUPPORTED_LANGUAGES = [...new Set(Object.values(ALIASES))];

export function normalizeLanguage(lang) {
  if (!lang) return "";
  const key = String(lang).trim().toLowerCase();
  return ALIASES[key] || "";
}

/** Best-effort guess when the model (or a human) didn't say which language. */
export function detectLanguage(code = "") {
  const c = code;
  if (/^\s*#include\s*<iostream>|std::|cout\s*<</m.test(c)) return "cpp";
  if (/^\s*#include\s*[<"]/m.test(c)) return "c";
  if (/\bpublic\s+static\s+void\s+main\s*\(/.test(c) || /System\.out\.print/.test(c)) return "java";
  if (/\bstatic\s+void\s+Main\s*\(|Console\.Write/.test(c)) return "csharp";
  if (/^\s*package\s+main\b|fmt\.Print/m.test(c)) return "go";
  if (/\bfn\s+main\s*\(|println!\s*\(/.test(c)) return "rust";
  if (/<\?php/.test(c)) return "php";
  if (/^\s*(def|class)\s+\w+.*:\s*$|^\s*print\s*\(|^\s*import\s+\w+\s*$|^\s*from\s+\w+\s+import\s/m.test(c))
    return "python";
  if (/\bconsole\.log\s*\(|\b(let|const)\s+\w+\s*=|=>|function\s+\w+\s*\(/.test(c)) return "javascript";
  if (/^\s*puts\s|\bend\s*$/m.test(c)) return "ruby";
  if (/^\s*use\s+strict;|^\s*my\s+\$/m.test(c)) return "perl";
  return "";
}
