let popupTimeout;
let documentClickListener = null;
let lastClipboardText = "";
let hoverHideTimeout = null;
let menuHovering = false;
let currentTagMenuAnchorId = null;
let menuJustOpenedUntil = 0;

function injectClarityStyles() {
  if (document.getElementById("clarity-styles")) return;
  const st = document.createElement("style");
  st.id = "clarity-styles";
  st.textContent = `
    @keyframes clarity-fade-up { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes clarity-fade-down { from { opacity: 0; transform: translateY(-6px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes clarity-fade-out { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(6px) scale(.98); } }
    .clarity-surface { background: rgba(40,40,40,.96); color:#fff; border:1px solid rgba(255,255,255,.08); border-radius:10px; box-shadow:0 8px 28px rgba(0,0,0,.25); backdrop-filter: saturate(130%) blur(6px); -webkit-backdrop-filter: saturate(130%) blur(6px); }
    .clarity-popup, .clarity-menu, .clarity-picker { animation: clarity-fade-up 160ms cubic-bezier(.22,.61,.36,1); will-change: transform, opacity; }
    .clarity-panel { animation: clarity-fade-down 180ms cubic-bezier(.22,.61,.36,1); background:#fff; color:#222; border:1px solid rgba(0,0,0,.06); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.18); }
    .clarity-exit { animation: clarity-fade-out 160ms cubic-bezier(.22,.61,.36,1) forwards; }
    .clarity-btn { appearance:none; border:1px solid rgba(0,0,0,.12); background:linear-gradient(#fafafa,#f3f3f3); color:#222; border-radius:8px; padding:6px 10px; font-size:12px; cursor:pointer; transition:background .15s ease, transform .06s ease, box-shadow .15s ease, border-color .15s ease; box-shadow:0 1px 2px rgba(0,0,0,.06); }
    .clarity-btn:hover { background:linear-gradient(#fff,#f6f6f6); box-shadow:0 2px 6px rgba(0,0,0,.08); }
    .clarity-btn:active { transform: translateY(1px); }
    .clarity-link-btn { background:none; border:none; color:#fff; padding:2px 6px; cursor:pointer; border-radius:6px; transition:background .15s ease; font-weight:600; }
    .clarity-link-btn:hover { background: rgba(255,255,255,.08); }
    .clarity-badge { display:inline-block; padding:3px 10px; border-radius:999px; color:#fff; font-weight:600; font-size:11px; box-shadow:0 1px 2px rgba(0,0,0,.12) inset, 0 1px 2px rgba(0,0,0,.06); }
    .clarity-row { transition: background .15s ease; }
    .clarity-row:hover { background:#fafafa; }
    .clarity-color-dot { width:18px; height:18px; border-radius:50%; border:1px solid rgba(255,255,255,.55); cursor:pointer; transition: transform .12s ease, box-shadow .15s ease; }
    .clarity-color-dot:hover { transform: scale(1.12); box-shadow: 0 0 0 3px rgba(255,255,255,.15); }
    .clarity-highlight { transition: background-color .2s ease, box-shadow .2s ease; }
    .clarity-highlight:hover { box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); }
    .clarity-input { appearance:none; outline:none; border:1px solid rgba(0,0,0,.15); border-radius:8px; padding:6px 10px; font-size:12px; background:#fff; color:#222; box-shadow:0 1px 1px rgba(0,0,0,.04) inset; }
    .clarity-input:focus { border-color: #6ca0ff; box-shadow: 0 0 0 3px rgba(108,160,255,.15); }
    .clarity-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; border:1px solid rgba(0,0,0,.08); background:#f7f7f9; color:#222; font-size:11px; cursor:pointer; transition: transform .06s ease, background .15s ease, box-shadow .15s ease; }
    .clarity-chip:hover { background:#fff; box-shadow:0 2px 6px rgba(0,0,0,.08); }
    .clarity-chip.selected { background:#e9f0ff; border-color:#9bbdff; }
    #highlightsPanel::-webkit-scrollbar { width:10px; height:10px; }
    #highlightsPanel::-webkit-scrollbar-thumb { background: rgba(0,0,0,.2); border-radius:999px; border:2px solid transparent; background-clip: padding-box; }
    #highlightsPanel::-webkit-scrollbar-track { background: transparent; }
  `;
  document.documentElement.appendChild(st);
}

injectClarityStyles();
setInterval(async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text && text !== lastClipboardText && text.trim().length > 0) {
      lastClipboardText = text;
      console.log("📋 New clipboard content detected:", text.substring(0, 50));
      chrome.runtime.sendMessage({ action: "saveToClipboard", text });
    }
  } catch {}
}, 500);

function inlineMarkdown(s) {
  if (!s || typeof s !== "string") return "";
  s = s.replace(/`([^`]+)`/g, (_, p1) => `<code>${p1}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, p1) => `<strong>${p1}</strong>`);
  s = s.replace(/\*([^*]+)\*/g, (_, p1) => `<em>${p1}</em>`);
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, p1, p2) =>
      `<a href="${p2}" target="_blank" rel="noopener noreferrer">${p1}</a>`
  );

  return s;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
      html += `<h${level} style="margin:10px 0 6px;font-weight:700;color:#111;">${inlineMarkdown(
        h[2]
      )}</h${level}>`;
      continue;
    }

    const isBullet = /^[-*•]\s+/.test(line);
    const nextIdx = nextNonEmptyIndex(i);
    const nextIsBullet =
      nextIdx !== -1 && /^[-*•]\s+/.test(lines[nextIdx].trim());

    if (!isBullet && nextIsBullet) {
      html += `<p style="margin:10px 0 6px;font-weight:700;color:#111;">${inlineMarkdown(
        line
      )}</p>`;
      continue;
    }

    if (isBullet) {
      const content = line.replace(/^[-*•]\s+/, "");
      html += `<p style="margin:4px 0 4px 16px;line-height:1.5;color:#222;">• ${inlineMarkdown(
        content
      )}</p>`;
      continue;
    }

    html += `<p style="margin:8px 0;line-height:1.6;color:#222;">${inlineMarkdown(
      line
    )}</p>`;
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

function wrapSelectionInSpan(range) {
  if (range.collapsed) return null;

  const span = document.createElement("span");

  const contents = range.extractContents();
  span.appendChild(contents);
  range.insertNode(span);

  return span;
}

function makeModalDraggable(modal) {
  const header = modal.querySelector(".modal-header");
  if (!header) return;

  let offsetX = 0,
    offsetY = 0,
    isDragging = false;

  // Create a separate drag handle element that only covers the title area
  const dragHandle = document.createElement("div");
  dragHandle.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 120px; /* Leave space for the buttons on the right */
    height: 100%;
    cursor: move;
    z-index: 1;
  `;

  // Insert the drag handle at the beginning of the header
  header.style.position = "relative";
  header.insertBefore(dragHandle, header.firstChild);

  dragHandle.addEventListener("mousedown", (e) => {
    isDragging = true;
    const rect = modal.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    modal.style.transition = "none";
    document.body.style.userSelect = "none";
    e.preventDefault();
    e.stopPropagation();
  });

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    let newX = e.clientX - offsetX;
    let newY = e.clientY - offsetY;

    const modalRect = modal.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Keep modal within viewport bounds
    newX = Math.max(10, Math.min(newX, viewportWidth - modalRect.width - 10));
    newY = Math.max(10, Math.min(newY, viewportHeight - modalRect.height - 10));

    modal.style.left = `${newX}px`;
    modal.style.top = `${newY}px`;
    modal.style.transform = "none";
  };

  const handleMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      modal.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      document.body.style.userSelect = "auto";
    }
  };

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("mouseleave", handleMouseUp);

  const originalRemove = modal.remove;
  modal.remove = function () {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("mouseleave", handleMouseUp);
    originalRemove.call(this);
  };
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
    position: "fixed",
    transition: "opacity 0.2s ease, transform 0.2s ease",
  });
  modal.innerHTML = `
   <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#333;color:#fff;">
     <span style="font-weight:600;">${title}</span>
     <div class="modal-controls" style="display:flex;align-items:center;gap: 1rem;">
      <button class="collapse-btn" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0 5px;line-height:1;" title="Collapse/Expand">
                      <span class="collapse-icon">−</span>
                  </button>
      <button class="close-btn" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0;line-height:1;">×</button>
      </div>
   </div>
   <div class="modal-content" style="padding:14px 16px;max-height:220px;overflow:auto;font-size:14px;line-height:1.45;color:#333;"></div>
  `;
  document.body.appendChild(modal);

  modal.querySelector(".close-btn").onclick = () => {
    modal.style.display = "none";
  };

  modal.addEventListener("mouseenter", () => {
    if (modal._highlight) {
      modal._highlight.style.backgroundColor = "#FFFF00";
    }
  });

  modal.addEventListener("mouseleave", () => {
    if (modal._highlight) {
      modal._highlight.style.backgroundColor = "";
    }
  });

  const content = modal.querySelector(".modal-content");
  modal.querySelector(".collapse-btn").onclick = (e) => {
    const icon = modal.querySelector(".collapse-icon");

    if (modal.classList.contains("collapsed")) {
      modal.classList.remove("collapsed");
      content.style.maxHeight = "220px";
      content.style.padding = "14px 16px";
      icon.textContent = "−";
    } else {
      modal.classList.add("collapsed");
      content.style.maxHeight = "0";
      content.style.padding = "0 16px";
      icon.textContent = "+";
    }
  };
  makeModalDraggable(modal);
  return modal;
}

function showHighlightPopup() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  if (!selectedText) return;

  const oldPopup = document.getElementById("highlightPopup");
  if (oldPopup) oldPopup.remove();
  const oldHistoryCard = document.getElementById("clipboardHistoryCard");
  if (oldHistoryCard) oldHistoryCard.remove();
  if (documentClickListener) {
    document.removeEventListener("click", documentClickListener);
    documentClickListener = null;
  }

  const range = selection.getRangeAt(0);
  const highlightSpan = wrapSelectionInSpan(range);

  const rect = range.getBoundingClientRect();
  const popup = document.createElement("div");
  popup.id = "highlightPopup";
  popup.classList.add("clarity-surface", "clarity-popup");
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

  [
    "#summarizeBtn",
    "#notesBtn",
    "#translateBtn",
    "#viewHistoryBtn",
    "#highlightBtn",
  ].forEach((sel) => {
    const el = popup.querySelector(sel);
    if (el) el.classList.add("clarity-link-btn");
  });

  document.body.appendChild(popup);
  requestAnimationFrame(() => {
    popup.style.opacity = "1";
    popup.style.transform = "translateX(-50%) translateY(-17.5%)";
  });
  popup.querySelector("#summarizeBtn").onclick = async () => {
    const modal = createModal(`summaryModal-${Date.now()}`, "Summary");
    modal._highlight = highlightSpan;
    const content = modal.querySelector(".modal-content");
    showLoadingSpinner(content);
    modal.style.display = "block";
    const rect = popup.getBoundingClientRect();

    modal.style.position = "absolute";

    modal.style.top = `${rect.top - 12}px`;
    modal.style.left = `${rect.left + rect.width / 2}px`;
    modal.style.transform = "translateX(-50%) translateY(-100%)";

    modal.style.opacity = "0";
    modal.style.zIndex = "1000000";
    requestAnimationFrame(() => (modal.style.opacity = "1"));

    try {
      const res = await fetch("http://localhost:5000/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText }),
      });
      const data = await res.json();
      content.innerHTML = data.summary || "No summary available.";
    } catch {
      content.innerHTML = `<p style="color:#a00;">Failed to fetch summary.</p>`;
    }
  };

  popup.querySelector("#notesBtn").onclick = async () => {
    const modal = createModal(`notesModal-${Date.now()}`, "Notes");
    modal._highlight = highlightSpan;
    const content = modal.querySelector(".modal-content");
    showLoadingSpinner(content);
    modal.style.display = "block";
    const rect = popup.getBoundingClientRect();
    modal.style.position = "absolute";

    modal.style.top = `${rect.top - 12}px`;
    modal.style.left = `${rect.left + rect.width / 2}px`;
    modal.style.transform = "translateX(-50%) translateY(-100%)";

    modal.style.opacity = "0";
    modal.style.zIndex = "1000000";
    requestAnimationFrame(() => (modal.style.opacity = "1"));
    try {
      const res = await fetch("http://localhost:5000/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText }),
      });
      const data = await res.json();
      content.innerHTML = markdownToHtml(data.notes) || "No notes available.";
    } catch {
      content.innerHTML = `<p style="color:#a00;">Failed to fetch notes.</p>`;
    }
  };

  popup.querySelector("#translateBtn").addEventListener("click", async () => {
    const existingBox = document.getElementById("centerBox");
    if (existingBox) {
      existingBox.remove();
      return;
    }

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

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
          body: JSON.stringify({
            text: selectedText,
            target: targetLang,
          }),
        });
        if (!res.ok) throw new Error("Translation request failed");
        const data = await res.json();
        const translated = data.translatedText || "Translation failed.";

        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();

          const leadingSpacesMatch = selectedText.match(/^(\s*)/);
          const trailingSpacesMatch = selectedText.match(/(\s*)$/);

          const leadingSpaces = leadingSpacesMatch ? leadingSpacesMatch[0] : "";
          const trailingSpaces = trailingSpacesMatch
            ? trailingSpacesMatch[0]
            : "";

          const coreText = selectedText.slice(
            leadingSpaces.length,
            selectedText.length - trailingSpaces.length
          );

          const span = document.createElement("span");
          span.textContent = translated;
          span.style.backgroundColor = "rgba(255,255,0,0.2)";
          span.style.transition = "background-color 0.3s";
          span.style.cursor = "help";
          const tooltip = document.createElement("div");
          Object.assign(tooltip.style, {
            position: "absolute",
            visibility: "hidden",
            padding: "8px",
            width: "500px",
            borderRadius: "4px",
            boxShadow: "0 2px 5px rgba(0,0,0,0.4)",
            zIndex: "10000000",
          });
          tooltip.innerHTML = `
          <div style="background: black; color: white; padding: 4px 8px; font-weight: bold; border-radius: 4px 4px 0 0;">
              Original Text
          </div>
          <div style="background: white; color: black; padding: 8px; border-radius: 0 0 4px 4px;">
              ${selectedText}
          </div>
      `;

          document.body.appendChild(tooltip);

          span.addEventListener("mouseenter", (e) => {
            span.style.backgroundColor = "rgba(255,255,0,0.4)";

            Object.assign(tooltip.style, {
              visibility: "visible",
              left: `${e.pageX + 10}px`,
              top: `${e.pageY + 10}px`,
            });
          });

          span.addEventListener("mouseleave", () => {
            span.style.backgroundColor = "rgba(255,255,0,0.2)";
            tooltip.style.visibility = "hidden";
          });

          const fragment = document.createDocumentFragment();
          if (leadingSpaces)
            fragment.appendChild(document.createTextNode(leadingSpaces));
          fragment.appendChild(span);
          if (trailingSpaces)
            fragment.appendChild(document.createTextNode(trailingSpaces));

          range.deleteContents();
          range.insertNode(fragment);
        }

        box.remove();
      } catch (err) {
        console.error("Translation error:", err);
        output.innerText = "Error fetching translation.";
      }
    });
  });

  popup.querySelector("#viewHistoryBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();

    const historyCard = document.getElementById("clipboardHistoryCard");

    if (historyCard) {
      historyCard.remove();
      return;
    }

    showClipboardHistory(popup);
  });

  popup.querySelector("#highlightBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();

    const colorPicker = document.getElementById("highlightColorPicker");

    if (colorPicker) {
      colorPicker.remove();
      return;
    }

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) return;

    const range = selection.getRangeAt(0).cloneRange();
    const rectSel = range.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const historyCard = document.getElementById("clipboardHistoryCard");

    if (historyCard) {
      historyCard.remove();
    }

    showHighlightColorPicker(rectSel, popupRect, (styleSpec) => {
      let highlight = null;
      try {
        const extracted = range.extractContents();
        highlight = document.createElement("span");
        highlight.style.backgroundColor = styleSpec.background;
        if (styleSpec.boxShadow)
          highlight.style.boxShadow = styleSpec.boxShadow;
        highlight.style.borderRadius = "2px";
        highlight.style.padding = "0 2px";
        highlight.className = "clarity-highlight";
        highlight.appendChild(extracted);
        range.insertNode(highlight);
        selection.removeAllRanges();
        lastCreatedHighlight = highlight;
      } catch (err) {
        console.error("Highlight failed, likely spans multiple elements:", err);
        alert(
          "Cannot highlight across complex HTML elements. Try a simpler selection."
        );
        return;
      }

      try {
        popup.remove();
      } catch (_) {}
      if (historyCard) {
        try {
          historyCard.remove();
        } catch (_) {}
      }
      if (documentClickListener) {
        document.removeEventListener("click", documentClickListener);
        documentClickListener = null;
      }
      try {
        showTagActionsMenu(highlight);
      } catch (e) {
        console.warn("Tag menu open failed:", e);
      }
    });
  });

  setTimeout(() => {
    documentClickListener = (e) => {
      const historyCard = document.getElementById("clipboardHistoryCard");
      const highlightsPanel = document.getElementById("highlightsPanel");
      if (
        !popup.contains(e.target) &&
        (!historyCard || !historyCard.contains(e.target)) &&
        (!highlightsPanel || !highlightsPanel.contains(e.target))
      ) {
        if (historyCard) {
          try {
            historyCard.classList.add("clarity-exit");
          } catch (_) {}
          setTimeout(() => {
            try {
              historyCard.remove();
            } catch (_) {}
          }, 170);
        }
        if (highlightsPanel) {
          try {
            highlightsPanel.classList.add("clarity-exit");
          } catch (_) {}
          setTimeout(() => {
            try {
              highlightsPanel.remove();
            } catch (_) {}
          }, 170);
        }
        document.removeEventListener("click", documentClickListener);
        documentClickListener = null;
      }
    };
    document.addEventListener("click", documentClickListener);
  }, 150);
}

function showClipboardHistory(popup) {
  const oldCard = document.getElementById("clipboardHistoryCard");
  if (oldCard) oldCard.remove();

  const highlightsPanels = document.querySelectorAll("#highlightsPanel");
  highlightsPanels.forEach((panel) => {
    panel.remove();
  });

  chrome.storage.local.get(["clipboard"], (result) => {
    const history = result.clipboard || [];
    const card = document.createElement("div");
    card.id = "clipboardHistoryCard";
    card.classList.add("clarity-panel");
    Object.assign(card.style, {
      position: "absolute",
      zIndex: "1000000",
      minWidth: "320px",
      maxWidth: "460px",
      maxHeight: "360px",
      overflowY: "auto",
      padding: "12px",
    });
    const popupRect = popup.getBoundingClientRect();
    card.style.top = `${window.scrollY + popupRect.top - 10}px`;
    card.style.left = `${
      window.scrollX + popupRect.left + popupRect.width / 2
    }px`;
    card.style.transform = "translateX(-50%) translateY(-100%)";
    if (history.length === 0) {
      card.innerHTML = `
        <div style="text-align:center;padding:20px;color:#666;">
          <div style="font-size:24px;margin-bottom:8px;">📋</div>
          <div style="font-weight:bold;margin-bottom:4px;">Clipboard History</div>
          <div style="font-size:12px;">No history yet. Copy some text!</div>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="modal-header" style="font-weight:bold;margin-bottom:12px;padding:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
          <span style="display:flex;align-items:center;gap:6px;"><span>📋</span> <span>Clipboard History</span></span>
          <div style="display:flex;align-items:center;gap:8px;">
            <button id="clearHistoryBtn" class="clarity-btn" style="background:linear-gradient(#ff6b6b,#ff5252);color:white;border:none;">Clear</button>
            <button id="closeHistoryBtn" class="clarity-link-btn" style="font-size:18px;color:#555;">×</button>
          </div>
        </div>
      `;
      const list = document.createElement("div");
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "8px";
      list.style.color = "black";
      history.slice(0, 10).forEach((item) => {
        const itemDiv = document.createElement("div");
        itemDiv.classList.add("clarity-row");
        Object.assign(itemDiv.style, {
          padding: "10px",
          background: "#f7f7f7",
          borderRadius: "8px",
          cursor: "pointer",
          transition: "background 0.2s",
          position: "relative",
          border: "1px solid #eee",
        });
        itemDiv.innerHTML = `
          <div style="font-size:10px;color:#666;margin-bottom:4px;">${item.date}</div>
          <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${item.text}</div>
        `;
        itemDiv.addEventListener("click", (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(item.text);
          itemDiv.style.background = "#c8e6c9";
          const feedback = document.createElement("div");
          feedback.textContent = "✓ Copied";
          Object.assign(feedback.style, {
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
          });
          itemDiv.appendChild(feedback);
          setTimeout(() => {
            itemDiv.style.background = "#f7f7f7";
            feedback.remove();
          }, 1000);
        });
        itemDiv.addEventListener("mouseenter", () => {
          itemDiv.style.background = "#e0e0e0";
        });
        itemDiv.addEventListener("mouseleave", () => {
          itemDiv.style.background = "#f7f7f7";
        });
        list.appendChild(itemDiv);
      });
      card.appendChild(list);
      const closeWithAnimation = () => {
        try {
          card.classList.add("clarity-exit");
        } catch (_) {}
        setTimeout(() => {
          try {
            card.remove();
          } catch (_) {}
        }, 170);
      };
      const clearBtn = card.querySelector("#clearHistoryBtn");
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearBtn.disabled = true;
        clearBtn.textContent = "Clearing…";
        chrome.storage.local.set({ clipboard: [] }, () => {
          const rows = Array.from(list.children);
          rows.forEach((row, idx) => {
            row.style.transition =
              "opacity 180ms ease, transform 180ms ease, height 180ms ease, margin 180ms ease, padding 180ms ease";
            const h = row.getBoundingClientRect().height;
            row.style.height = h + "px";
            requestAnimationFrame(() => {
              row.style.opacity = "0";
              row.style.transform = "translateY(-4px)";
              row.style.height = "0px";
              row.style.margin = "0";
              row.style.paddingTop = "0";
              row.style.paddingBottom = "0";
            });
            setTimeout(() => {
              try {
                row.remove();
              } catch (_) {}
              if (idx === rows.length - 1) {
                list.innerHTML = "";
                const empty = document.createElement("div");
                empty.style.color = "#666";
                empty.style.textAlign = "center";
                empty.style.padding = "20px";
                empty.innerHTML = `<div style=\"font-size:24px;margin-bottom:8px;\">📋</div><div style=\"font-weight:bold;margin-bottom:4px;\">Clipboard History</div><div style=\"font-size:12px;\">No history yet. Copy some text!</div>`;
                list.appendChild(empty);
                clearBtn.textContent = "Clear";
                clearBtn.disabled = true;
              }
            }, 190 + idx * 20);
          });
        });
      });
      card.querySelector("#closeHistoryBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        closeWithAnimation();
      });
    }
    document.body.appendChild(card);
    try {
      const pr = card.getBoundingClientRect();
      const threshold = 8;
      if (pr.top < threshold) {
        card.style.top = `${window.scrollY + popupRect.bottom + 10}px`;
        card.style.transform = "translateX(-50%) translateY(0)";
      }
      const vw = document.documentElement.clientWidth;
      const leftPx = Math.min(
        Math.max(window.scrollX + 12, window.scrollX + popupRect.left),
        window.scrollX + vw - 12
      );
      card.style.left = `${leftPx}px`;
    } catch (_) {}
  });
}

function tagToColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash |= 0;
  }
  const h = Math.abs(hash) % 360;
  const s = 65;
  const l = 75;
  return { h, s, l };
}

function showHighlightsPanel(popup) {
  const existing = document.getElementById("highlightsPanel");
  if (existing) existing.remove();

  const historyCard = document.getElementById("clipboardHistoryCard");
  if (historyCard) {
    historyCard.remove();
  }

  chrome.storage.local.get(["highlights", "tagColors"], (result) => {
    const highlights = Array.isArray(result.highlights)
      ? result.highlights
      : [];
    const tagColors =
      result.tagColors && typeof result.tagColors === "object"
        ? result.tagColors
        : {};

    const panel = document.createElement("div");
    panel.id = "highlightsPanel";
    panel.style.position = "absolute";
    const popupRect = popup.getBoundingClientRect();
    panel.style.top = `${window.scrollY + popupRect.top - 10}px`;
    panel.style.left = `${
      window.scrollX + popupRect.left + popupRect.width / 2
    }px`;
    panel.style.transform = "translateX(-50%) translateY(-100%)";
    panel.classList.add("clarity-panel");
    panel.style.background = "white";
    panel.style.color = "#333";
    panel.style.padding = "12px";
    panel.style.borderRadius = "12px";
    panel.style.boxShadow = "0 10px 30px rgba(0,0,0,0.18)";
    panel.style.zIndex = "1000000";
    panel.style.minWidth = "340px";
    panel.style.maxWidth = "460px";
    panel.style.maxHeight = "360px";
    panel.style.overflowY = "auto";

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee;">
        <div style="display:flex;align-items:center; gap:8px;">
          <span style="font-size:16px;">🏷️</span>
          <strong>Tagged Highlights</strong>
        </div>
        <div>
          <button id="clearHighlightsBtn" class="clarity-btn" style="background:linear-gradient(#ff6b6b,#ff5252);color:white;border:none;">Clear</button>
        </div>
      </div>
    `;

    if (highlights.length === 0) {
      const empty = document.createElement("div");
      empty.style.color = "#666";
      empty.style.textAlign = "center";
      empty.style.padding = "20px";
      empty.textContent = "No highlights yet. Create a highlight, then Tag it.";
      panel.appendChild(empty);
    } else {
      const flat = [];
      highlights.forEach((h) => {
        const tags =
          Array.isArray(h.tags) && h.tags.length
            ? h.tags
            : (h.tag || "").trim()
            ? [h.tag.trim()]
            : ["untagged"];
        tags.forEach((t) => flat.push({ ...h, tag: t }));
      });
      const groups = flat.reduce((acc, h) => {
        const key = (h.tag || "untagged").trim() || "untagged";
        (acc[key] = acc[key] || []).push(h);
        return acc;
      }, {});

      const tags = Object.keys(groups).sort((a, b) => a.localeCompare(b));
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "10px";

      tags.forEach((tag) => {
        const colorStr = tagColors[tag] || null;
        const color = colorStr ? null : tagToColor(tag);
        const section = document.createElement("div");
        section.style.border = "1px solid #eee";
        section.style.borderRadius = "8px";

        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.alignItems = "center";
        header.style.justifyContent = "space-between";
        header.style.padding = "8px 10px";
        header.style.cursor = "pointer";
        header.style.background = colorStr
          ? colorStr
          : `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.25)`;
        header.style.borderBottom = "1px solid #eee";

        const left = document.createElement("div");
        const badge = document.createElement("span");
        badge.textContent = tag;
        badge.style.display = "inline-block";
        badge.style.padding = "2px 8px";
        badge.style.borderRadius = "999px";
        badge.style.background = colorStr
          ? colorStr
          : `hsl(${color.h}, ${color.s}%, ${Math.max(35, color.l - 35)}%)`;
        badge.style.color = "#fff";
        badge.style.fontSize = "11px";
        badge.style.marginRight = "8px";
        const count = document.createElement("span");
        count.textContent = `(${groups[tag].length})`;
        count.style.fontSize = "12px";
        count.style.color = "#444";
        left.appendChild(badge);
        left.appendChild(count);

        const toggle = document.createElement("span");
        toggle.textContent = "▼";
        toggle.style.fontSize = "12px";
        toggle.style.color = "#666";

        header.appendChild(left);
        header.appendChild(toggle);

        const list = document.createElement("div");
        list.style.display = "block";

        groups[tag].forEach((item) => {
          const row = document.createElement("div");
          row.classList.add("clarity-row");
          row.style.display = "grid";
          row.style.gridTemplateColumns = "1fr auto auto";
          row.style.gap = "8px";
          row.style.padding = "8px 10px";
          row.style.alignItems = "center";
          row.style.borderTop = "1px solid #f4f4f4";

          const text = document.createElement("div");
          text.style.fontSize = "13px";
          text.style.overflow = "hidden";
          text.style.textOverflow = "ellipsis";
          text.style.display = "-webkit-box";
          text.style.webkitLineClamp = "2";
          text.style.webkitBoxOrient = "vertical";
          text.textContent = item.text;

          const openBtn = document.createElement("button");
          openBtn.textContent = "Open";
          openBtn.classList.add("clarity-btn");
          openBtn.style.fontSize = "11px";
          openBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (samePageURL(item.url, location.href)) {
              const el = findHighlightByRecord(item);
              if (el) {
                try {
                  el.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest",
                  });
                } catch (_) {
                  el.scrollIntoView();
                }
                flashHighlight(el);
                showTagActionsMenu(el);
              } else {
                const recreated = findAndCreateHighlightByText(item.text, item);
                if (recreated) {
                  try {
                    recreated.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                      inline: "nearest",
                    });
                  } catch (_) {
                    recreated.scrollIntoView();
                  }
                  flashHighlight(recreated);
                  showTagActionsMenu(recreated);
                } else {
                  window.focus();
                }
              }
            } else {
              try {
                chrome.storage?.local?.set({
                  clarityPendingOpen: { ...item, ts: Date.now() },
                });
              } catch (_) {}
              window.open(item.url, "_blank");
            }
          });

          const copyBtn = document.createElement("button");
          copyBtn.textContent = "Copy";
          copyBtn.classList.add("clarity-btn");
          copyBtn.style.fontSize = "11px";
          copyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(item.text);
          });

          row.appendChild(text);
          row.appendChild(openBtn);
          row.appendChild(copyBtn);
          list.appendChild(row);
        });

        header.addEventListener("click", () => {
          const isHidden = list.style.display === "none";
          list.style.display = isHidden ? "block" : "none";
          toggle.textContent = isHidden ? "▼" : "▲";
        });

        section.appendChild(header);
        section.appendChild(list);
        container.appendChild(section);
      });

      panel.appendChild(container);
    }

    document.body.appendChild(panel);
    try {
      const pr = panel.getBoundingClientRect();
      const threshold = 8;
      if (pr.top < threshold) {
        panel.style.top = `${window.scrollY + popupRect.bottom + 10}px`;
        panel.style.transform = "translateX(-50%) translateY(0)";
      }
      const vw = document.documentElement.clientWidth;
      const leftPx = Math.min(
        Math.max(window.scrollX + 12, window.scrollX + popupRect.left),
        window.scrollX + vw - 12
      );
      panel.style.left = `${leftPx}px`;
    } catch (_) {}

    const clearBtn = panel.querySelector("#clearHighlightsBtn");
    if (clearBtn) {
      clearBtn.classList.add("clarity-btn");
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("Clear all tagged highlights?")) {
          chrome.storage.local.set({ highlights: [] }, () => {
            panel.remove();

            const historyCard = document.getElementById("clipboardHistoryCard");
            if (historyCard) {
              historyCard.remove();
            }

            const popup = document.getElementById("highlightPopup");
            if (popup) {
              popup.remove();
            }
          });
        }
      });
    }
  });
}

function showTagActionsMenu(anchorEl) {
  try {
    const old = document.getElementById("tagActionsMenu");
    const anchorId =
      (anchorEl.dataset && anchorEl.dataset.clarityId) ||
      (anchorEl.dataset
        ? (anchorEl.dataset.clarityId = generateHighlightId())
        : generateHighlightId());
    if (old && old.dataset && old.dataset.anchorId === anchorId) return;
    if (old) old.remove();
  } catch (_) {}

  const rect = anchorEl.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.id = "tagActionsMenu";
  menu.dataset.anchorId =
    (anchorEl.dataset && anchorEl.dataset.clarityId) || "";
  menu.classList.add("clarity-surface", "clarity-menu");
  menu.style.position = "absolute";
  menu.style.top = `${window.scrollY + rect.top - 8}px`;
  menu.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;
  menu.style.transform = "translateX(-50%) translateY(-100%)";
  menu.style.background = "#333";
  menu.style.color = "#fff";
  menu.style.padding = "6px 8px";
  menu.style.borderRadius = "8px";
  menu.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
  menu.style.zIndex = "1000001";
  menu.style.fontSize = "13px";
  menu.style.display = "flex";
  menu.style.alignItems = "center";
  menu.style.gap = "8px";

  const mkBtn = (label) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.background = "none";
    btn.style.border = "none";
    btn.style.color = "white";
    btn.style.cursor = "pointer";
    btn.style.padding = "2px 4px";
    btn.classList.add("clarity-link-btn");
    return btn;
  };

  const badgesWrap = document.createElement("div");
  badgesWrap.style.display = "flex";
  badgesWrap.style.gap = "6px";
  badgesWrap.style.alignItems = "center";
  menu.appendChild(badgesWrap);

  const renderBadges = (colorsMap) => {
    badgesWrap.innerHTML = "";
    const tags = getHighlightTags(anchorEl);
    tags.forEach((t) => {
      const badge = document.createElement("span");
      badge.classList.add("clarity-badge");
      badge.style.display = "inline-flex";
      badge.style.alignItems = "center";
      badge.style.gap = "6px";
      badge.style.padding = "2px 8px";
      badge.style.borderRadius = "999px";
      const label = document.createElement("span");
      label.textContent = t;
      const c = colorsMap && colorsMap[t] ? colorsMap[t] : null;
      if (c) {
        badge.style.background = c;
        badge.style.color = "#fff";
      } else {
        const hc = tagToColor(t);
        badge.style.background = `hsl(${hc.h}, ${hc.s}%, ${Math.max(
          35,
          hc.l - 35
        )}%)`;
        badge.style.color = "#fff";
      }
      badge.style.fontSize = "11px";
      const rm = document.createElement("button");
      rm.textContent = "×";
      rm.setAttribute("aria-label", `Remove ${t}`);
      rm.style.border = "none";
      rm.style.background = "rgba(0,0,0,.15)";
      rm.style.color = "#fff";
      rm.style.cursor = "pointer";
      rm.style.width = "16px";
      rm.style.height = "16px";
      rm.style.borderRadius = "50%";
      rm.style.lineHeight = "14px";
      rm.style.fontSize = "12px";
      rm.style.display = "inline-flex";
      rm.style.alignItems = "center";
      rm.style.justifyContent = "center";
      rm.style.opacity = "0.9";
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        const curr = getHighlightTags(anchorEl).filter((x) => x !== t);
        setHighlightTags(anchorEl, curr);
        upsertHighlightRecordForElement(anchorEl, curr);
        renderBadges(colorsMap);
      });
      badge.appendChild(label);
      badge.appendChild(rm);
      badgesWrap.appendChild(badge);
    });
  };

  try {
    chrome.storage?.local?.get(["tagColors"], (res) => {
      try {
        renderBadges((res && res.tagColors) || {});
      } catch (_) {
        renderBadges({});
      }
    });
  } catch (_) {
    renderBadges({});
  }

  const createTagBtn = mkBtn("Add Tag");
  const openTagsBtn = mkBtn("View Tags");

  const editor = document.createElement("div");
  editor.style.display = "none";
  editor.style.alignItems = "center";
  editor.style.gap = "6px";
  editor.style.marginLeft = "8px";
  const input = document.createElement("input");
  input.placeholder = "Add tags… (comma-separated)";
  input.className = "clarity-input";
  input.style.minWidth = "160px";
  const addBtn = document.createElement("button");
  addBtn.textContent = "Add";
  addBtn.className = "clarity-btn";
  addBtn.style.padding = "6px 10px";
  editor.appendChild(input);
  editor.appendChild(addBtn);
  menu.appendChild(editor);

  const suggestions = document.createElement("div");
  suggestions.style.display = "flex";
  suggestions.style.flexWrap = "wrap";
  suggestions.style.gap = "6px";
  suggestions.style.marginLeft = "8px";
  suggestions.style.maxWidth = "360px";
  menu.appendChild(suggestions);

  const commitTags = (tags) => {
    const uniqueTags = Array.from(new Set(tags));
    const existing = getHighlightTags(anchorEl);
    const merged = Array.from(new Set([...existing, ...uniqueTags]));
    setHighlightTags(anchorEl, merged);
    if (!anchorEl.dataset.clarityId) {
      anchorEl.dataset.clarityId = generateHighlightId();
    }
    upsertHighlightRecordForElement(anchorEl, merged, uniqueTags);
    input.value = "";
    renderBadgesFromStorage();
    try {
      chrome.storage.local.get(["tagColors"], (res) =>
        renderBadges(res.tagColors || {})
      );
    } catch (_) {}
  };

  const handleAdd = () => {
    const raw = input.value || "";
    const tags = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!tags.length) return;
    commitTags(tags);
  };

  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handleAdd();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  });

  const renderBadgesFromStorage = () => {
    try {
      chrome.storage.local.get(["tagColors"], (res) => {
        const map = (res && res.tagColors) || {};
        const keys = Object.keys(map);
        suggestions.innerHTML = "";
        keys.slice(0, 20).forEach((k) => {
          const chip = document.createElement("button");
          chip.textContent = k;
          chip.className = "clarity-chip";
          if (map[k]) {
            chip.style.background = map[k];
            chip.style.color = "#fff";
            chip.style.borderColor = "transparent";
          }
          chip.addEventListener("click", (e) => {
            e.stopPropagation();
            const current = getHighlightTags(anchorEl);
            if (current.includes(k)) {
              const next = current.filter((t) => t !== k);
              setHighlightTags(anchorEl, next);
            } else {
              commitTags([k]);
            }
            renderBadgesFromStorage();
            try {
              chrome.storage.local.get(["tagColors"], (r) =>
                renderBadges(r.tagColors || {})
              );
            } catch (_) {}
          });
          suggestions.appendChild(chip);
        });
      });
    } catch (_) {}
  };

  createTagBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    editor.style.display = "flex";
    createTagBtn.style.display = "none";
    if (editor.style.display === "flex") {
      renderBadgesFromStorage();
      setTimeout(() => input.focus(), 0);
    }
  });

  openTagsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    showHighlightsPanel(menu);
  });

  menu.appendChild(createTagBtn);
  menu.appendChild(openTagsBtn);
  document.body.appendChild(menu);
  currentTagMenuAnchorId = menu.dataset.anchorId || null;
  menuJustOpenedUntil = Date.now() + 350;

  const closer = (e) => {
    const panel = document.getElementById("highlightsPanel");
    if (!menu.contains(e.target) && (!panel || !panel.contains(e.target))) {
      try {
        menu.remove();
      } catch (_) {}
      if (panel)
        try {
          panel.remove();
        } catch (_) {}
      document.removeEventListener("click", closer);
      currentTagMenuAnchorId = null;
    }
  };
  setTimeout(() => document.addEventListener("click", closer), 0);

  menu.addEventListener("mouseenter", () => {
    menuHovering = true;
    if (hoverHideTimeout) {
      clearTimeout(hoverHideTimeout);
      hoverHideTimeout = null;
    }
  });
  menu.addEventListener("mouseleave", () => {
    menuHovering = false;
    scheduleHoverMenuHide(anchorEl);
  });
}

function generateHighlightId() {
  return `cl-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeText(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function samePageURL(a, b) {
  try {
    const u1 = new URL(a, location.href);
    const u2 = new URL(b, location.href);
    const p1 = (u1.pathname || "/").replace(/\/+$/, "");
    const p2 = (u2.pathname || "/").replace(/\/+$/, "");
    return u1.origin === u2.origin && p1 === p2;
  } catch (_) {
    return a === b;
  }
}

function findHighlightByRecord(item) {
  try {
    const wantId = item && item.id;
    if (wantId) {
      const nodesById = Array.from(
        document.querySelectorAll(".clarity-highlight")
      );
      const byId = nodesById.find(
        (n) => n.dataset && n.dataset.clarityId === wantId
      );
      if (byId) return byId;
    }
    const wantText = normalizeText(item && item.text);
    const wantTag =
      (item && (item.tag || (Array.isArray(item.tags) && item.tags[0]))) || "";
    const nodes = Array.from(document.querySelectorAll(".clarity-highlight"));

    let candidates = nodes.filter(
      (n) => normalizeText(n.textContent) === wantText
    );
    if (!candidates.length && wantText) {
      candidates = nodes.filter((n) => {
        const t = normalizeText(n.textContent);
        return t.includes(wantText) || wantText.includes(t);
      });
    }
    if (wantTag) {
      const filtered = candidates.filter((n) =>
        getHighlightTags(n).includes(wantTag)
      );
      if (filtered.length) candidates = filtered;
    }
    return candidates[0] || null;
  } catch (_) {
    return null;
  }
}

function flashHighlight(el) {
  if (!el) return;
  const prevBoxShadow = el.style.boxShadow;
  const prevTransition = el.style.transition;
  el.style.transition = "box-shadow 0.25s ease";
  el.style.boxShadow =
    "0 0 0 3px rgba(255,165,0,0.9), 0 0 10px rgba(255,165,0,0.6)";
  setTimeout(() => {
    el.style.boxShadow = prevBoxShadow || "";
    el.style.transition = prevTransition || "";
  }, 1200);
}

function findAndCreateHighlightByText(text, record) {
  if (!text || typeof text !== "string") return null;

  const tryWrap = (node, start, len) => {
    try {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + len);
      const span = document.createElement("span");
      span.className = "clarity-highlight";
      span.style.backgroundColor =
        record && record.color ? record.color : "hsla(52, 95%, 62%, 0.35)";
      span.style.borderRadius = "2px";
      span.style.padding = "0 2px";
      span.dataset.clarityId = (record && record.id) || generateHighlightId();
      if (record && (record.tags || record.tag)) {
        const tags =
          Array.isArray(record.tags) && record.tags.length
            ? record.tags
            : record.tag
            ? [record.tag]
            : [];
        setHighlightTags(span, tags);
      }
      range.surroundContents(span);
      return span;
    } catch (_) {
      return null;
    }
  };

  const mkFilter = () => ({
    acceptNode(node) {
      if (!node || !node.nodeValue) return NodeFilter.FILTER_SKIP;
      const p = node.parentElement;
      if (p && p.closest && p.closest(".clarity-highlight"))
        return NodeFilter.FILTER_SKIP;
      return node.nodeValue.trim().length
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    mkFilter()
  );
  while (walker.nextNode()) {
    const n = walker.currentNode;
    const i = n.nodeValue.indexOf(text);
    if (i !== -1) return tryWrap(n, i, text.length);
  }

  const lower = text.toLowerCase();
  const walker2 = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    mkFilter()
  );
  while (walker2.nextNode()) {
    const n = walker2.currentNode;
    const v = n.nodeValue;
    const i = (v || "").toLowerCase().indexOf(lower);
    if (i !== -1) return tryWrap(n, i, text.length);
  }
  return null;
}

function scheduleHoverMenuHide(anchorEl) {
  if (hoverHideTimeout) clearTimeout(hoverHideTimeout);
  hoverHideTimeout = setTimeout(() => {
    const menu = document.getElementById("tagActionsMenu");
    if (!menu) return;
    if (Date.now() < menuJustOpenedUntil) return;
    if (menuHovering) return;
    const stillOnHighlight = anchorEl && anchorEl.matches(":hover");
    const stillOnMenu = menu.matches(":hover");
    if (!stillOnHighlight && !stillOnMenu) {
      try {
        menu.remove();
      } catch (_) {}
      const panel = document.getElementById("highlightsPanel");
      if (panel && !panel.matches(":hover")) {
        try {
          panel.remove();
        } catch (_) {}
      }
    }
  }, 320);
}

function showHighlightColorPicker(selectionRect, popupRect, onPick, onCancel) {
  const id = "highlightColorPicker";
  document.getElementById(id)?.remove();
  const picker = document.createElement("div");
  picker.id = id;
  picker.classList.add("clarity-surface", "clarity-picker");
  Object.assign(picker.style, {
    position: "absolute",
    top: `${window.scrollY + popupRect.top - 8}px`,
    left: `${window.scrollX + selectionRect.left + selectionRect.width / 2}px`,
    transform: "translateX(-50%) translateY(-100%)",
    background: "#333",
    color: "#fff",
    padding: "8px 10px",
    borderRadius: "10px",
    boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
    zIndex: "1000002",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  });

  const presets = [
    { h: 52, s: 95, l: 62 }, // yellow
    { h: 140, s: 60, l: 60 }, // green
    { h: 210, s: 80, l: 66 }, // blue
    { h: 280, s: 60, l: 72 }, // purple
    { h: 12, s: 85, l: 66 }, // orange
    { h: 190, s: 70, l: 70 }, // cyan
    { h: 330, s: 65, l: 72 }, // pink
  ];

  const makeDot = (bg, border) => {
    const b = document.createElement("button");
    b.classList.add("clarity-color-dot");
    Object.assign(b.style, {
      background: bg,
      cursor: "pointer",
      padding: 0,
    });
    return b;
  };

  presets.forEach((c) => {
    const bg = `hsla(${c.h}, ${c.s}%, ${c.l}%, 0.35)`;
    const border = `1px solid hsl(${c.h}, ${c.s}%, ${Math.max(0, c.l - 10)}%)`;
    const dot = makeDot(bg, border);
    dot.addEventListener("click", () => {
      try {
        picker.remove();
      } catch (_) {}
      onPick({
        background: bg,
        boxShadow: `inset 0 0 0 1px hsl(${c.h}, ${c.s}%, ${Math.max(
          0,
          c.l - 10
        )}%)`,
      });
    });
    picker.appendChild(dot);
  });

  const customWrap = document.createElement("label");
  customWrap.textContent = " Custom";
  customWrap.style.fontSize = "12px";
  customWrap.style.fontWeight = "600";
  const input = document.createElement("input");
  input.type = "color";
  input.value = "#ffff00";
  input.style.marginLeft = "6px";
  input.addEventListener("input", () => {
    const hex = input.value;
    const rgba = hexToRgba(hex, 0.35);
    const border = hexToRgba(hex, 0.6);
    try {
      picker.remove();
    } catch (_) {}

    onPick({ background: rgba, boxShadow: `inset 0 0 0 1px ${border}` });
  });
  customWrap.appendChild(input);
  picker.appendChild(customWrap);

  document.body.appendChild(picker);

  try {
    const pr = picker.getBoundingClientRect();
    if (pr.top < 8) {
      picker.style.top = `${window.scrollY + selectionRect.bottom + 8}px`;
      picker.style.transform = "translateX(-50%) translateY(0)";
    }
  } catch (_) {}

  const close = (e) => {
    if (!picker.contains(e.target)) {
      try {
        picker.remove();
      } catch (_) {}
      document.removeEventListener("click", close);
      if (onCancel) onCancel();
    }
  };
  setTimeout(() => document.addEventListener("click", close), 0);
}

function hexToRgba(hex, alpha) {
  const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!res) return hex;
  const r = parseInt(res[1], 16);
  const g = parseInt(res[2], 16);
  const b = parseInt(res[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function getHighlightTags(el) {
  if (!el) return [];
  const raw = (el.dataset && (el.dataset.tags || el.dataset.tag)) || "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function setHighlightTags(el, tags) {
  const unique = Array.from(
    new Set((tags || []).map((t) => t.trim()).filter(Boolean))
  );
  if (!el.dataset) el.dataset = {};
  if (!el.dataset.clarityId) {
    el.dataset.clarityId = generateHighlightId();
  }
  el.dataset.tags = unique.join(",");
  el.title = unique.length ? `Tags: ${unique.join(", ")}` : "";
  el.classList.add("clarity-highlight");
}

function upsertHighlightRecordForElement(el, finalTags, newlyAddedTags = []) {
  const id = (el.dataset && el.dataset.clarityId) || generateHighlightId();
  if (!el.dataset.clarityId) el.dataset.clarityId = id;
  const record = {
    id,
    tags: Array.from(new Set(finalTags || [])),
    tag: (finalTags && finalTags[0]) || "",
    text: el.textContent || "",
    url: location.href,
    title: document.title,
    color: getComputedStyle(el).backgroundColor,
    date: new Date().toISOString(),
  };
  chrome.storage.local.get(["highlights", "tagColors"], (result) => {
    const list = Array.isArray(result.highlights)
      ? result.highlights.slice(0)
      : [];
    const tagColors =
      result.tagColors && typeof result.tagColors === "object"
        ? { ...result.tagColors }
        : {};

    const base = record.color || "";
    (newlyAddedTags || []).forEach((t) => {
      if (t && !tagColors[t] && base) tagColors[t] = base;
    });

    let idx = -1;
    if (record.id) idx = list.findIndex((r) => r && r.id === record.id);
    if (idx === -1)
      idx = list.findIndex(
        (r) =>
          r &&
          r.url === record.url &&
          (r.id ? false : (r.text || "") === record.text)
      );

    if (idx !== -1) {
      const existing = list[idx];
      existing.tags = record.tags;
      existing.tag = record.tag;
      existing.text = record.text;
      existing.title = record.title;
      existing.color = record.color;
      existing.date = record.date;
      if (!existing.id) existing.id = record.id;
      list[idx] = existing;
    } else {
      list.unshift(record);
    }

    const seen = new Set();
    const deduped = [];
    for (const r of list) {
      const key = r && (r.id ? `id:${r.id}` : `tx:${r.url}|${r.text}`);
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }
    chrome.storage.local.set({ highlights: deduped.slice(0, 500), tagColors });
  });
}

document.addEventListener("dblclick", () => {
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(showHighlightPopup, 120);
});

document.addEventListener("selectionchange", () => {
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    const existingPopup = document.getElementById("highlightPopup");

    if (!selectedText || selection.isCollapsed) {
      if (existingPopup) {
        existingPopup.remove();
      }
      return;
    }

    if (!existingPopup && selectedText) {
      showHighlightPopup();
    }
  }, 150);
});

document.addEventListener("mouseover", (e) => {
  const el = e.target.closest && e.target.closest(".clarity-highlight");
  if (!el) return;
  if (el.contains(e.relatedTarget)) return;
  const open = document.getElementById("tagActionsMenu");
  const anchorId = el.dataset && el.dataset.clarityId;
  if (open && open.dataset && anchorId && open.dataset.anchorId === anchorId)
    return;
  showTagActionsMenu(el);
});

document.addEventListener("mouseout", (e) => {
  const el = e.target.closest && e.target.closest(".clarity-highlight");
  if (!el) return;
  if (el.contains(e.relatedTarget)) return;
  scheduleHoverMenuHide(el);
});

(function rehydrateHighlightsForPage() {
  try {
    chrome.storage?.local?.get(["highlights"], (res) => {
      const list = res && Array.isArray(res.highlights) ? res.highlights : [];
      if (!list.length) return;
      let dirty = false;
      list.forEach((rec) => {
        try {
          if (!rec || !samePageURL(rec.url, location.href)) return;
          let el = findHighlightByRecord(rec);
          if (!el) {
            el = findAndCreateHighlightByText(rec.text, rec);
          }
          if (el) {
            if (rec.tags || rec.tag) {
              const want =
                Array.isArray(rec.tags) && rec.tags.length
                  ? rec.tags
                  : rec.tag
                  ? [rec.tag]
                  : [];
              const have = getHighlightTags(el);
              const need = want.filter((t) => !have.includes(t));
              if (need.length) setHighlightTags(el, have.concat(need));
            }
            if (!rec.id && el.dataset && el.dataset.clarityId) {
              rec.id = el.dataset.clarityId;
              dirty = true;
            }
          }
        } catch (_) {}
      });
      if (dirty) {
        try {
          chrome.storage.local.set({ highlights: list });
        } catch (_) {}
      }
    });
  } catch (_) {
    // ignore if extension context not ready
  }
})();

(function checkPendingOpen() {
  try {
    chrome.storage?.local?.get(["clarityPendingOpen"], (res) => {
      const pending = res && res.clarityPendingOpen;
      if (!pending) return;
      if (!samePageURL(pending.url, location.href)) return;
      const ts = pending.ts || 0;
      if (Date.now() - ts > 60000) {
        try {
          chrome.storage.local.remove("clarityPendingOpen");
        } catch (_) {}
        return;
      }
      let el = findHighlightByRecord(pending);
      if (!el) el = findAndCreateHighlightByText(pending.text, pending);
      if (el) {
        try {
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        } catch (_) {
          el.scrollIntoView();
        }
        flashHighlight(el);
        showTagActionsMenu(el);
      }
      try {
        chrome.storage.local.remove("clarityPendingOpen");
      } catch (_) {}
    });
  } catch (_) {
    // ignore; extension context may be unavailable transiently
  }
})();

function rehydrateNow() {
  try {
    chrome.storage?.local?.get(["highlights"], (res) => {
      const list = res && Array.isArray(res.highlights) ? res.highlights : [];
      if (!list.length) return;
      let dirty = false;
      list.forEach((rec) => {
        try {
          if (!rec || !samePageURL(rec.url, location.href)) return;
          let el = findHighlightByRecord(rec);
          if (!el) el = findAndCreateHighlightByText(rec.text, rec);
          if (el) {
            if (rec.tags || rec.tag) {
              const want =
                Array.isArray(rec.tags) && rec.tags.length
                  ? rec.tags
                  : rec.tag
                  ? [rec.tag]
                  : [];
              const have = getHighlightTags(el);
              const need = want.filter((t) => !have.includes(t));
              if (need.length) setHighlightTags(el, have.concat(need));
            }
            if (!rec.id && el.dataset && el.dataset.clarityId) {
              rec.id = el.dataset.clarityId;
              dirty = true;
            }
          }
        } catch (_) {}
      });
      if (dirty) {
        try {
          chrome.storage.local.set({ highlights: list });
        } catch (_) {}
      }
    });
  } catch (_) {}
}

function checkPendingOpenNow() {
  try {
    chrome.storage?.local?.get(["clarityPendingOpen"], (res) => {
      const pending = res && res.clarityPendingOpen;
      if (!pending) return;
      if (!samePageURL(pending.url, location.href)) return;
      const ts = pending.ts || 0;
      if (Date.now() - ts > 60000) {
        try {
          chrome.storage.local.remove("clarityPendingOpen");
        } catch (_) {}
        return;
      }
      let el = findHighlightByRecord(pending);
      if (!el) el = findAndCreateHighlightByText(pending.text, pending);
      if (el) {
        try {
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        } catch (_) {
          el.scrollIntoView();
        }
        flashHighlight(el);
        showTagActionsMenu(el);
      }
      try {
        chrome.storage.local.remove("clarityPendingOpen");
      } catch (_) {}
    });
  } catch (_) {}
}

function scheduleRehydrate() {
  const run = () => {
    rehydrateNow();
    checkPendingOpenNow();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      [0, 300, 1200].forEach((d) => setTimeout(run, d));
    });
  } else {
    [0, 300, 1200].forEach((d) => setTimeout(run, d));
  }
  window.addEventListener("pageshow", () => setTimeout(run, 150));
}

scheduleRehydrate();
