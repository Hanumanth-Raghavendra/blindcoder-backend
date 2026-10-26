import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { AiRouter, createProviders } from "./ai/router.js";
import { createAssistant } from "./services/assistant.js";
import { createRunner } from "./services/runner.js";
import { createApiRouter } from "./routes/api.js";

export function createApp({
  router = new AiRouter(createProviders(config)),
  runner = createRunner(config.runner),
} = {}) {
  const app = express();
  const assistant = createAssistant(router);

  app.set("trust proxy", 1); // Render / Vercel sit behind a proxy; needed for per-IP limits
  app.disable("x-powered-by");

  const allowed = config.allowedOrigins;
  app.use(
    cors({
      origin: allowed.length ? (origin, cb) => cb(null, !origin || allowed.includes(origin)) : true,
      methods: ["GET", "POST"],
    }),
  );
  app.use(express.json({ limit: "200kb" }));
  app.use((_req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "no-store");
    next();
  });

  app.get("/", (_req, res) => res.type("text").send("BlindCoder API is running. See /api/health."));
  app.use("/api", createApiRouter({ assistant, runner, router }));

  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body." });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Request is too large." });
    console.error("[server]", err);
    res.status(500).json({ error: "Something went wrong on the server." });
  });

  return { app, router };
}
