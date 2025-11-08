let popupTimeout
let documentClickListener = null
let lastClipboardText = ""

setInterval(async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text && text !== lastClipboardText && text.trim().length > 0) {
      lastClipboardText = text
      chrome.runtime.sendMessage({ action: "saveToClipboard", text })
    }
  } catch {}
}, 500)

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function inlineMarkdown(s) {
  s = s.replace(/`([^`]+)`/g, (_, p1) => `<code>${p1}</code>`)
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, p1) => `<strong>${p1}</strong>`)
  s = s.replace(/\*([^*]+)\*/g, (_, p1) => `<em>${p1}</em>`)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, p1, p2) => `<a href="${p2}" target="_blank">${p1}</a>`)
  return s
}

function markdownToHtml(md) {
  md = escapeHtml(md)
  const lines = md.split(/\r?\n/)
  let html = ""
  for (let line of lines) {
    line = line.trim()
    if (!line) continue
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      html += `<h${level} style="margin:10px 0 6px;font-weight:700;color:#111;">${inlineMarkdown(h[2])}</h${level}>`
      continue
    }
    if (/^[-*]\s+/.test(line)) line = "• " + line.replace(/^[-*]\s+/, "")
    html += `<p style="margin:8px 0;line-height:1.6;color:#222;">${inlineMarkdown(line)}</p>`
  }
  return html || "<p style='color:#666;'>No content</p>"
}

function createModal(id, title) {
  if (document.getElementById(id)) return
  const modal = document.createElement("div")
  modal.id = id
  Object.assign(modal.style, {
    width: "380px",
    maxWidth: "90%",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
    zIndex: "999999",
    overflow: "hidden",
    display: "none",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    position: "absolute",
    transition: "opacity 0.2s ease, transform 0.2s ease",
  })
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#111;color:#fff;">
      <span style="font-weight:600;">${title}</span>
      <button aria-label="Close" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">×</button>
    </div>
    <div class="modal-content" style="padding:16px;max-height:320px;overflow:auto;font-size:14px;"></div>
  `
  document.body.appendChild(modal)
  modal.querySelector("button").onclick = () => (modal.style.display = "none")
}

function showLoadingSpinner(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100px;color:#666;">
      <div style="border:4px solid #f3f3f3;border-top:4px solid #333;border-radius:50%;width:28px;height:28px;animation:spin 1s linear infinite;"></div>
      <div style="margin-top:10px;font-size:13px;">Loading...</div>
    </div>
    <style>
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    </style>
  `
}

function showHighlightPopup() {
  const selection = window.getSelection()
  const selectedText = selection.toString().trim()
  if (!selectedText) return

  document.getElementById("highlightPopup")?.remove()
  document.getElementById("clipboardHistoryCard")?.remove()
  if (documentClickListener) {
    document.removeEventListener("click", documentClickListener)
    documentClickListener = null
  }

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  const popup = document.createElement("div")
  popup.id = "highlightPopup"
  Object.assign(popup.style, {
    position: "absolute",
    top: `${window.scrollY + rect.top - 44}px`,
    left: `${window.scrollX + rect.left + rect.width / 2}px`,
    transform: "translateX(-50%) translateY(-5px)",
    background: "#333",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "8px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
    zIndex: "999999",
    fontSize: "14px",
    display: "flex",
    gap: "10px",
    opacity: "0",
    transition: "opacity 0.2s ease, transform 0.2s ease",
  })
  popup.innerHTML = `
    <button id="summarizeBtn" style="background:none;border:none;color:white;cursor:pointer;">✨ Summarize</button>
    <button id="notesBtn" style="background:none;border:none;color:white;cursor:pointer;">📝 Notes</button>
    <button id="translateBtn" style="background:none;border:none;color:white;cursor:pointer;">🌐 Translate</button>
    <button id="viewHistoryBtn" style="background:none;border:none;color:white;cursor:pointer;">📋 History</button>
  `
  document.body.appendChild(popup)
  requestAnimationFrame(() => {
    popup.style.opacity = "1"
    popup.style.transform = "translateX(-50%) translateY(0)"
  })

  popup.querySelector("#summarizeBtn").onclick = async () => {
    const modalId = "summaryModal"
    createModal(modalId, "Summary")
    const modal = document.getElementById(modalId)
    const content = modal.querySelector(".modal-content")
    showLoadingSpinner(content)
    modal.style.display = "block"
    const rect = popup.getBoundingClientRect()
    modal.style.top = `${window.scrollY + rect.top - 12}px`
    modal.style.left = `${window.scrollX + rect.left + rect.width / 2}px`
    modal.style.transform = "translateX(-50%) translateY(-100%)"
    modal.style.opacity = "0"
    requestAnimationFrame(() => (modal.style.opacity = "1"))
    try {
      const res = await fetch("http://localhost:5000/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText }),
      })
      const data = await res.json()
      content.innerHTML = markdownToHtml(data.summary || "No summary available.")
    } catch {
      content.innerHTML = `<p style="color:#a00;">Failed to fetch summary.</p>`
    }
  }

  popup.querySelector("#notesBtn").onclick = async () => {
    const modalId = "notesModal"
    createModal(modalId, "Notes")
    const modal = document.getElementById(modalId)
    const content = modal.querySelector(".modal-content")
    showLoadingSpinner(content)
    modal.style.display = "block"
    const rect = popup.getBoundingClientRect()
    modal.style.top = `${window.scrollY + rect.top - 12}px`
    modal.style.left = `${window.scrollX + rect.left + rect.width / 2}px`
    modal.style.transform = "translateX(-50%) translateY(-100%)"
    modal.style.opacity = "0"
    requestAnimationFrame(() => (modal.style.opacity = "1"))
    try {
      const res = await fetch("http://localhost:5000/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText }),
      })
      const data = await res.json()
      content.innerHTML = markdownToHtml(data.notes || "No notes available.")
    } catch {
      content.innerHTML = `<p style="color:#a00;">Failed to fetch notes.</p>`
    }
  }

  popup.querySelector("#translateBtn").onclick = () => alert("Translate: " + selectedText)

  popup.querySelector("#viewHistoryBtn").onclick = (e) => {
    e.stopPropagation()
    e.preventDefault()
    showClipboardHistory(popup)
  }

  setTimeout(() => {
    documentClickListener = (e) => {
      const card = document.getElementById("clipboardHistoryCard")
      if (!popup.contains(e.target) && (!card || !card.contains(e.target))) {
        popup.remove()
        card?.remove()
        document.removeEventListener("click", documentClickListener)
        documentClickListener = null
      }
    }
    document.addEventListener("click", documentClickListener)
  }, 300)
}

function showClipboardHistory(popup) {
  const old = document.getElementById("clipboardHistoryCard")
  if (old) old.remove()
  chrome.storage.local.get(["clipboard"], (r) => {
    const history = r.clipboard || []
    const card = document.createElement("div")
    card.id = "clipboardHistoryCard"
    const rect = popup.getBoundingClientRect()
    Object.assign(card.style, {
      position: "absolute",
      top: `${window.scrollY + rect.top - 10}px`,
      left: `${window.scrollX + rect.left + rect.width / 2}px`,
      transform: "translateX(-50%) translateY(-100%)",
      background: "#fff",
      color: "#333",
      padding: "12px",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      zIndex: "1000000",
      minWidth: "300px",
      maxWidth: "400px",
      maxHeight: "300px",
      overflowY: "auto",
      opacity: "0",
      transition: "opacity 0.2s ease",
    })
    if (!history.length) {
      card.innerHTML = `
        <div style="text-align:center;padding:20px;color:#666;">
          <div style="font-size:24px;margin-bottom:8px;">📋</div>
          <div style="font-weight:bold;margin-bottom:4px;">Clipboard History</div>
          <div style="font-size:12px;">No history yet. Copy some text!</div>
        </div>`
    } else {
      card.innerHTML = `
        <div style="font-weight:bold;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
          <span>📋 Clipboard History</span>
          <button id="clearHistoryBtn" style="background:#ff5252;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;">Clear</button>
        </div>`
      const list = document.createElement("div")
      list.style.display = "flex"
      list.style.flexDirection = "column"
      list.style.gap = "8px"
      history.slice(0, 10).forEach((item) => {
        const div = document.createElement("div")
        Object.assign(div.style, {
          padding: "10px",
          background: "#f7f7f7",
          borderRadius: "8px",
          cursor: "pointer",
          transition: "background 0.2s",
          border: "1px solid #eee",
          position: "relative",
        })
        div.innerHTML = `
          <div style="font-size:10px;color:#666;margin-bottom:4px;">${escapeHtml(item.date || "")}</div>
          <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(item.text || "")}</div>`
        div.onclick = (e) => {
          e.stopPropagation()
          navigator.clipboard.writeText(item.text)
          div.style.background = "#c8e6c9"
          const fb = document.createElement("div")
          fb.textContent = "✓ Copied"
          Object.assign(fb.style, {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "#4caf50",
            color: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "bold",
          })
          div.appendChild(fb)
          setTimeout(() => {
            div.style.background = "#f5f5f5"
            fb.remove()
          }, 1000)
        }
        div.onmouseenter = () => (div.style.background = "#e0e0e0")
        div.onmouseleave = () => (div.style.background = "#f5f5f5")
        list.appendChild(div)
      })
      card.appendChild(list)
      card.querySelector("#clearHistoryBtn").onclick = (e) => {
        e.stopPropagation()
        if (confirm("Clear all clipboard history?"))
          chrome.storage.local.set({ clipboard: [] }, () => {
            card.remove()
            popup.remove()
          })
      }
    }
    document.body.appendChild(card)
    requestAnimationFrame(() => (card.style.opacity = "1"))
  })
}

document.addEventListener("dblclick", () => {
  clearTimeout(popupTimeout)
  popupTimeout = setTimeout(showHighlightPopup, 120)
})

document.addEventListener("selectionchange", () => {
  clearTimeout(popupTimeout)
  popupTimeout = setTimeout(showHighlightPopup, 150)
})
