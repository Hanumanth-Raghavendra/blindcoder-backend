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

  let code = "";
  let lang = "";
  const closed = clean.match(/```[ \t]*([\w#+.-]*)[^\n]*\n([\s\S]*?)```/);
  const open = clean.match(/```[ \t]*([\w#+.-]*)[^\n]*\n([\s\S]*)$/);
  if (closed) {
    [, lang, code] = closed;
  } else if (open) {
    [, lang, code] = open;
  } else {
    code = clean.replace(/^\s*\**SUMMARY\**\s*:.*$/im, "");
  }

  code = code.replace(/\s+$/, "").replace(/^\n+/, "");
  const language = normalizeLanguage(lang) || detectLanguage(code) || normalizeLanguage(fallbackLanguage) || "";

  return { code, language, summary };
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
