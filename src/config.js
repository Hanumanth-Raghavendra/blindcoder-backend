import "dotenv/config";

const list = (value, fallback) =>
  value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : fallback;

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Every provider below has a genuinely free tier. As long as you never attach
 * a billing account / buy credits, none of them can charge you — requests just
 * get rate-limited, and BlindCoder silently fails over to the next provider.
 */
export const config = {
  port: num(process.env.PORT, 5000),

  // Comma-separated list of allowed browser origins. Empty = allow all
  // (abuse is controlled by the per-IP rate limiter, not CORS).
  allowedOrigins: list(process.env.ALLOWED_ORIGINS, []),

  // Order in which AI providers are tried. Missing API keys are skipped.
  providerOrder: list(process.env.AI_PROVIDER_ORDER, ["gemini", "groq", "openrouter"]),

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    // "-latest" aliases always point at Google's newest Flash model, so they
    // never get deprecated out from under you. A pinned stable model sits
    // behind it in case the newest release is overloaded; if it is ever
    // retired, the router just skips it.
    models: list(process.env.GEMINI_MODELS, ["gemini-flash-latest", "gemini-3.6-flash", "gemini-flash-lite-latest"]),
    timeoutMs: num(process.env.GEMINI_TIMEOUT_MS, 12000),
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: "https://api.groq.com/openai/v1",
    // Preferred models, best first. The live model list is checked at runtime,
    // so a retired model is skipped automatically.
    models: list(process.env.GROQ_MODELS, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]),
    timeoutMs: num(process.env.GROQ_TIMEOUT_MS, 12000),
    discoverModels: true,
  },

  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: "https://openrouter.ai/api/v1",
    // "openrouter/free" routes to whichever free model is up. Only free models,
    // so it can never cost anything.
    models: list(process.env.OPENROUTER_MODELS, ["openrouter/free"]),
    timeoutMs: num(process.env.OPENROUTER_TIMEOUT_MS, 30000),
    discoverModels: false,
  },

  runner: {
    baseUrl: process.env.WANDBOX_URL || "https://wandbox.org/api",
    timeoutMs: num(process.env.RUNNER_TIMEOUT_MS, 30000),
  },

  limits: {
    aiPerMinute: num(process.env.AI_RATE_PER_MIN, 20),
    runPerMinute: num(process.env.RUN_RATE_PER_MIN, 30),
    maxPromptChars: 2000,
    maxCodeChars: 30000,
  },
};
