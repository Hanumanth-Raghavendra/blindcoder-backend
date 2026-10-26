import express from "express";
import { config } from "../config.js";
import { rateLimit } from "../middleware/rateLimit.js";

const { maxPromptChars, maxCodeChars } = config.limits;

const text = (v) => (typeof v === "string" ? v : "");

function bad(res, message) {
  return res.status(400).json({ error: message });
}

function sendError(res, err) {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  const safeStatus = status === 401 || status === 403 ? 503 : status; // never leak key problems as auth errors
  res.status(safeStatus).json({ error: err.message || "Something went wrong." });
}

export function createApiRouter({ assistant, runner, router: aiRouter }) {
  const api = express.Router();
  const aiLimit = rateLimit({ perMinute: config.limits.aiPerMinute, name: "AI requests" });
  const runLimit = rateLimit({ perMinute: config.limits.runPerMinute, name: "run requests" });
  const started = Date.now();

  api.get("/health", (_req, res) => {
    res.json({ ok: true, providers: aiRouter.configured, uptimeSeconds: Math.round((Date.now() - started) / 1000) });
  });

  api.post("/generate", aiLimit, async (req, res) => {
    const prompt = text(req.body?.prompt).trim();
    const code = text(req.body?.code);
    if (!prompt) return bad(res, "Please say or type what you want the code to do.");
    if (prompt.length > maxPromptChars) return bad(res, "That request is too long. Please keep it shorter.");
    if (code.length > maxCodeChars) return bad(res, "The current code is too long to send.");
    try {
      res.json(await assistant.generate({ prompt, code, language: text(req.body?.language) }));
    } catch (err) {
      sendError(res, err);
    }
  });

  api.post("/fix", aiLimit, async (req, res) => {
    const code = text(req.body?.code);
    if (!code.trim()) return bad(res, "There is no code to fix.");
    if (code.length > maxCodeChars) return bad(res, "The code is too long to send.");
    try {
      res.json(
        await assistant.fix({
          code,
          error: text(req.body?.error).slice(0, 4000),
          language: text(req.body?.language),
        }),
      );
    } catch (err) {
      sendError(res, err);
    }
  });

  // Explains an error (if given) or describes what the code does.
  api.post("/explain", aiLimit, async (req, res) => {
    const code = text(req.body?.code);
    const error = text(req.body?.error || req.body?.errMsg); // errMsg: old frontend
    if (!code.trim() && !error.trim()) return bad(res, "There is nothing to explain.");
    try {
      res.json(await assistant.explain({ code: code.slice(0, maxCodeChars), error, language: text(req.body?.language) }));
    } catch (err) {
      sendError(res, err);
    }
  });

  api.post("/run", runLimit, async (req, res) => {
    const code = text(req.body?.code);
    if (!code.trim()) return bad(res, "There is no code to run.");
    if (code.length > maxCodeChars) return bad(res, "The code is too long to run online.");
    try {
      res.json(await runner.run({ code, language: text(req.body?.language) }));
    } catch (err) {
      res.status(503).json({
        ok: false,
        error: "The online runner is unavailable right now. Double tap Enter to save the file and run it on your computer.",
        details: err.message,
      });
    }
  });

  return api;
}
