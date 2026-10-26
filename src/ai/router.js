import { config as defaultConfig } from "../config.js";
import { createGeminiProvider } from "./providers/gemini.js";
import { createOpenAICompatibleProvider } from "./providers/openaiCompatible.js";

/** How long to skip a provider/model after a given kind of failure. */
function cooldownFor(err) {
  const s = err.status;
  if (s === 429) return Math.max(err.retryAfterMs || 0, 60_000); // free-tier quota hit
  if (s === 401 || s === 403) return 10 * 60_000; // bad / missing key
  if (s === 404) return 6 * 60 * 60_000; // model retired
  if (s === 400) return 0; // request-specific; don't punish the provider
  return 30_000; // 5xx, timeout, network
}

export function createProviders(cfg = defaultConfig) {
  const all = {
    gemini: createGeminiProvider(cfg.gemini),
    groq: createOpenAICompatibleProvider({ name: "groq", label: "Groq", ...cfg.groq }),
    openrouter: createOpenAICompatibleProvider({
      name: "openrouter",
      label: "OpenRouter",
      ...cfg.openrouter,
      extraHeaders: { "HTTP-Referer": "https://blindcoder.vercel.app", "X-Title": "BlindCoder" },
    }),
  };
  return cfg.providerOrder.map((n) => all[n]).filter((p) => p && p.enabled);
}

/**
 * Tries each provider/model in order with a timeout, and fails over instantly
 * on rate limits, outages, timeouts or retired models. A failing provider is
 * put on cooldown so the next request goes straight to a healthy one.
 */
export class AiRouter {
  constructor(providers, { log = console } = {}) {
    this.providers = providers;
    this.log = log;
    this.cooldownUntil = new Map(); // "provider/model" -> timestamp
  }

  get configured() {
    return this.providers.map((p) => p.name);
  }

  async candidates() {
    const out = [];
    for (const provider of this.providers) {
      const models = await provider.listModels();
      for (const model of models) out.push({ provider, model, key: `${provider.name}/${model}` });
    }
    return out;
  }

  async complete(request) {
    if (!this.providers.length) {
      throw Object.assign(
        new Error("No AI provider is configured. Set GEMINI_API_KEY and/or GROQ_API_KEY on the server."),
        { status: 500 },
      );
    }

    const now = Date.now();
    const all = await this.candidates();
    const healthy = all.filter((c) => (this.cooldownUntil.get(c.key) || 0) <= now);
    // If everything is cooling down, try them all anyway rather than fail fast.
    const queue = healthy.length ? healthy : all;

    const errors = [];
    const congested = new Set(); // providers that timed out during this request
    for (const { provider, model, key } of queue) {
      // A timeout usually means the whole provider is congested; don't make the
      // user wait through each of its models — move on to the next provider.
      if (congested.has(provider.name)) continue;
      const started = Date.now();
      try {
        const result = await provider.complete(model, request);
        this.cooldownUntil.delete(key);
        const ms = Date.now() - started;
        this.log.info?.(`[ai] ${key} ok in ${ms}ms`);
        return { ...result, provider: provider.name, providerLabel: provider.label, ms };
      } catch (err) {
        const wait = cooldownFor(err);
        if (wait) this.cooldownUntil.set(key, Date.now() + wait);
        if (err.status === 404) provider.forgetModels?.();
        if (err.status === 0 && /timed out/i.test(err.message)) congested.add(provider.name);
        errors.push(`${key}: ${err.status || "network"} ${err.message}`);
        this.log.warn?.(`[ai] ${key} failed (${err.status || "network"}): ${err.message}`);
      }
    }

    const error = new Error("All AI providers are busy right now. Please try again in a moment.");
    error.status = 503;
    error.details = errors;
    throw error;
  }
}
