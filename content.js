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

// Function to create the modal structure for summarize (modified to not apply fixed positioning)
function createSummaryModal() {
  if (document.getElementById("summaryModal")) return; // already exists

  // Modal (We will NOT set position/top/left here, we'll do it in showSummaryPopup)
  const modal = document.createElement("div");
  modal.id = "summaryModal";
  Object.assign(modal.style, {
    // These styles are the core look you wanted to keep
    width: "340px",
    maxWidth: "90%",
    background: "#fff",
    borderRadius: "10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
    zIndex: "999999",
    overflow: "hidden",
    display: "none",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    // We explicitly set the position to absolute, which showSummaryPopup will use
    position: "absolute",
    transition: "opacity 0.2s ease, transform 0.2s ease",
  });

  modal.innerHTML = `
   <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#333;color:#fff;">
     <span style="font-weight:600;">Summary</span>
     <button class="close-btn" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0;line-height:1;">×</button>
   </div>
   <div class="modal-content" style="padding:14px 16px;max-height:220px;overflow:auto;font-size:14px;line-height:1.45;color:#333;"></div>
`;

  // document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  // Close modal when any close button clicked
  modal.querySelectorAll(".close-btn").forEach((btn) => {
    btn.onclick = () => {
      modal.style.display = "none";
    };
  });
}

// Function to show the modal for summarize positioned above the toolbar
function showSummaryPopup(text, toolbar) {
  createSummaryModal();

  const modal = document.getElementById("summaryModal");
  // const backdrop = document.getElementById("summaryBackdrop"); // Not used for anchored position

  modal.querySelector(".modal-content").innerHTML = text;

  // 1. Get the toolbar position
  const toolbarRect = toolbar.getBoundingClientRect();

  // 2. Calculate the position and set the transform (same as clipboard history)
  // This overrides the original fixed-center-screen positioning.
  modal.style.top = `${window.scrollY + toolbarRect.top - 12}px`;
  modal.style.left = `${
    window.scrollX + toolbarRect.left + toolbarRect.width / 2
  }px`;

  // 3. Transform to center it on the X axis and move it up above the toolbar
  modal.style.transform = "translateX(-50%) translateY(-100%)";

  // 4. Show the modal
  modal.style.opacity = "0"; // Start invisible for transition
  modal.style.display = "block";

  // 5. Fade in
  requestAnimationFrame(() => {
    modal.style.opacity = "1";
  });
}

// Function to create the modal structure for notes

// Function to show the modal for notes positioned above the toolbar

// Highlight popup logic
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

  popup.querySelector("#summarizeBtn").addEventListener("click", async () => {
    try {
      const res = await fetch("http://localhost:5000/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText }),
      });

      const data = await res.json();
      showSummaryPopup(data.summary, popup);
    } catch (err) {
      console.error(err);
      showSummaryPopup("Failed to get summary", popup);
    }
  });

  popup.querySelector("#notesBtn").addEventListener("click", async () => {
    try {
      const res = await fetch("http://localhost:5000/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText }),
      });

      const data = await res.json();
      popup.innerHTML = `<div style="padding:10px; color:white;">📝 Notes: ${data.notes}</div>`;
    } catch (err) {
      console.error(err);
      popup.innerHTML = `<div style="padding:10px; color:red;">Failed to get summary</div>`;
    }
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
