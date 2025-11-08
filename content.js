let popupTimeout;
let documentClickListener = null;
let lastClipboardText = "";

setInterval(async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text && text !== lastClipboardText && text.trim().length > 0) {
      lastClipboardText = text;
      console.log("📋 New clipboard content detected:", text.substring(0, 50));

      chrome.runtime.sendMessage({
        action: "saveToClipboard",
        text: text,
      });
    }
  } catch (err) {
    // Clipboard read permission denied or not available
    // This is normal - clipboard can only be read when page is focused
  }
}, 500);

function showHighlightPopup() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  const oldPopup = document.getElementById("highlightPopup");
  if (oldPopup) oldPopup.remove();

  const oldHistoryCard = document.getElementById("clipboardHistoryCard");
  if (oldHistoryCard) oldHistoryCard.remove();

  if (documentClickListener) {
    document.removeEventListener("click", documentClickListener);
    documentClickListener = null;
  }

  if (!selectedText) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const popup = document.createElement("div");
  popup.id = "highlightPopup";
  popup.style.position = "absolute";
  popup.style.top = `${window.scrollY + rect.top - 40}px`;
  popup.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;
  popup.style.transform = "translateX(-50%)";
  popup.style.background = "#333";
  popup.style.color = "#fff";
  popup.style.padding = "8px 12px";
  popup.style.borderRadius = "8px";
  popup.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
  popup.style.zIndex = "999999";
  popup.style.fontSize = "14px";
  popup.style.display = "flex";
  popup.style.gap = "10px";
  popup.style.opacity = "0";
  popup.style.transition = "opacity 0.2s ease, transform 0.2s ease";
  popup.style.transform += " translateY(-5px)";

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

  popup.querySelector("#summarizeBtn").addEventListener("click", () => {
    alert("Summarize: " + selectedText);
  });

  popup.querySelector("#notesBtn").addEventListener("click", () => {
    alert("Notes: " + selectedText);
  });

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
      if (!popup.contains(e.target) && (!historyCard || !historyCard.contains(e.target))) {
        popup.remove();
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
    card.style.position = "absolute";
    
    const popupRect = popup.getBoundingClientRect();
    card.style.top = `${window.scrollY + popupRect.top - 10}px`;
    card.style.left = `${window.scrollX + popupRect.left + popupRect.width / 2}px`;
    card.style.transform = "translateX(-50%) translateY(-100%)";
    
    card.style.background = "white";
    card.style.color = "#333";
    card.style.padding = "12px";
    card.style.borderRadius = "8px";
    card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    card.style.zIndex = "1000000";
    card.style.minWidth = "300px";
    card.style.maxWidth = "400px";
    card.style.maxHeight = "300px";
    card.style.overflowY = "auto";
    card.style.opacity = "0";
    card.style.transition = "opacity 0.2s ease";

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

      
      history.slice(0, 10).forEach((item, index) => {
        const itemDiv = document.createElement("div");
        /*
        itemDiv.style.padding = "8px";
        itemDiv.style.background = "#f5f5f5";
        itemDiv.style.borderRadius = "4px";
        itemDiv.style.cursor = "pointer";
        itemDiv.style.transition = "background 0.2s";
        itemDiv.style.position = "relative";
        */
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
          <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
            ${item.text}
          </div>
        `;

        itemDiv.addEventListener("click", (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(item.text);
          itemDiv.style.background = "#c8e6c9";
          
          const feedback = document.createElement("div");
          feedback.textContent = "✓ Copied";
          feedback.style.position = "absolute";
          feedback.style.top = "50%";
          feedback.style.left = "50%";
          feedback.style.transform = "translate(-50%, -50%)";
          feedback.style.background = "#4caf50";
          feedback.style.color = "white";
          feedback.style.padding = "4px 8px";
          feedback.style.borderRadius = "4px";
          feedback.style.fontSize = "12px";
          feedback.style.fontWeight = "bold";
          itemDiv.appendChild(feedback);
          
          setTimeout(() => {
            itemDiv.style.background = "#f5f5f5";
            feedback.remove();
          }, 1000);
        });

        itemDiv.addEventListener("mouseenter", () => {
          itemDiv.style.background = "#e0e0e0";
        });

        itemDiv.addEventListener("mouseleave", () => {
          itemDiv.style.background = "#f5f5f5";
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

      if (history.length > 10) {
        const moreText = document.createElement("div");
        moreText.style.textAlign = "center";
        moreText.style.marginTop = "8px";
        moreText.style.fontSize = "11px";
        moreText.style.color = "#666";
        moreText.textContent = `+ ${history.length - 10} more items`;
        card.appendChild(moreText);
      }
    }

    document.body.appendChild(card);

    requestAnimationFrame(() => {
      card.style.opacity = "1";
    });
  });
}

document.addEventListener("dblclick", () => {
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(showHighlightPopup, 120);
});

document.addEventListener("selectionchange", () => {
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(showHighlightPopup, 150);
});
