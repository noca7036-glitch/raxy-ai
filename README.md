# ⬡ Raxy AI
### Smart AI for Everything

A premium, full-stack AI chat application powered by Groq, built with Node.js + Vanilla JS.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` and add your Groq API key:
```
GROQ_API_KEY=gsk_your_key_here
PORT=3000
```

Get a free API key at [console.groq.com](https://console.groq.com)

### 3. Start the server
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🧩 Features

- **3 AI Modes**: Normal, Trading Assistant, Coding Assistant
- **Streaming responses** with real-time typing effect
- **Markdown rendering** with syntax-highlighted code blocks
- **Chat history** saved to localStorage (rename, delete)
- **Settings panel**: API key, model selection, temperature
- **Image upload** (drag & drop or click)
- **Light/Dark theme** toggle
- **Mobile responsive** design
- **Keyboard shortcuts**: `Ctrl+K` new chat, `Enter` to send

## 🤖 Supported Models

| Model | Context | Speed |
|-------|---------|-------|
| LLaMA 3 70B | 8K | Medium |
| LLaMA 3 8B | 8K | Fast |
| Mixtral 8x7B | 32K | Medium |
| Gemma 2 9B | 8K | Fast |
| LLaMA 3.1 8B Instant | 128K | Very Fast |

---

## 📁 Project Structure

```
raxy-ai/
├── client/
│   ├── index.html      # Main HTML
│   ├── styles.css      # Full CSS (dark/light themes)
│   └── app.js          # Frontend application logic
├── server/
│   └── server.js       # Express backend + Groq proxy
├── .env.example        # Environment template
├── package.json
└── README.md
```

## 🔒 Security

- API key is stored server-side in `.env` (never exposed to browser)
- Users can also provide their own API key via Settings panel
- All Groq requests are proxied through the backend

---

Built with ❤️ using Groq API + LLaMA 3
