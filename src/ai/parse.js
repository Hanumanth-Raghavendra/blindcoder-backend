import { detectLanguage, normalizeLanguage } from "../utils/language.js";

const stripThinking = (text) =>
  String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "")
    .trim();

/** Parse "SUMMARY: ...\n```lang\ncode\n```" into its parts, tolerating sloppy model output. */
export function parseCodeResponse(text, fallbackLanguage = "") {
  const clean = stripThinking(text);

  const summaryMatch = clean.match(/^\s*\**SUMMARY\**\s*:\s*(.+)$/im);
  const summary = summaryMatch ? toSpeech(summaryMatch[1]) : "";
  const fileMatch = clean.match(/^\s*\**FILE ?NAME\**\s*:\s*(.+)$/im);

  let code = "";
  let lang = "";
  const closed = clean.match(/```[ \t]*([\w#+.-]*)[^\n]*\n([\s\S]*?)```/);
  const open = clean.match(/```[ \t]*([\w#+.-]*)[^\n]*\n([\s\S]*)$/);
  if (closed) {
    [, lang, code] = closed;
  } else if (open) {
    [, lang, code] = open;
  } else {
    code = clean.replace(/^\s*\**(SUMMARY|FILE ?NAME)\**\s*:.*$/gim, "");
  }

  code = code.replace(/\s+$/, "").replace(/^\n+/, "");
  const language = normalizeLanguage(lang) || detectLanguage(code) || normalizeLanguage(fallbackLanguage) || "";

  // Java must be saved under its public class name or it won't compile.
  const javaClass = language === "java" && code.match(/public\s+(?:final\s+|abstract\s+)?class\s+(\w+)/)?.[1];
  const filename = javaClass || toFileStem(fileMatch?.[1]);

  return { code, language, summary, filename };
}

/** "Prime Numbers.py" / "prime-numbers" / "`primeNumbers`" -> "prime_numbers" */
export function toFileStem(raw) {
  const stem = String(raw || "")
    .replace(/[`"'*]/g, "")
    .trim()
    .replace(/\.[a-z0-9+#]{1,6}$/i, "") // drop any extension the model added
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // camelCase -> camel_case
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/, "");
  return stem;
}

/** Make model prose safe and pleasant for text-to-speech. */
export function toSpeech(text) {
  return stripThinking(text)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*]+/g, "")
    .replace(/^\s*[#>]+\s*/gm, "")
    .replace(/\b__(\w+)__\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
