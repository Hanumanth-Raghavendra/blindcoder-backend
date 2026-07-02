import fetch from "node-fetch";
import { groqConfig } from "../config/groq.config.js";

export const generateCode = async (req, res) => {
  const { prompt } = req.body;
  var systemMsg =
    "You are a code generator. Generate code EXACTLY in the programming language the user specifies. If user says Python, write Python using print(). If user says C, write C using printf(). If user says Java, write Java using System.out.println(). If no language is mentioned, write JavaScript using console.log(). Rules: No markdown, no backticks, no code fences, no comments, no explanation. Raw executable code only.";

  try {
    const response = await fetch(groqConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: groqConfig.defaultModel,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const code = raw
      .replace(/<think>[^]*?<\/think>/g, "")
      .replace(/```[^\n]*/g, "")
      .replace(/```/g, "")
      .trim();

    res.json({ code });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const explainError = async (req, res) => {
  const { errMsg, code } = req.body;
  try {
    const response = await fetch(groqConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: groqConfig.defaultModel,
        messages: [
          {
            role: "system",
            content:
              "Explain this code error in 1-2 simple sentences. Plain English only. No code, no markdown.",
          },
          {
            role: "user",
            content: "Error: " + errMsg + ". Code: " + code.slice(0, 300),
          },
        ],
      }),
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const explanation = raw.replace(/<think>[^]*?<\/think>/g, "").trim();
    res.json({ explanation });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
