import { fetchJson, HttpError } from "../../utils/http.js";

/** Google Gemini (AI Studio free tier). Uses raw REST so model aliases like
 * "gemini-flash-latest" work without SDK upgrades. */
export function createGeminiProvider({ apiKey, baseUrl, models, timeoutMs }) {
  // Remember models that rejected the thinking config so we stop sending it.
  const noThinkingConfig = new Set();

  async function call(model, { system, user, temperature, maxTokens }, withThinking) {
    const generationConfig = { temperature, maxOutputTokens: maxTokens };
    // Low thinking keeps Gemini 3.x fast while staying accurate for code.
    if (withThinking) generationConfig.thinkingConfig = { thinkingLevel: "low" };

    const data = await fetchJson(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      timeoutMs,
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig,
      }),
    });

    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts || [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join("")
      .trim();

    if (!text) {
      const reason = candidate?.finishReason || data.promptFeedback?.blockReason || "empty response";
      throw new HttpError(`Gemini returned no text (${reason})`, { status: 502 });
    }
    return { text, model: data.modelVersion || model };
  }

  return {
    name: "gemini",
    label: "Google Gemini",
    enabled: Boolean(apiKey),
    async listModels() {
      return models;
    },
    async complete(model, request) {
      const useThinking = !noThinkingConfig.has(model);
      try {
        return await call(model, request, useThinking);
      } catch (err) {
        // Older/other models reject thinkingLevel with a 400 — retry without it.
        if (useThinking && err.status === 400 && /think/i.test(err.message)) {
          noThinkingConfig.add(model);
          return call(model, request, false);
        }
        throw err;
      }
    },
  };
}
