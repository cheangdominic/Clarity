<p align="center">
  <a href="#">
    <img src="images/ClarityHighlightLogoText.png" width="200" alt="Clarity Logo">
  </a>
</p>

<h1 align="center">
Clarity
</h1>

<h2 align="center">Active Learning Assistant for Smarter Reading</h2>

<div align="center">

[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Private-red.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg)](#)

[![GitHub Stars](https://img.shields.io/github/stars/TheNutcases/Clarity?style=social)](https://github.com/TheNutcases/Clarity)

</div>

:star: _Love Clarity? Star us on GitHub to support development and help others discover it!_

<br />

<div align="center">
<img src="images/ClarityDemo.png" alt="Clarity Demo" width="800" style="border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); transform: perspective(1000px) rotateX(1deg);">
</div>

---

## 🧠 Overview

**Clarity** turns **passive reading into active learning** — directly on any webpage.  
Select text to open a sleek floating menu that helps you:

- ✨ Summarize key ideas
- 🗒️ Generate concise study notes
- 🌐 Translate into your preferred language
- 🎨 Highlight with colors and tags
- 📋 Access and reuse your clipboard history

Everything runs locally: your data stays private, and AI features are powered by a small Node.js server you control.

---

## ⚙️ Features

### 🖱️ Floating Action Menu

Select text to reveal an elegant contextual menu with:

- **Summarize** — concise, AI-generated summaries
- **Notes** — plain-text study notes
- **Translate** — instant translation with hover-to-reveal original
- **Highlight** — color-coded highlighting with tag support
- **History** — view and copy from your clipboard history

### 📋 Clipboard Management

- Automatically stores the last **50 copied items**
- Quick copy and clear options
- All data stored locally via `chrome.storage.local`

### ⚡ Settings Popup (coming soon)

- Toggle menu tools individually
- Light/Dark themes
- Default translation language
- Import/Export full extension state

---

## 🧩 How It Works

### 🧱 Chrome Extension (Manifest V3)

- `content.js` — injects the menu UI, handles highlights/tags, clipboard reading
- `background.js` — manages clipboard storage in Chrome local storage
- `index.html` — popup UI for settings

### 💡 Local API Server (`server.js`)

- Express-based Node.js API for AI operations:
  - `/summarize` — powered by OpenAI
  - `/notes` — generates structured study notes
  - `/translate` — integrates Google Cloud Translate
- `.env` file holds API keys securely (never embedded in extension)

---

## 🛠️ Requirements

- Google Chrome (MV3 support)
- Node.js **v18+**
- API Keys:
  - `OPENAI_API_KEY` — for summarization and notes
  - `GOOGLE_API_KEY` — for translation

---

## 🚀 Quick Start

### 1️⃣ Install dependencies

```bash
npm install
```
