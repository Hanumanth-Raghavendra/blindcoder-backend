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
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content:
                "You are an expert multi-language code generation engine for BlindCoder. Return ONLY raw executable code inside standard markdown code blocks. Always target the exact language requested (supporting Python, JavaScript, C, C++, Java, Ruby, Perl, C#, Go, Rust, PHP, etc.).",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.2,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message || "Failed to communicate with Groq API",
      );
    }

    const rawContent = data.choices[0]?.message?.content || "";
    const codeMatch = rawContent.match(/```[\w]*\n([\s\S]*?)```/);
    const cleanCode = codeMatch ? codeMatch[1].trim() : rawContent.trim();

    res.json({ code: cleanCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
