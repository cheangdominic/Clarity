# Clarity — Active Learning Assistant (Chrome Extension)

Clarity turns passive reading into active learning directly on any web page. Select text to open a lightweight, elegant menu with tools to:

- Summarize key ideas
- Generate concise study notes
- Translate into your preferred language
- Highlight with colors and tags
- View and reuse your clipboard history

All data is stored locally in Chrome storage. AI features run through a local server you control.

## Features

- Floating action menu on text selection with: Summarize, Notes, Translate, Highlight, History
- Highlights with color styles, tag management, and a searchable panel
- Clipboard history (last 50 items) with quick copy and clear
- Settings popup (future implementation):
  - Toggle individual menu options
  - Dark/Light theme
  - Preferred translation language
  - Import/Export full extension state

## How It Works

- Chrome extension (Manifest v3):
  - `content.js` injects UI, reads clipboard (optional), manages highlights/tags
  - `background.js` stores clipboard history in `chrome.storage.local`
  - `index.html` is the popup for settings
- Local API server (`server.js`, Express):
  - `POST /summarize` uses OpenAI to summarize selection
  - `POST /notes` creates plain-text study notes from selection
  - `POST /translate` uses Google Cloud Translation API
  - Keys are read from `.env`; the extension never embeds secrets

## Requirements

- Google Chrome (or Chromium-based browser with MV3 support)
- Node.js 18+ and npm
- API keys:
  - `OPENAI_API_KEY` (required for Summarize and Notes)
  - `GOOGLE_API_KEY` (required for Translate)

## Quick Start

1) Install dependencies (for the local server):

```
npm install
```

2) Create a `.env` in the project root:

```
OPENAI_API_KEY=YOUR_OPENAI_KEY
GOOGLE_API_KEY=YOUR_GOOGLE_TRANSLATE_KEY
# Optional:
# PORT=5000
```

3) Run the local API server:

```
node server.js
# or during development
npx nodemon server.js
```

4) Load the extension in Chrome:

- Navigate to `chrome://extensions`
- Enable “Developer mode”
- Click “Load unpacked” and select the project folder containing `manifest.json`

The extension’s popup appears from the toolbar; the content script activates on all pages.

## Using Clarity

- Select any text on a page to show the Clarity menu.
- Actions:
  - Summarize: sends selection to `http://localhost:5000/summarize` and displays a concise summary.
  - Notes: sends selection to `http://localhost:5000/notes` and returns clean, plain‑text study notes.
  - Translate: choose a language and translate in-place; hover shows original text.
  - Highlight: choose color style; add/manage tags; view all via the Highlights panel.
  - History: opens a clipboard history card (copy, clear). Background polling saves new clipboard entries locally.

Settings (Popup):

- Toggle menu items, change theme, set default translation language, and import/export extension state.

## Permissions & Privacy

- Manifest permissions:
  - `scripting`, `activeTab`, `storage`, `clipboardRead`
  - Host permissions: `http://localhost:5000/*` and `<all_urls>` for content script operation
- Clipboard: `content.js` polls `navigator.clipboard.readText()` and stores entries in `chrome.storage.local` (last 50). Use the History card to clear anytime.
- Secrets: API keys live only in the local server’s environment (`.env`). The extension does not ship or expose keys.

## Folder Overview

- `manifest.json` — Chrome MV3 manifest
- `content.js` — UI injection, selection menu, highlights/tags, translate UI
- `background.js` — clipboard history storage
- `index.html` — extension popup (settings)
- `server.js` — Express server proxying AI/translate APIs
- `clipboard.html` — style preview for history UI
- `package.json` — dev dependencies and scripts (Vite is present but not required for extension usage)

## Troubleshooting

- “Failed to fetch …” in modals
  - Ensure the server is running on `http://localhost:5000`
  - Verify `.env` keys and that your network allows local requests
- Summarize/Notes respond with “Not enough …”
  - Select a longer and more meaningful text span; the server pre-checks for sufficient context
- Translate fails
  - Add `GOOGLE_API_KEY` to `.env` and rerun the server
- Highlights don’t apply across complex selections
  - Some multi-node selections cannot be wrapped; try a narrower selection
- Clipboard History empty
  - Grant clipboard permission, select/copy some text in other apps or pages, and try again

## Development Notes

- The extension runs from source; no build step is required to test.
- Vite/React dependencies are included for future UI work; they are not mandatory for the current extension flow.
- CORS is enabled in `server.js` for local development.

## License

Property of The Nutcases (all rights reservered to Valley Balfour, Dominic Cheang, Tyrone Cheang, Bullen Kosa and Angeng Nay).
