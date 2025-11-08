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
            <div style="font-weight:bold;margin-bottom:4px;">Clipboard History</div>
            <div style="font-size:12px;">No history yet. Copy some text!</div>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div style="font-weight:bold;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
            <span>Clipboard History</span>
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
            <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
              ${item.text}
            </div>
          `;

          itemDiv.addEventListener("click", (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(item.text);
            itemDiv.style.background = "#c8e6c9";
            setTimeout(() => (itemDiv.style.background = "#f5f5f5"), 600);
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
      requestAnimationFrame(() => (card.style.opacity = "1"));
    });
  }

  window.Clarity.Clipboard = { startPolling, showClipboardHistory };
})();

