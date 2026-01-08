<p align="center">
  <a href="#">
    <img src="images/ClarityHighlightLogoTextInverted.png" width="200" alt="Clarity Logo">
  </a>
</p>

<h1 align="center">
Clarity
</h1>

<h2 align="center">Active Learning Assistant for Smarter Reading</h2>

<div align="center">

[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg)](#)
[![GitHub Stars](https://img.shields.io/github/stars/cheangdominic/Clarity?style=social)](https://github.com/cheangdominic/Clarity)

</div>

🥉 <b>3rd</b> Place Winners @ <b><i>HTTPHacks 2025</i></b>

:star: _Love Clarity? Star us on GitHub to support development and help others discover it!_

---

## 🧩 Problem Statement

In today’s digital world, people constantly consume information — articles, research papers, blogs, documentation — yet **most reading remains passive**.  
Important insights are lost in endless tabs, and copying text for notes or summaries is tedious.  
Students, researchers, and professionals alike struggle to **retain, organize, and make sense of what they read online**.

**Theme — Utility:**  
Clarity was built to solve this everyday challenge by turning any webpage into an **interactive, active-learning workspace**.  
It empowers users to summarize, translate, highlight, and take notes instantly — all from a single contextual menu.  
No switching tabs, no messy note-taking apps — just clarity, right where you read.

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

### 🧩 Prerequisites

- **Google Chrome** (with Manifest V3 support)
- **Node.js** v18+
- **Nodemon** (optional, for auto-restart)
- **API Keys**:
  - `OPENAI_API_KEY` — for summarization and note generation
  - `GOOGLE_API_KEY` — for translation features

---

### ⚙️ Install Dependencies

```bash
npm install
```

### 🔑 Configure Environment

Create a .env file in the project root and add your API keys:

```bash
OPENAI_API_KEY=your-openai-api-key
GOOGLE_API_KEY=your-google-api-key
```

### ▶️ Start the Local API Server

```bash
nodemon server.js
```

💡 Alternatively, you can run:

```bash
node server.js
```

if you don’t have Nodemon installed globally.

🧠 Load the Chrome Extension

1. **Open Google Chrome**

2. **Navigate to:**

```arduino
chrome://extensions/
```

3. **Enable Developer Mode (toggle in the top-right corner)**

4. **Click Load unpacked**

5. **Select the project’s extension folder — the one containing your manifest.json**

6. **The Clarity extension will now appear in your Chrome toolbar**

✅ Done!

Your Clarity extension and local AI server are now running 🎉
Select any text on a webpage to open the floating action menu and start summarizing, translating, or creating study notes instantly.
