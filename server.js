import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing in environment variables");
    }

    // Using the stable Gemini Flash endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `You are an expert multi-language code generation engine for BlindCoder. Return ONLY raw executable code inside standard markdown code blocks. Always target the exact language requested (supporting Python, JavaScript, C, C++, Java, Ruby, Perl, C#, Go, Rust, PHP, etc.). Prompt: ${prompt}` }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to communicate with Gemini API");
    }

    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const codeMatch = rawContent.match(/```[\w]*\n([\s\S]*?)```/);
    const cleanCode = codeMatch ? codeMatch[1].trim() : rawContent.trim();

    res.json({ code: cleanCode });
  } catch (err) {
    console.error("Backend Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
