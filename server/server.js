require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "../client")));

// System prompts per mode
const SYSTEM_PROMPTS = {
  normal: `You are Raxy AI, a smart but chill assistant yang ngomong santai kayak anak nongkrong.
Jawaban harus:
- Gaul, santai, enak dibaca
- Kadang pake emoji kayak 😂 😳 🙄 😠 😏
- Tetap jelas & ngebantu (jangan asal becanda)
- Jangan terlalu formal

Style:
- Singkat tapi kena
- Kayak ngobrol, bukan ceramah
- Kadang boleh roasting dikit 😏

Tujuan utama: bantu user dengan cara yang fun & relatable.`,

  trading: `You are Raxy AI mode trading, tapi gaya lo kayak trader tongkrongan 😏

Aturan:
- Tetap analisa serius (support, resistance, trend)
- Tapi jelasin dengan bahasa santai
- Kasih opini tegas (buy / sell / wait)
- Tambahin emoji kayak 😏 😳 😠 kalau cocok

Contoh gaya:
"Ini market lagi ranging bro 😳, jangan maksa entry ya, nunggu breakout aja 😏"

Jangan terlalu kaku, tapi tetap logis & masuk akal.`,

  coding: `You are Raxy AI coding assistant tapi gaya santai anak programmer 😏

Aturan:
- Jelasin coding dengan simpel & jelas
- Jangan ribet kayak dosen
- Boleh pakai emoji 😂 😳 😏
- Kalau ada error, jelasin penyebabnya + solusi

Style:
"Ini error gara-gara variable lu undefined bro 😳, fix nya tinggal tambahin ini aja 😏"

Tetap akurat, tapi santai & enak dibaca.`
};
// Chat completion endpoint (streaming)
app.post("/api/chat", async (req, res) => {
  const { messages, model, temperature, mode, apiKey } = req.body;

  // Use provided API key or fall back to env
  const groqKey = apiKey || process.env.GROQ_API_KEY;

  if (!groqKey) {
    return res
      .status(400)
      .json({ error: "No API key configured. Please add your Groq API key in Settings." });
  }

  const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.normal;

  const allMessages = [{ role: "system", content: systemPrompt }, ...messages];

  try {
const allowedModels = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant"
];

const safeModel = allowedModels.includes(model)
  ? model
  : "llama-3.3-70b-versatile";

const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${groqKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: safeModel,
    messages: allMessages,
    temperature: parseFloat(temperature) || 0.7,
    stream: true,
    max_tokens: 4096,
  }),
});
    if (!groqRes.ok) {
      const errText = await groqRes.text();
      let errMsg = "Groq API error";
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson?.error?.message || errMsg;
      } catch (_) {}
      return res.status(groqRes.status).json({ error: errMsg });
    }

    // Stream SSE to client
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    groqRes.body.on("data", (chunk) => {
      const raw = chunk.toString();
      const lines = raw.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          res.write(line + "\n\n");
        }
      }
    });

    groqRes.body.on("end", () => {
      res.write("data: [DONE]\n\n");
      res.end();
    });

    groqRes.body.on("error", (err) => {
      console.error("Stream error:", err);
      res.end();
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

// Fallback: serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Raxy AI server running at http://localhost:${PORT}`);
  console.log(`   API Key: ${process.env.GROQ_API_KEY ? "✅ Configured" : "⚠️  Not set (use Settings)"}\n`);
});
