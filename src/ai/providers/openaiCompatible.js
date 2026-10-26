import { fetchJson } from "../../utils/http.js";

const CHAT_MODEL = /gpt-oss|qwen|llama|kimi|deepseek|mistral|gemma|glm|coder/i;
const NON_CHAT = /whisper|guard|tts|orpheus|embed|safeguard|compound|vision|audio/i;
const DISCOVERY_TTL_MS = 6 * 60 * 60 * 1000;

/** Any OpenAI-compatible chat API (Groq, OpenRouter, ...). */
export function createOpenAICompatibleProvider({
  name,
  label,
  apiKey,
  baseUrl,
  models,
  timeoutMs,
  discoverModels = false,
  extraHeaders = {},
}) {
  let discovered = null;
  let discoveredAt = 0;

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...extraHeaders,
  });

  /**
   * Keep the preferred order, but drop models the provider no longer serves.
   * If none of the preferred models exist any more, fall back to whatever
   * chat models the provider currently offers — so deprecations self-heal.
   */
  async function listModels() {
    if (!discoverModels) return models;
    if (discovered && Date.now() - discoveredAt < DISCOVERY_TTL_MS) return discovered;
    try {
      const data = await fetchJson(`${baseUrl}/models`, { headers: headers(), timeoutMs: 8000 });
      const live = (data.data || []).map((m) => m.id).filter(Boolean);
      const preferred = models.filter((m) => live.includes(m));
      const others = live
        .filter((id) => CHAT_MODEL.test(id) && !NON_CHAT.test(id) && !preferred.includes(id))
        .sort((a, b) => sizeHint(b) - sizeHint(a));
      discovered = preferred.length ? preferred : others.slice(0, 3);
      if (!discovered.length) discovered = models;
    } catch {
      discovered = models; // Discovery failing must never block generation.
    }
    discoveredAt = Date.now();
    return discovered;
  }

  return {
    name,
    label,
    enabled: Boolean(apiKey),
    listModels,
    forgetModels() {
      discovered = null;
    },
    async complete(model, { system, user, temperature, maxTokens }) {
      const body = {
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      };
      // gpt-oss models reason before answering; "low" keeps them very fast.
      if (/gpt-oss/i.test(model)) body.reasoning_effort = "low";

      const data = await fetchJson(`${baseUrl}/chat/completions`, {
        method: "POST",
        timeoutMs,
        headers: headers(),
        body: JSON.stringify(body),
      });
      const text = data.choices?.[0]?.message?.content?.trim() || "";
      if (!text) throw Object.assign(new Error(`${label} returned an empty response`), { status: 502 });
      return { text, model: data.model || model };
    },
  };
}

function sizeHint(id) {
  const m = id.match(/(\d+(?:\.\d+)?)b\b/i);
  return m ? Number(m[1]) : 0;
}
