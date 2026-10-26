import { config } from "./src/config.js";
import { createApp } from "./src/app.js";

const { app, router } = createApp();

app.listen(config.port, () => {
  const providers = router.configured;
  console.log(`BlindCoder API on port ${config.port}`);
  console.log(
    providers.length
      ? `AI providers (in order): ${providers.join(" -> ")}`
      : "WARNING: no AI provider keys set. Add GEMINI_API_KEY and/or GROQ_API_KEY.",
  );
});
