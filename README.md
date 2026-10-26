# BlindCoder — Backend

API for [BlindCoder](https://blindcoder.vercel.app), a voice-driven IDE for blind and visually impaired developers.

## What it does

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Health check (the frontend pings this on load to wake the server) |
| `POST /api/generate` `{ prompt, code?, language? }` | Writes a program, or **edits the current one** if `code` is sent. Returns `{ code, language, summary, provider, model, ms }` |
| `POST /api/fix` `{ code, error?, language? }` | Repairs broken code. Same response shape as generate |
| `POST /api/explain` `{ code, error?, language? }` | Explains an error (or, without `error`, what the code does) in 1–3 spoken sentences |
| `POST /api/run` `{ code, language }` | Runs C, C++, Java, Go, Rust, C#, Ruby, PHP, TypeScript and ~25 more languages on the free [Wandbox](https://wandbox.org) compiler |

`summary` is one plain sentence written for text-to-speech ("Prints the factorial of 5, which is 120").

## Free AI, no surprises

The server tries providers in order and **fails over instantly** on rate limits, outages, timeouts or retired models. A failing provider is put on a short cooldown so the next request goes straight to a healthy one.

| Order | Provider | Default model(s) | Why |
| --- | --- | --- | --- |
| 1 | Google Gemini | `gemini-flash-latest`, `gemini-flash-lite-latest` | Best free quality. `-latest` aliases always point at Google's newest Flash, so they never get deprecated |
| 2 | Groq | `openai/gpt-oss-120b`, `openai/gpt-oss-20b` | Free, no card, extremely fast. Live model list is checked, so retired models are skipped automatically |
| 3 | OpenRouter (optional) | `openrouter/free` | Last resort; routes only to free models |

**None of these can charge you** as long as you don't attach billing (Gemini) or buy credits (OpenRouter). Free tiers just return "rate limited", and BlindCoder moves on to the next provider.

### Get the keys (all free, no credit card)

1. Gemini: https://aistudio.google.com/apikey
2. Groq: https://console.groq.com/keys
3. *(optional)* OpenRouter: https://openrouter.ai/keys

## Setup

```bash
npm install
cp .env.example .env   # paste your keys
npm run dev            # http://localhost:5000
npm test               # 31 tests, no network or keys needed
```

Requires Node 18.17+.

### Deploying on Render

Set `GEMINI_API_KEY` and `GROQ_API_KEY` (and optionally `OPENROUTER_API_KEY`) under **Environment**. Build command `npm install`, start command `npm start`.

Render's free tier sleeps after 15 minutes idle. The frontend pings `/api/health` as soon as the page opens, so the server is usually awake by the time you finish your first sentence.

## Safety

- Per-IP rate limits (20 AI requests/min, 30 runs/min by default) protect the free quotas.
- Input size limits, JSON error handling, no API keys in URLs or logs.
- Code never runs on this server: JS and Python run sandboxed in the user's browser, everything else in Wandbox's sandbox.

## Optional settings

See [`.env.example`](.env.example): provider order, model lists, allowed origins, rate limits, timeouts.
