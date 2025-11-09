let popupTimeout;
let documentClickListener = null;
let lastClipboardText = "";
let lastCreatedHighlight = null;
let hoverHideTimeout = null;
let menuHovering = false;

setInterval(async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text && text !== lastClipboardText && text.trim().length > 0) {
      lastClipboardText = text;
      console.log("📋 New clipboard content detected:", text.substring(0, 50));
      chrome.runtime.sendMessage({ action: "saveToClipboard", text });
    }
  } catch (e) {}
}, 500);

function inlineMarkdown(s) {
  if (!s || typeof s !== "string") return "";
  s = s.replace(/`([^`]+)`/g, (_, p1) => `<code>${p1}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, p1) => `<strong>${p1}</strong>`);
  s = s.replace(/\*([^*]+)\*/g, (_, p1) => `<em>${p1}</em>`);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, p1, p2) => `<a href="${p2}" target="_blank" rel="noopener noreferrer">${p1}</a>`);
  return s;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function markdownToHtml(md) {
  md = escapeHtml(md);
  const lines = md.split(/\r?\n/);
  let html = "";
  function nextNonEmptyIndex(i) {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim().length > 0) return j;
    }
    return -1;
  }
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = Math.min(3, h[1].length);
      html += `<h${level} style="margin:10px 0 6px;font-weight:700;color:#111;">${inlineMarkdown(h[2])}</h${level}>`;
      continue;
    }
    const isBullet = /^[-*•]\s+/.test(line);
    const nextIdx = nextNonEmptyIndex(i);
    const nextIsBullet = nextIdx !== -1 && /^[-*•]\s+/.test(lines[nextIdx].trim());
    if (!isBullet && nextIsBullet) {
      html += `<p style="margin:10px 0 6px;font-weight:700;color:#111;">${inlineMarkdown(line)}</p>`;
      continue;
    }
    if (isBullet) {
      const content = line.replace(/^[-*•]\s+/, "");
      html += `<p style="margin:4px 0 4px 16px;line-height:1.5;color:#222;">• ${inlineMarkdown(content)}</p>`;
      continue;
    }
    html += `<p style="margin:8px 0;line-height:1.6;color:#222;">${inlineMarkdown(line)}</p>`;
  }
  return html || "<p style='color:#666;'>No content</p>";
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
  `;
}

function makeModalDraggable(modal) {
  const header = modal.querySelector(".modal-header");
  if (!header) return;
  let offsetX = 0,
    offsetY = 0,
    isDragging = false;
  header.style.cursor = "move";
  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    const rect = modal.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    modal.style.transition = "none";
    document.body.style.userSelect = "none";
    e.stopPropagation();
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    modal.style.left = `${e.clientX - offsetX}px`;
    modal.style.top = `${e.clientY - offsetY}px`;
    modal.style.transform = "none";
  });
  document.addEventListener("mouseup", () => {
    isDragging = false;
    modal.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    document.body.style.userSelect = "auto";
  });
  header.addEventListener("mouseleave", () => {});
}

function createModal(id, title) {
  const modal = document.createElement("div");
  modal.id = id;
  Object.assign(modal.style, {
    width: "340px",
    maxWidth: "90%",
    background: "#fff",
    borderRadius: "10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
    zIndex: "999999",
    overflow: "hidden",
    display: "none",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    position: "absolute",
    transition: "opacity 0.2s ease, transform 0.2s ease",
  });
  modal.innerHTML = `
   <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#333;color:#fff;">
      <span style="font-weight:600;">${title}</span>
      <button class="close-btn" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0;line-height:1;">×</button>
   </div>
   <div class="modal-content" style="padding:14px 16px;max-height:220px;overflow:auto;font-size:14px;line-height:1.45;color:#333;"></div>
  `;
  document.body.appendChild(modal);
  modal.querySelector(".close-btn").onclick = () => {
    modal.style.display = "none";
  };
  makeModalDraggable(modal);
  return modal;
}

function highlightRange(range, styleSpec) {
  if (range.collapsed) return;
  const span = document.createElement("span");
  span.style.backgroundColor = styleSpec.background;
  if (styleSpec.boxShadow) span.style.boxShadow = styleSpec.boxShadow;
  span.style.borderRadius = "2px";
  span.style.padding = "0 2px";
  span.className = "clarity-highlight";
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    (node) => {
      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(node);
      return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
    false
  );
  const nodesToWrap = [];
  let node;
  while ((node = walker.nextNode())) {
    nodesToWrap.push(node);
  }
  if (nodesToWrap.length === 0) return;
  let firstHighlight = null;
  nodesToWrap.forEach((textNode) => {
    let currentRange = document.createRange();
    currentRange.selectNodeContents(textNode);
    if (textNode === range.startContainer) currentRange.setStart(textNode, range.startOffset);
    if (textNode === range.endContainer) currentRange.setEnd(textNode, range.endOffset);
    if (currentRange.toString().trim().length === 0) return;
    try {
      const newNode = span.cloneNode(true);
      const content = currentRange.extractContents();
      newNode.appendChild(content);
      currentRange.insertNode(newNode);
      if (!firstHighlight) firstHighlight = newNode;
    } catch (e) {
      console.error("Error wrapping text node:", e);
    }
  });
  return firstHighlight;
}

function showHighlightPopup() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  if (!selectedText || selection.rangeCount === 0) return;
  const oldPopup = document.getElementById("highlightPopup");
  if (oldPopup) oldPopup.remove();
  const oldHistoryCard = document.getElementById("clipboardHistoryCard");
  if (oldHistoryCard) oldHistoryCard.remove();
  if (documentClickListener) {
    document.removeEventListener("click", documentClickListener);
    documentClickListener = null;
  }
  const range = selection.getRangeAt(0);
  const originalRange = range.cloneRange();
  const rect = range.getBoundingClientRect();
  const popup = document.createElement("div");
  popup.id = "highlightPopup";
  popup._originalRange = originalRange;
  popup._selectedText = selectedText;
  Object.assign(popup.style, {
    position: "absolute",
    top: `${window.scrollY + rect.top - 40}px`,
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
  });
  popup.innerHTML = `
    <button id="summarizeBtn" style="background:none;border:none;color:white;cursor:pointer;font-weight:600;">✨ Summarize</button>
    <button id="notesBtn" style="background:none;border:none;color:white;cursor:pointer;font-weight:600;">📝 Notes</button>
    <button id="translateBtn" style="background:none;border:none;color:white;cursor:pointer;font-weight:600;">🌐 Translate</button>
    <button id="viewHistoryBtn" style="background:none;border:none;color:white;cursor:pointer;font-weight:600;">📋 History</button>
    <button id="highlightBtn" style="background:none;border:none;color:white;cursor:pointer;font-weight:600;">💡 Highlight</button>
  `;
  document.body.appendChild(popup);
  requestAnimationFrame(() => {
    popup.style.opacity = "1";
    popup.style.transform = "translateX(-50%) translateY(0)";
  });
  popup.querySelector("#summarizeBtn").onclick = async () => {
    const modal = createModal(`summaryModal-${Date.now()}`, "Summary");
    const content = modal.querySelector(".modal-content");
    showLoadingSpinner(content);
    modal.style.display = "block";
    const rect = popup.getBoundingClientRect();
    modal.style.top = `${window.scrollY + rect.top - 12}px`;
    modal.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;
    modal.style.transform = "translateX(-50%) translateY(-100%)";
    modal.style.opacity = "0";
    requestAnimationFrame(() => (modal.style.opacity = "1"));
    try {
      const res = await fetch("http://localhost:5000/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: popup._selectedText }),
      });
      const data = await res.json();
      content.innerHTML = data.summary || "No summary available.";
    } catch {
      content.innerHTML = `<p style="color:#a00;">Failed to fetch summary.</p>`;
    }
  };
  popup.querySelector("#notesBtn").onclick = async () => {
    const modal = createModal(`notesModal-${Date.now()}`, "Notes");
    const content = modal.querySelector(".modal-content");
    showLoadingSpinner(content);
    modal.style.display = "block";
    const rect = popup.getBoundingClientRect();
    modal.style.top = `${window.scrollY + rect.top - 12}px`;
    modal.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;
    modal.style.transform = "translateX(-50%) translateY(-100%)";
    modal.style.opacity = "0";
    requestAnimationFrame(() => (modal.style.opacity = "1"));
    try {
      const res = await fetch("http://localhost:5000/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: popup._selectedText }),
      });
      const data = await res.json();
      content.innerHTML = markdownToHtml(data.notes) || "No notes available.";
    } catch {
      content.innerHTML = `<p style="color:#a00;">Failed to fetch notes.</p>`;
    }
  };
  popup.querySelector("#translateBtn").addEventListener("click", async () => {
    const selectedText = popup._selectedText;
    if (!selectedText) return;
    const oldBox = document.getElementById("centerBox");
    if (oldBox) oldBox.remove();
    const box = document.createElement("div");
    box.id = "centerBox";
    Object.assign(box.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "#333",
      color: "#fff",
      padding: "20px 30px",
      borderRadius: "12px",
      boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
      zIndex: "1000000",
      fontSize: "16px",
      textAlign: "center",
    });
    const title = document.createElement("div");
    title.innerText = "Select language:";
    title.style.marginBottom = "10px";
    box.appendChild(title);
    const select = document.createElement("select");
    Object.assign(select.style, {
      padding: "6px",
      borderRadius: "6px",
      border: "none",
      marginBottom: "10px",
      fontSize: "14px",
      cursor: "pointer",
    });
    const languages = {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      pt: "Portuguese",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
      ar: "Arabic",
    };
    for (const [code, name] of Object.entries(languages)) {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = name;
      select.appendChild(opt);
    }
    box.appendChild(select);
    const translateBtn = document.createElement("button");
    translateBtn.innerText = "Translate";
    Object.assign(translateBtn.style, {
      marginTop: "10px",
      padding: "6px 12px",
      border: "none",
      borderRadius: "5px",
      background: "#555",
      color: "#fff",
      cursor: "pointer",
    });
    box.appendChild(document.createElement("br"));
    box.appendChild(translateBtn);
    const output = document.createElement("div");
    output.style.marginTop = "15px";
    output.style.fontSize = "15px";
    output.innerText = "";
    box.appendChild(output);
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "Close";
    Object.assign(closeBtn.style, {
      marginTop: "10px",
      padding: "5px 10px",
      border: "none",
      borderRadius: "5px",
      cursor: "pointer",
      background: "#777",
      color: "#fff",
    });
    closeBtn.addEventListener("click", () => box.remove());
    box.appendChild(document.createElement("br"));
    box.appendChild(closeBtn);
    document.body.appendChild(box);
    translateBtn.addEventListener("click", async () => {
      const targetLang = select.value;
      output.innerText = "Translating...";
      try {
        const res = await fetch("http://localhost:5000/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: selectedText, target: targetLang }),
        });
        if (!res.ok) throw new Error("Translation request failed");
        const data = await res.json();
        const translated = data.translatedText || "Translation failed.";
        const currentSelection = window.getSelection();
        if (currentSelection.rangeCount > 0) {
          const rangeToReplace = popup._originalRange || currentSelection.getRangeAt(0);
          rangeToReplace.deleteContents();
          const span = document.createElement("span");
          span.textContent = translated;
          span.style.backgroundColor = "rgba(255,255,0,0.2)";
          span.style.transition = "background-color 0.3s";
          span.style.cursor = "help";
          span.title = `Original: ${selectedText}`;
          span.addEventListener("mouseenter", () => {
            span.style.backgroundColor = "rgba(255,255,0,0.4)";
          });
          span.addEventListener("mouseleave", () => {
            span.style.backgroundColor = "rgba(255,255,0,0.2)";
          });
          rangeToReplace.insertNode(span);
        }
        box.remove();
        if (popup) popup.remove();
        window.getSelection().removeAllRanges();
      } catch (err) {
        console.error("Translation error:", err);
        output.innerText = "Error fetching translation.";
      }
    });
  });
  popup.querySelector("#viewHistoryBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    showClipboardHistory(popup);
  });
  document.querySelector("#highlightBtn").addEventListener("click", () => {
    const originalRange = popup._originalRange;
    const selectedText = popup._selectedText
