let popupTimeout;
let documentClickListener = null;
let lastClipboardText = "";
let hoverHideTimeout = null; // for hover-based menu hide
let menuHovering = false; // track mouse over mini-menu

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
  header.style.cursor = "move";

  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    const rect = modal.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    modal.style.transition = "none";
    document.body.style.userSelect = "none";
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

  modal.addEventListener("mouseenter", () => {
    if (modal._highlight) modal._highlight.style.backgroundColor = "#fbf719";
  });

  modal.addEventListener("mouseleave", () => {
    if (modal._highlight) modal._highlight.style.backgroundColor = "";
  });
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
    if (modal._highlight) {
      const span = modal._highlight;
      const parent = span.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
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
    modal._highlight = highlightSpan;
    const content = modal.querySelector(".modal-content");
    showLoadingSpinner(content);
    modal.style.display = "block";
    const rect = popup.getBoundingClientRect();
    modal.style.top = `${window.scrollY + rect.top - 12}px`;
    modal.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;
    modal.style.transform = "translateX(-50%) translateY(-100%)";
    modal.style.opacity = "0";
    modal.style.zIndex = "10000";
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
    modal.style.top = `${window.scrollY + rect.top - 12}px`;
    modal.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;
    modal.style.transform = "translateX(-50%) translateY(-100%)";
    modal.style.opacity = "0";
    requestAnimationFrame(() => (modal.style.opacity = "1"));
    try {
      const res = await fetch("http://localhost:5000/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText }),
      });
      const data = await res.json();
      content.innerHTML = data.notes || "No notes available.";
    } catch {
      content.innerHTML = `<p style="color:#a00;">Failed to fetch notes.</p>`;
    }
  };

  popup.querySelector("#translateBtn").addEventListener("click", async () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
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
          span.title = `Original: ${coreText}`;
          span.style.whiteSpace = "pre-wrap";

          span.addEventListener("mouseenter", () => {
            span.style.backgroundColor = "rgba(255,255,0,0.4)";
          });
          span.addEventListener("mouseleave", () => {
            span.style.backgroundColor = "rgba(255,255,0,0.2)";
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

    showClipboardHistory(popup);
  });

  document.querySelector("#highlightBtn").addEventListener("click", () => {
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
      try {
        const extracted = range.extractContents();
        const highlight = document.createElement("span");
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

        try {
          popup.remove();
        } catch (_) {}

        if (historyCard) {
          historyCard.remove();
        }

        if (documentClickListener) {
          document.removeEventListener("click", documentClickListener);
          documentClickListener = null;
        }
        showTagActionsMenu(highlight);
      } catch (err) {
        console.error("Highlight failed, likely spans multiple elements:", err);
        alert(
          "Cannot highlight across complex HTML elements. Try a simpler selection."
        );
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
        if (historyCard) historyCard.remove();
        if (highlightsPanel) highlightsPanel.remove();
        document.removeEventListener("click", documentClickListener);
        documentClickListener = null;
      }
    };
    document.addEventListener("click", documentClickListener);
  }, 300);
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
    Object.assign(card.style, {
      position: "absolute",
      background: "black",
      color: "white",
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
        <div style="font-weight:bold;margin-bottom:12px;padding:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
          <span>📋 Clipboard History</span>
          <div style="display:flex;align-items:center;">
            <button id="clearHistoryBtn" style="background:#ff5252;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;">Clear</button>
            <button id="closeHistoryBtn" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;line-height:1;padding:5px;margin-left:8px;">×</button>
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
      card.querySelector("#clearHistoryBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("Clear all clipboard history?")) {
          chrome.storage.local.set({ clipboard: [] }, () => {
            card.remove();
            popup.remove();
          });
        }
      });
      card.querySelector("#closeHistoryBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        card.remove();
      });
    }
    document.body.appendChild(card);
    makeModalDraggable(card);
    requestAnimationFrame(() => {
      card.style.opacity = "1";
    });
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
    panel.style.background = "white";
    panel.style.color = "#333";
    panel.style.padding = "12px";
    panel.style.borderRadius = "8px";
    panel.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    panel.style.zIndex = "1000000";
    panel.style.minWidth = "340px";
    panel.style.maxWidth = "460px";
    panel.style.maxHeight = "360px";
    panel.style.overflowY = "auto";

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee;">
        <strong>Tagged Highlights</strong>
        <div>
          <button id="clearHighlightsBtn" style="background:#ff5252;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;">Clear</button>
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
          openBtn.style.fontSize = "11px";
          openBtn.style.border = "1px solid #ddd";
          openBtn.style.background = "#f7f7f7";
          openBtn.style.color = "#333";
          openBtn.style.borderRadius = "6px";
          openBtn.style.padding = "4px 8px";
          openBtn.style.cursor = "pointer";
          openBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if ((item.url || "") === location.href) {
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
          copyBtn.style.fontSize = "11px";
          copyBtn.style.border = "1px solid #ddd";
          copyBtn.style.background = "#f7f7f7";
          copyBtn.style.color = "#333";
          copyBtn.style.borderRadius = "6px";
          copyBtn.style.padding = "4px 8px";
          copyBtn.style.cursor = "pointer";
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

    const clearBtn = panel.querySelector("#clearHighlightsBtn");
    if (clearBtn) {
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
    if (old) old.remove();
  } catch (_) {}

  const rect = anchorEl.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.id = "tagActionsMenu";
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

  const makeBtn = (label) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.background = "none";
    btn.style.border = "none";
    btn.style.color = "white";
    btn.style.cursor = "pointer";
    btn.style.padding = "2px 4px";
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
      badge.textContent = t;
      badge.style.display = "inline-block";
      badge.style.padding = "2px 8px";
      badge.style.borderRadius = "999px";
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

  const createTagBtn = makeBtn("Create Tag");
  const openTagsBtn = makeBtn("Tags");

  createTagBtn.addEventListener("click", () => {
    const existing = getHighlightTags(anchorEl);
    const input = prompt("Enter tags (comma-separated):", existing.join(", "));
    if (input === null) return;
    const tags = input
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const uniqueTags = Array.from(new Set(tags));
    setHighlightTags(anchorEl, uniqueTags);

    if (!anchorEl.dataset.clarityId) {
      anchorEl.dataset.clarityId = generateHighlightId();
    }

    const record = {
      id: anchorEl.dataset.clarityId || "",
      tags: uniqueTags,
      tag: uniqueTags[0] || "",
      text: anchorEl.textContent || "",
      url: location.href,
      title: document.title,
      color: getComputedStyle(anchorEl).backgroundColor,
      date: new Date().toISOString(),
    };

    chrome.storage.local.get(["highlights", "tagColors"], (result) => {
      const list = Array.isArray(result.highlights) ? result.highlights : [];
      const tagColors =
        result.tagColors && typeof result.tagColors === "object"
          ? result.tagColors
          : {};

      const baseColor = record.color || "";
      uniqueTags.forEach((t) => {
        if (!tagColors[t] && baseColor) tagColors[t] = baseColor;
      });

      list.unshift(record);
      chrome.storage.local.set({ highlights: list.slice(0, 500), tagColors });
    });

    showTagActionsMenu(anchorEl);
  });

  openTagsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    showHighlightsPanel(menu);
  });

  menu.appendChild(createTagBtn);
  menu.appendChild(openTagsBtn);
  document.body.appendChild(menu);

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

// Create a highlight from plain page text if the original element is gone.
function findAndCreateHighlightByText(text, record) {
  if (!text || typeof text !== "string") return null;

  const tryWrap = (node, start, len) => {
    try {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + len);
      const span = document.createElement("span");
      span.className = "clarity-highlight";
      span.style.backgroundColor = record && record.color ? record.color : "hsla(52, 95%, 62%, 0.35)";
      span.style.borderRadius = "2px";
      span.style.padding = "0 2px";
      span.dataset.clarityId = (record && record.id) || generateHighlightId();
      if (record && (record.tags || record.tag)) {
        const tags = Array.isArray(record.tags) && record.tags.length ? record.tags : (record.tag ? [record.tag] : []);
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
      if (p && p.closest && p.closest('.clarity-highlight')) return NodeFilter.FILTER_SKIP;
      return node.nodeValue.trim().length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });

  // Case-sensitive search
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, mkFilter());
  while (walker.nextNode()) {
    const n = walker.currentNode;
    const i = n.nodeValue.indexOf(text);
    if (i !== -1) return tryWrap(n, i, text.length);
  }
  // Case-insensitive fallback
  const lower = text.toLowerCase();
  const walker2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, mkFilter());
  while (walker2.nextNode()) {
    const n = walker2.currentNode;
    const v = n.nodeValue;
    const i = (v || '').toLowerCase().indexOf(lower);
    if (i !== -1) return tryWrap(n, i, text.length);
  }
  return null;
}

function scheduleHoverMenuHide(anchorEl) {
  if (hoverHideTimeout) clearTimeout(hoverHideTimeout);
  hoverHideTimeout = setTimeout(() => {
    const menu = document.getElementById("tagActionsMenu");
    if (!menu) return;
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
  }, 180);
}

function showHighlightColorPicker(selectionRect, popupRect, onPick, onCancel) {
  const id = "highlightColorPicker";
  document.getElementById(id)?.remove();
  const picker = document.createElement("div");
  picker.id = id;
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
    Object.assign(b.style, {
      width: "18px",
      height: "18px",
      borderRadius: "50%",
      border: border || "1px solid rgba(255,255,255,0.6)",
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
  showTagActionsMenu(el);
});

document.addEventListener("mouseout", (e) => {
  const el = e.target.closest && e.target.closest(".clarity-highlight");
  if (!el) return;
  if (el.contains(e.relatedTarget)) return;
  scheduleHoverMenuHide(el);
});

// Rehydrate all saved highlights that belong to this page
(function rehydrateHighlightsForPage() {
  try {
    chrome.storage?.local?.get(["highlights"], (res) => {
      const list = (res && Array.isArray(res.highlights)) ? res.highlights : [];
      if (!list.length) return;
      let dirty = false;
      list.forEach((rec) => {
        try {
          if (!rec || (rec.url || "") !== location.href) return;
          let el = findHighlightByRecord(rec);
          if (!el) {
            el = findAndCreateHighlightByText(rec.text, rec);
          }
          if (el) {
            // Ensure tags and id are applied
            if (rec.tags || rec.tag) {
              const want = Array.isArray(rec.tags) && rec.tags.length ? rec.tags : (rec.tag ? [rec.tag] : []);
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
        try { chrome.storage.local.set({ highlights: list }); } catch (_) {}
      }
    });
  } catch (_) {
    // ignore if extension context not ready
  }
})();

// Rehydrate and focus a highlight if we navigated here from the Tags panel
(function checkPendingOpen() {
  try {
    chrome.storage?.local?.get(["clarityPendingOpen"], (res) => {
      const pending = res && res.clarityPendingOpen;
      if (!pending) return;
      if ((pending.url || "") !== location.href) return;
      const ts = pending.ts || 0;
      if (Date.now() - ts > 60000) {
        try { chrome.storage.local.remove("clarityPendingOpen"); } catch (_) {}
        return;
      }
      let el = findHighlightByRecord(pending);
      if (!el) el = findAndCreateHighlightByText(pending.text, pending);
      if (el) {
        try { el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }); } catch (_) { el.scrollIntoView(); }
        flashHighlight(el);
        showTagActionsMenu(el);
      }
      try { chrome.storage.local.remove("clarityPendingOpen"); } catch (_) {}
    });
  } catch (_) {
    // ignore; extension context may be unavailable transiently
  }
})();
