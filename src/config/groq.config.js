import dotenv from "dotenv";
dotenv.config();

export const groqConfig = {
  apiKey: process.env.GROQ_API_KEY,
  endpoint: "https://api.groq.com/openai/v1/chat/completions",
  defaultModel: "llama-3.3-70b-versatile",
};