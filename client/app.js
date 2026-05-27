/* ================================
   RAXY AI — Main Application JS
   ================================ */

// -------- CONFIG --------
const API_BASE = window.location.origin;

const MODELS = [
  { value: "llama3-70b-8192", label: "LLaMA 3 70B" },
  { value: "llama3-8b-8192", label: "LLaMA 3 8B" },
  { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
  { value: "gemma2-9b-it", label: "Gemma 2 9B" },
  { value: "llama-3.1-8b-instant", label: "LLaMA 3.1 8B Instant" },
];

const MODE_LABELS = {
  normal: "🧠 Normal AI",
  trading: "📈 Trading Assistant",
  coding: "💻 Coding Assistant",
};

// -------- STATE --------
let state = {
  chats: [],
  activeChatId: null,
  settings: {
    apiKey: "",
    model: "llama3-70b-8192",
    temperature: 0.7,
  },
  mode: "normal",
  isStreaming: false,
  pendingImage: null,
  renamingChatId: null,
};

// -------- DOM REFS --------
const $ = (id) => document.getElementById(id);
const els = {
  sidebar: $("sidebar"),
  sidebarToggle: $("sidebarToggle"),
  sidebarOverlay: $("sidebarOverlay"),
  mobileMenuBtn: $("mobileMenuBtn"),
  newChatBtn: $("newChatBtn"),
  newChatTopBtn: $("newChatTopBtn"),
  modeList: $("modeList"),
  modeBadge: $("modeBadge"),
  chatList: $("chatList"),
  chatArea: $("chatArea"),
  welcomeScreen: $("welcomeScreen"),
  messages: $("messages"),
  messageInput: $("messageInput"),
  sendBtn: $("sendBtn"),
  charCount: $("charCount"),
  imageInput: $("imageInput"),
  imagePreviewArea: $("imagePreviewArea"),
  imagePreview: $("imagePreview"),
  removeImageBtn: $("removeImageBtn"),
  settingsBtn: $("settingsBtn"),
  settingsModal: $("settingsModal"),
  closeSettings: $("closeSettings"),
  cancelSettings: $("cancelSettings"),
  saveSettings: $("saveSettings"),
  apiKeyInput: $("apiKeyInput"),
  toggleApiKey: $("toggleApiKey"),
  modelSelect: $("modelSelect"),
  tempSlider: $("tempSlider"),
  tempValue: $("tempValue"),
  clearAllChats: $("clearAllChats"),
  renameModal: $("renameModal"),
  closeRename: $("closeRename"),
  cancelRename: $("cancelRename"),
  confirmRename: $("confirmRename"),
  renameInput: $("renameInput"),
  themeToggle: $("themeToggle"),
  themeLabel: $("themeLabel"),
  toast: $("toast"),
  suggestionGrid: $("suggestionGrid"),
};

// -------- INIT --------
function init() {
  loadFromStorage();
  renderChatList();
  setupEventListeners();
  applyTheme();

  // Setup marked.js
  marked.setOptions({
    highlight: (code, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true,
  });

  // Override code block renderer to add copy button
  const renderer = new marked.Renderer();
  renderer.code = (code, lang) => {
    const language = lang || "plaintext";
    const highlighted = hljs.getLanguage(language)
      ? hljs.highlight(code, { language }).value
      : hljs.highlightAuto(code).value;
    return `
      <pre>
        <div class="code-header">
          <span class="code-lang">${language}</span>
          <button class="copy-code-btn" onclick="copyCode(this)">Copy</button>
        </div>
        <code class="hljs language-${language}">${highlighted}</code>
      </pre>`;
  };
  marked.use({ renderer });
}

// -------- STORAGE --------
function loadFromStorage() {
  try {
    const savedChats = localStorage.getItem("raxy_chats");
    const savedSettings = localStorage.getItem("raxy_settings");
    const savedMode = localStorage.getItem("raxy_mode");
    const savedTheme = localStorage.getItem("raxy_theme");

    if (savedChats) state.chats = JSON.parse(savedChats);
    if (savedSettings) state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
    if (savedMode) state.mode = savedMode;
    if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);

    els.apiKeyInput.value = state.settings.apiKey;
    els.modelSelect.value = state.settings.model;
    els.tempSlider.value = state.settings.temperature;
    els.tempValue.textContent = state.settings.temperature;

    setActiveMode(state.mode);
  } catch (e) {
    console.error("Storage load error:", e);
  }
}

function saveChats() {
  localStorage.setItem("raxy_chats", JSON.stringify(state.chats));
}

function saveSettings() {
  localStorage.setItem("raxy_settings", JSON.stringify(state.settings));
}

// -------- CHAT MANAGEMENT --------
function createNewChat() {
  const id = "chat_" + Date.now();
  const chat = {
    id,
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
    mode: state.mode,
  };
  state.chats.unshift(chat);
  state.activeChatId = id;
  saveChats();
  renderChatList();
  renderMessages();
  showWelcome(true);
  return chat;
}

function getActiveChat() {
  return state.chats.find((c) => c.id === state.activeChatId);
}

function setActiveChat(id) {
  state.activeChatId = id;
  renderChatList();
  const chat = getActiveChat();
  if (chat) {
    setActiveMode(chat.mode || state.mode, false);
    renderMessages();
    if (chat.messages.length === 0) showWelcome(true);
    else showWelcome(false);
    scrollToBottom(false);
  }
}

function deleteChat(id) {
  state.chats = state.chats.filter((c) => c.id !== id);
  if (state.activeChatId === id) {
    state.activeChatId = state.chats.length > 0 ? state.chats[0].id : null;
    if (state.activeChatId) setActiveChat(state.activeChatId);
    else { renderMessages(); showWelcome(true); }
  }
  saveChats();
  renderChatList();
  showToast("Chat deleted");
}

function renameChat(id, newTitle) {
  const chat = state.chats.find((c) => c.id === id);
  if (chat && newTitle.trim()) {
    chat.title = newTitle.trim();
    saveChats();
    renderChatList();
  }
}

function autoTitleChat(chat, firstMessage) {
  // Generate title from first ~40 chars of first message
  let title = firstMessage.slice(0, 42);
  if (firstMessage.length > 42) title += "…";
  chat.title = title;
  saveChats();
  renderChatList();
}

// -------- RENDER CHAT LIST --------
function renderChatList() {
  const list = els.chatList;
  list.innerHTML = "";

  if (state.chats.length === 0) {
    list.innerHTML = `<p style="font-size:12px;color:var(--text-muted);padding:8px 10px;">No chats yet</p>`;
    return;
  }

  state.chats.forEach((chat) => {
    const item = document.createElement("div");
    item.className = "chat-item" + (chat.id === state.activeChatId ? " active" : "");
    item.innerHTML = `
      <span class="chat-item-title">${escapeHtml(chat.title)}</span>
      <div class="chat-item-actions">
        <button class="chat-action-btn rename-btn" title="Rename">✏️</button>
        <button class="chat-action-btn delete delete-btn" title="Delete">🗑</button>
      </div>`;

    item.querySelector(".chat-item-title").addEventListener("click", () => setActiveChat(chat.id));
    item.querySelector(".rename-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openRenameModal(chat.id, chat.title);
    });
    item.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    });

    list.appendChild(item);
  });
}

// -------- RENDER MESSAGES --------
function renderMessages() {
  const chat = getActiveChat();
  els.messages.innerHTML = "";

  if (!chat || chat.messages.length === 0) return;

  chat.messages.forEach((msg) => {
    appendMessageToDOM(msg);
  });
}

function appendMessageToDOM(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${msg.role}`;
  wrapper.dataset.msgId = msg.id || "";

  const avatarHtml =
    msg.role === "assistant"
      ? `<div class="message-avatar">⬡</div>`
      : `<div class="message-avatar">👤</div>`;

  const timeStr = msg.timestamp ? formatTime(msg.timestamp) : "";

  let contentHtml = "";
  if (msg.role === "user") {
    let imgHtml = "";
    if (msg.imageData) {
      imgHtml = `<img class="message-image" src="${msg.imageData}" alt="Attached image" />`;
    }
    contentHtml = `
      <div class="message-content">
        ${imgHtml}
        <div class="message-bubble">${escapeHtml(msg.content)}</div>
        <div class="message-meta">
          <span class="message-time">${timeStr}</span>
          <button class="msg-action-btn" title="Copy" onclick="copyMessage('${escapeHtml(msg.content)}')">📋</button>
        </div>
      </div>`;
  } else {
    const rendered = renderMarkdown(msg.content);
    contentHtml = `
      <div class="message-content">
        <div class="message-text">${rendered}</div>
        <div class="message-meta">
          <span class="message-time">${timeStr}</span>
          <button class="msg-action-btn" title="Copy" onclick="copyMessage(${JSON.stringify(msg.content)})">📋</button>
          <button class="msg-action-btn" title="Regenerate" onclick="regenerateMessage('${msg.id}')">🔄</button>
        </div>
      </div>`;
  }

  wrapper.innerHTML = `<div class="message-inner">${avatarHtml}${contentHtml}</div>`;
  els.messages.appendChild(wrapper);
}

function renderMarkdown(text) {
  try {
    return marked.parse(text || "");
  } catch {
    return escapeHtml(text);
  }
}

// -------- STREAMING MESSAGE --------
function appendStreamingMessage() {
  const wrapper = document.createElement("div");
  wrapper.className = "message assistant";
  wrapper.id = "streamingMsg";

  wrapper.innerHTML = `
    <div class="message-inner">
      <div class="message-avatar">⬡</div>
      <div class="message-content">
        <div class="message-text" id="streamingText">
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
      </div>
    </div>`;

  els.messages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function updateStreamingMessage(text) {
  const streamingText = document.getElementById("streamingText");
  if (!streamingText) return;

  const rendered = renderMarkdown(text);
  streamingText.innerHTML = rendered + `<span class="stream-cursor"></span>`;
  scrollToBottom();
}

function finalizeStreamingMessage(msgObj) {
  const wrapper = document.getElementById("streamingMsg");
  if (!wrapper) return;
  wrapper.removeAttribute("id");

  const contentEl = wrapper.querySelector(".message-text");
  const timeStr = formatTime(msgObj.timestamp);

  contentEl.innerHTML = renderMarkdown(msgObj.content);

  // Add meta bar
  const metaDiv = document.createElement("div");
  metaDiv.className = "message-meta";
  metaDiv.innerHTML = `
    <span class="message-time">${timeStr}</span>
    <button class="msg-action-btn" title="Copy" onclick="copyMessage(${JSON.stringify(msgObj.content)})">📋</button>
    <button class="msg-action-btn" title="Regenerate" onclick="regenerateMessage('${msgObj.id}')">🔄</button>`;

  wrapper.querySelector(".message-content").appendChild(metaDiv);
}

// -------- SEND MESSAGE --------
async function sendMessage(content, imageData = null) {
  if (!content.trim() && !imageData) return;
  if (state.isStreaming) return;

  // Ensure we have an active chat
  if (!state.activeChatId) {
    createNewChat();
  }

  const chat = getActiveChat();
  if (!chat) return;

  // Auto-title on first message
  if (chat.messages.length === 0 && content.trim()) {
    autoTitleChat(chat, content.trim());
  }

  // Hide welcome
  showWelcome(false);

  // Build user message
  const userMsg = {
    id: "msg_" + Date.now(),
    role: "user",
    content: content.trim(),
    imageData: imageData || null,
    timestamp: Date.now(),
  };

  chat.messages.push(userMsg);
  saveChats();
  appendMessageToDOM(userMsg);
  scrollToBottom();

  // Clear input
  els.messageInput.value = "";
  autoResizeTextarea();
  updateCharCount();
  clearImagePreview();
  els.sendBtn.disabled = true;

  // Start streaming
  state.isStreaming = true;
  setSendBtnStop(true);

  const streamWrapper = appendStreamingMessage();
  let accumulated = "";
  let aborted = false;

  // Store abort function
  state.currentAbort = () => { aborted = true; };

  try {
    // Build messages for API (last 20 for context)
    const apiMessages = chat.messages
      .filter((m) => m.id !== userMsg.id || true)
      .slice(-20)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    // If image attached, mention it in the message
    if (imageData && apiMessages.length > 0) {
      const lastMsg = apiMessages[apiMessages.length - 1];
      lastMsg.content = `[User attached an image]\n\n${lastMsg.content}`;
    }

    const response = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: apiMessages,
        model: state.settings.model,
        temperature: state.settings.temperature,
        mode: chat.mode || state.mode,
        apiKey: state.settings.apiKey,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      if (aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              updateStreamingMessage(accumulated);
            }
          } catch (_) {}
        }
      }
    }

    if (!accumulated && !aborted) {
      accumulated = "I couldn't generate a response. Please try again.";
    }

  } catch (err) {
    if (!aborted) {
      accumulated = `⚠️ **Error:** ${err.message}\n\nPlease check your API key in Settings.`;
    }
  }

  // Save assistant message
  const assistantMsg = {
    id: "msg_" + Date.now(),
    role: "assistant",
    content: accumulated || "[No response]",
    timestamp: Date.now(),
  };

  chat.messages.push(assistantMsg);
  saveChats();
  renderChatList();

  finalizeStreamingMessage(assistantMsg);

  state.isStreaming = false;
  state.currentAbort = null;
  setSendBtnStop(false);
  els.sendBtn.disabled = false;
}

// -------- REGENERATE --------
async function regenerateMessage(msgId) {
  const chat = getActiveChat();
  if (!chat || state.isStreaming) return;

  // Find the message and remove all messages from it onward
  const idx = chat.messages.findIndex((m) => m.id === msgId);
  if (idx < 0) return;

  // Remove the assistant message at idx and any after
  chat.messages.splice(idx);
  saveChats();
  renderMessages();

  // Re-send with existing history (last user message is still in place)
  const lastUser = [...chat.messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return;

  // Remove last user message too and re-send it
  chat.messages.pop();
  saveChats();
  renderMessages();

  await sendMessage(lastUser.content, lastUser.imageData);
}

// Expose globally
window.regenerateMessage = regenerateMessage;

// -------- COPY --------
function copyMessage(text) {
  navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard!"));
}

window.copyMessage = copyMessage;

function copyCode(btn) {
  const pre = btn.closest("pre");
  const code = pre.querySelector("code");
  navigator.clipboard.writeText(code.innerText).then(() => {
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy"), 2000);
  });
}

window.copyCode = copyCode;

// -------- MODES --------
function setActiveMode(mode, saveToStorage = true) {
  state.mode = mode;
  if (saveToStorage) localStorage.setItem("raxy_mode", mode);

  // Update mode buttons
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  // Update badge
  els.modeBadge.textContent = MODE_LABELS[mode] || MODE_LABELS.normal;

  // Update suggestions
  updateSuggestions(mode);
}

function updateSuggestions(mode) {
  const suggestions = {
    normal: [
      { icon: "⚛️", text: "Explain quantum computing simply", prompt: "Explain quantum computing in simple terms" },
      { icon: "🌍", text: "Summarize world news today", prompt: "Give me a summary of major world events happening right now" },
      { icon: "🎨", text: "Help me brainstorm ideas", prompt: "Help me brainstorm creative business ideas for 2024" },
      { icon: "📝", text: "Write a professional email", prompt: "Write a professional email to a potential client introducing our services" },
    ],
    trading: [
      { icon: "📊", text: "Explain RSI indicator", prompt: "Explain the RSI (Relative Strength Index) indicator and how to use it in trading" },
      { icon: "📈", text: "Trading strategies for beginners", prompt: "What are the best trading strategies for beginners?" },
      { icon: "🕯️", text: "How to read candlestick charts", prompt: "Teach me how to read candlestick charts for day trading" },
      { icon: "⚖️", text: "Risk management tips", prompt: "What are the best risk management strategies for forex trading?" },
    ],
    coding: [
      { icon: "🐍", text: "Python web scraper", prompt: "Write a Python script to scrape a website and save data to CSV" },
      { icon: "⚛️", text: "React useState hook", prompt: "Explain React useState hook with practical examples" },
      { icon: "🔍", text: "Debug my code", prompt: "Help me debug this JavaScript code" },
      { icon: "🏗️", text: "System design interview", prompt: "Walk me through how to design a URL shortening service like bit.ly" },
    ],
  };

  const items = suggestions[mode] || suggestions.normal;
  els.suggestionGrid.innerHTML = items
    .map(
      (s) => `
    <button class="suggestion-card" data-prompt="${escapeHtml(s.prompt)}">
      <span class="suggestion-icon">${s.icon}</span>
      <span>${escapeHtml(s.text)}</span>
    </button>`
    )
    .join("");

  // Re-attach listeners
  els.suggestionGrid.querySelectorAll(".suggestion-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.messageInput.value = btn.dataset.prompt;
      autoResizeTextarea();
      updateCharCount();
      els.sendBtn.disabled = false;
      els.messageInput.focus();
    });
  });
}

// -------- WELCOME SCREEN --------
function showWelcome(show) {
  els.welcomeScreen.style.display = show ? "flex" : "none";
}

// -------- SETTINGS --------
function openSettings() {
  els.apiKeyInput.value = state.settings.apiKey;
  els.modelSelect.value = state.settings.model;
  els.tempSlider.value = state.settings.temperature;
  els.tempValue.textContent = state.settings.temperature;
  els.settingsModal.classList.add("open");
}

function closeSettings() {
  els.settingsModal.classList.remove("open");
}

function saveSettingsFn() {
  state.settings.apiKey = els.apiKeyInput.value.trim();
  state.settings.model = els.modelSelect.value;
  state.settings.temperature = parseFloat(els.tempSlider.value);
  saveSettings();
  closeSettings();
  showToast("Settings saved ✓");
}

// -------- RENAME MODAL --------
function openRenameModal(id, currentTitle) {
  state.renamingChatId = id;
  els.renameInput.value = currentTitle;
  els.renameModal.classList.add("open");
  setTimeout(() => els.renameInput.focus(), 100);
}

function closeRenameModal() {
  els.renameModal.classList.remove("open");
  state.renamingChatId = null;
}

// -------- THEME --------
function applyTheme() {
  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  els.themeLabel.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("raxy_theme", next);
  applyTheme();
}

// -------- SIDEBAR --------
function toggleSidebar() {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    els.sidebar.classList.toggle("mobile-open");
    els.sidebarOverlay.classList.toggle("active");
  } else {
    els.sidebar.classList.toggle("collapsed");
  }
}

function closeMobileSidebar() {
  els.sidebar.classList.remove("mobile-open");
  els.sidebarOverlay.classList.remove("active");
}

// -------- IMAGE HANDLING --------
function handleImageUpload(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("Please select an image file");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    state.pendingImage = e.target.result;
    els.imagePreview.src = state.pendingImage;
    els.imagePreviewArea.style.display = "block";
  };
  reader.readAsDataURL(file);
}

function clearImagePreview() {
  state.pendingImage = null;
  els.imagePreviewArea.style.display = "none";
  els.imagePreview.src = "";
  els.imageInput.value = "";
}

// -------- SEND BUTTON STATE --------
function setSendBtnStop(isStop) {
  if (isStop) {
    els.sendBtn.classList.add("stop-btn");
    els.sendBtn.disabled = false;
    els.sendBtn.title = "Stop generating";
    els.sendBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
  } else {
    els.sendBtn.classList.remove("stop-btn");
    els.sendBtn.title = "Send message";
    els.sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
  }
}

// -------- HELPERS --------
function scrollToBottom(smooth = true) {
  setTimeout(() => {
    els.chatArea.scrollTo({ top: els.chatArea.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, 30);
}

function autoResizeTextarea() {
  const ta = els.messageInput;
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
}

function updateCharCount() {
  const len = els.messageInput.value.length;
  els.charCount.textContent = `${len} / 8000`;
  els.sendBtn.disabled = (len === 0 && !state.pendingImage) || state.isStreaming;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

let toastTimer = null;
function showToast(msg) {
  clearTimeout(toastTimer);
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2500);
}

// -------- EVENT LISTENERS --------
function setupEventListeners() {
  // New chat
  els.newChatBtn.addEventListener("click", () => {
    createNewChat();
    closeMobileSidebar();
  });
  els.newChatTopBtn.addEventListener("click", () => createNewChat());

  // Sidebar toggle
  els.sidebarToggle.addEventListener("click", toggleSidebar);
  els.mobileMenuBtn.addEventListener("click", toggleSidebar);
  els.sidebarOverlay.addEventListener("click", closeMobileSidebar);

  // Mode buttons
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      setActiveMode(mode);

      // Update active chat's mode
      const chat = getActiveChat();
      if (chat) {
        chat.mode = mode;
        saveChats();
      }
    });
  });

  // Message input
  els.messageInput.addEventListener("input", () => {
    autoResizeTextarea();
    updateCharCount();
  });

  els.messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!els.sendBtn.disabled) handleSend();
    }
  });

  // Send button
  els.sendBtn.addEventListener("click", () => {
    if (state.isStreaming) {
      // Stop
      if (state.currentAbort) state.currentAbort();
      state.isStreaming = false;
      setSendBtnStop(false);
      const streaming = document.getElementById("streamingMsg");
      if (streaming) {
        const textEl = streaming.querySelector(".message-text");
        if (textEl) {
          const cursor = textEl.querySelector(".stream-cursor");
          if (cursor) cursor.remove();
        }
      }
    } else {
      handleSend();
    }
  });

  function handleSend() {
    const content = els.messageInput.value;
    const image = state.pendingImage;
    sendMessage(content, image);
  }

  // Image upload
  els.imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleImageUpload(file);
  });

  els.removeImageBtn.addEventListener("click", clearImagePreview);

  // Settings
  els.settingsBtn.addEventListener("click", openSettings);
  els.closeSettings.addEventListener("click", closeSettings);
  els.cancelSettings.addEventListener("click", closeSettings);
  els.saveSettings.addEventListener("click", saveSettingsFn);

  els.settingsModal.addEventListener("click", (e) => {
    if (e.target === els.settingsModal) closeSettings();
  });

  els.toggleApiKey.addEventListener("click", () => {
    const inp = els.apiKeyInput;
    inp.type = inp.type === "password" ? "text" : "password";
  });

  els.tempSlider.addEventListener("input", () => {
    els.tempValue.textContent = els.tempSlider.value;
  });

  els.clearAllChats.addEventListener("click", () => {
    if (confirm("Delete ALL chat history? This cannot be undone.")) {
      state.chats = [];
      state.activeChatId = null;
      saveChats();
      renderChatList();
      renderMessages();
      showWelcome(true);
      closeSettings();
      showToast("All chats cleared");
    }
  });

  // Rename modal
  els.closeRename.addEventListener("click", closeRenameModal);
  els.cancelRename.addEventListener("click", closeRenameModal);
  els.renameModal.addEventListener("click", (e) => {
    if (e.target === els.renameModal) closeRenameModal();
  });

  els.confirmRename.addEventListener("click", () => {
    if (state.renamingChatId) {
      renameChat(state.renamingChatId, els.renameInput.value);
      closeRenameModal();
      showToast("Chat renamed");
    }
  });

  els.renameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") els.confirmRename.click();
    if (e.key === "Escape") closeRenameModal();
  });

  // Theme
  els.themeToggle.addEventListener("click", toggleTheme);

  // Suggestion cards (initial setup)
  els.suggestionGrid.querySelectorAll(".suggestion-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.messageInput.value = btn.dataset.prompt;
      autoResizeTextarea();
      updateCharCount();
      els.sendBtn.disabled = false;
      els.messageInput.focus();
    });
  });

  // Drag & drop image
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleImageUpload(file);
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "k") {
        e.preventDefault();
        createNewChat();
      }
    }
    if (e.key === "Escape") {
      closeSettings();
      closeRenameModal();
    }
  });
}

// -------- KICKOFF --------
document.addEventListener("DOMContentLoaded", init);
