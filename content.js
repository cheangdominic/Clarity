let popupTimeout;
let documentClickListener = null;
let lastClipboardText = "";

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
    modal._highlight.style.backgroundColor = "#fbf719";
    const rect = modal.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    modal.style.transition = "none";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    modal._highlight.style.backgroundColor = "#fbf719";
    modal.style.left = `${e.clientX - offsetX}px`;
    modal.style.top = `${e.clientY - offsetY}px`;
    modal.style.transform = "none";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging && modal._highlight)
      modal._highlight.style.backgroundColor = "";
    isDragging = false;
    modal.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    document.body.style.userSelect = "auto";
  });

  header.addEventListener("mouseleave", () => {
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
    <button id="summarizeBtn" style="background:none;border:none;color:white;cursor:pointer;">✨ Summarize</button>
    <button id="notesBtn" style="background:none;border:none;color:white;cursor:pointer;">📝 Notes</button>
    <button id="translateBtn" style="background:none;border:none;color:white;cursor:pointer;">🌐 Translate</button>
    <button id="viewHistoryBtn" style="background:none;border:none;color:white;cursor:pointer;">📋 History</button>
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

  popup.querySelector("#translateBtn").addEventListener("click", () => {
    alert("Translate: " + selectedText);
  });

  popup.querySelector("#viewHistoryBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    showClipboardHistory(popup);
  });

  setTimeout(() => {
    documentClickListener = (e) => {
      const historyCard = document.getElementById("clipboardHistoryCard");
      if (
        !popup.contains(e.target) &&
        (!historyCard || !historyCard.contains(e.target))
      ) {
        if (historyCard) historyCard.remove();
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
  chrome.storage.local.get(["clipboard"], (result) => {
    const history = result.clipboard || [];
    const card = document.createElement("div");
    card.id = "clipboardHistoryCard";
    Object.assign(card.style, {
      position: "absolute",
      background: "white",
      color: "black",
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
        <div style="font-weight:bold;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
          <span>📋 Clipboard History</span>
          <button id="clearHistoryBtn" style="background:#ff5252;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;">Clear</button>
        </div>
      `;
      const list = document.createElement("div");
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "8px";
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
    }
    document.body.appendChild(card);
    makeModalDraggable(card);
    requestAnimationFrame(() => {
      card.style.opacity = "1";
    });
  });
}

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
