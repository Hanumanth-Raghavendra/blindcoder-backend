import { LruCache } from "../utils/cache.js";
import { normalizeLanguage, detectLanguage } from "../utils/language.js";
import { parseCodeResponse, toSpeech } from "../ai/parse.js";
import {
  GENERATE_SYSTEM,
  FIX_SYSTEM,
  EXPLAIN_ERROR_SYSTEM,
  DESCRIBE_CODE_SYSTEM,
  generateUserMessage,
  fixUserMessage,
  explainUserMessage,
} from "../ai/prompts.js";

const CODE_REQUEST = { temperature: 0.2, maxTokens: 8192 };
const PROSE_REQUEST = { temperature: 0.3, maxTokens: 2048 };

/** High-level BlindCoder AI tasks on top of the provider router. */
export function createAssistant(router, { cache = new LruCache() } = {}) {
  const meta = (r) => ({ provider: r.provider, providerLabel: r.providerLabel, model: r.model, ms: r.ms });

  async function cached(key, fn) {
    const hit = cache.get(key);
    if (hit) return { ...hit, cached: true, ms: 0 };
    const value = await fn();
    cache.set(key, value);
    return value;
  }

  async function codeTask(system, user, fallbackLanguage) {
    const result = await router.complete({ system, user, ...CODE_REQUEST });
    const parsed = parseCodeResponse(result.text, fallbackLanguage);
    if (!parsed.code.trim()) {
      throw Object.assign(new Error("The AI did not return any code. Try rephrasing your request."), { status: 502 });
    }
    return { ...parsed, ...meta(result) };
  }

  return {
    // Generation and fixes are never cached: if an answer was wrong, asking
    // again must be able to produce a different one.
    generate({ prompt, code = "", language = "" }) {
      const lang = normalizeLanguage(language) || detectLanguage(code);
      return codeTask(GENERATE_SYSTEM, generateUserMessage({ prompt, code, language: lang }), lang);
    },

    fix({ code, error = "", language = "" }) {
      const lang = normalizeLanguage(language) || detectLanguage(code);
      return codeTask(FIX_SYSTEM, fixUserMessage({ code, error, language: lang }), lang);
    },

    explain({ code = "", error = "", language = "" }) {
      const lang = normalizeLanguage(language) || detectLanguage(code);
      return cached(LruCache.key("explain", code, error, lang), async () => {
        const result = await router.complete({
          system: error ? EXPLAIN_ERROR_SYSTEM : DESCRIBE_CODE_SYSTEM,
          user: explainUserMessage({ code, error, language: lang }),
          ...PROSE_REQUEST,
        });
        return { explanation: toSpeech(result.text), ...meta(result) };
      });
    },
  };
}
