import dotenv from "dotenv";
dotenv.config();

export const groqConfig = {
  apiKey: process.env.GROQ_API_KEY,
  endpoint: "https://api.groq.com/openai/v1/chat/completions",
  defaultModel: "qwen/qwen3-32b",
};
