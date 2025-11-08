(function () {
  let lastClipboardText = "";

  function startPolling() {
    setInterval(async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text !== lastClipboardText && text.trim().length > 0) {
          lastClipboardText = text;
          chrome.runtime.sendMessage({ action: "saveToClipboard", text });
        }
      } catch {}
    }, 500);
  }

  function showClipboardHistory(popup) {
    const oldCard = document.getElementById("clipboardHistoryCard");
    if (oldCard) oldCard.remove();

    chrome.storage.local.get(["clipboard"], (result) => {
      const history = result.clipboard || [];

      const card = document.createElement("div");
      card.id = "clipboardHistoryCard";

      // Positioning
      const popupRect = popup.getBoundingClientRect();
      Object.assign(card.style, {
        position: "absolute",
        top: `${window.scrollY + popupRect.top - 10}px`,
        left: `${window.scrollX + popupRect.left + popupRect.width / 2}px`,
        transform: "translateX(-50%) translateY(-100%)",
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

      // Empty state
      if (history.length === 0) {
        card.innerHTML = `
          <div style="text-align:center;padding:20px;color:#aaa;">
            <div style="font-size:24px;margin-bottom:8px;">📋</div>
            <div style="font-weight:bold;margin-bottom:4px;">Clipboard History</div>
            <div style="font-size:12px;">No history yet. Copy some text!</div>
          </div>
        `;
        document.body.appendChild(card);
        requestAnimationFrame(() => (card.style.opacity = "1"));
        return;
      }

      // Header
      card.innerHTML = `
        <div style="font-weight:bold;margin-bottom:12px;padding:8px;border-bottom:1px solid #555;display:flex;justify-content:space-between;align-items:center;">
          <span>📋 Clipboard History</span>
          <div style="display:flex;align-items:center;">
            <button id="clearHistoryBtn" style="background:#ff5252;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;">Clear</button>
            <button id="closeHistoryBtn" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;line-height:1;padding:5px;margin-left:8px;">×</button>
          </div>
        </div>
      `;

      // List container
      const list = document.createElement("div");
      Object.assign(list.style, {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        color: "black",
      });

      // History entries
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

        // Click to copy
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

        list.appendChild(itemDiv);
      });

      card.appendChild(list);

      // Clear button
      card.querySelector("#clearHistoryBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("Clear all clipboard history?")) {
          chrome.storage.local.set({ clipboard: [] }, () => {
            card.remove();
            popup.remove();
          });
        }
      });

      // Close button
      card.querySelector("#closeHistoryBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        card.remove();
      });

      document.body.appendChild(card);
      requestAnimationFrame(() => (card.style.opacity = "1"));
    });
  }

  window.Clarity.Clipboard = { startPolling, showClipboardHistory };
})();
