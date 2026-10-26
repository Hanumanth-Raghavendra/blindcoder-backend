/** Error carrying an HTTP status (or 0 for network/timeout failures). */
export class HttpError extends Error {
  constructor(message, { status = 0, retryAfterMs = 0, body } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.body = body;
  }
}

function parseRetryAfter(header) {
  if (!header) return 0;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.min(secs * 1000, 10 * 60 * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

/**
 * fetch() + JSON + timeout. Throws HttpError on non-2xx, network errors and
 * timeouts so callers can decide whether to fail over.
 */
export async function fetchJson(url, { timeoutMs = 15000, ...init } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const timedOut = err.name === "AbortError";
    throw new HttpError(timedOut ? `Timed out after ${timeoutMs}ms` : `Network error: ${err.message}`, {
      status: 0,
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message =
      data?.error?.message || data?.error || data?.message || `HTTP ${res.status}`;
    throw new HttpError(String(message), {
      status: res.status,
      retryAfterMs: parseRetryAfter(res.headers.get("retry-after")),
      body: data,
    });
  }
  return data;
}
