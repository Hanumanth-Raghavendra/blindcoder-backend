import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Google Gen AI client using GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Fast, powerful, and free-tier friendly model
      contents: prompt,
      config: {
        systemInstruction: "You are an expert multi-language code generation engine for BlindCoder. Return ONLY raw executable code inside standard markdown code blocks. Always target the exact language requested (supporting Python, JavaScript, C, C++, Java, Ruby, Perl, C#, Go, Rust, PHP, etc.).",
        temperature: 0.2,
      },
    });

    const rawContent = response.text || "";
    const codeMatch = rawContent.match(/```[\w]*\n([\s\S]*?)```/);
    const cleanCode = codeMatch ? codeMatch[1].trim() : rawContent.trim();

    res.json({ code: cleanCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));