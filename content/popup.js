(function () {
  const { showModal } = window.Clarity.Modal;
  const { highlightSelectionWithPicker } = window.Clarity.HighlightCore;

  function showHighlightPopup() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    document.getElementById("highlightPopup")?.remove();
    document.getElementById("clipboardHistoryCard")?.remove();

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const popup = document.createElement("div");
    popup.id = "highlightPopup";
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
    });

    popup.innerHTML = `
      <button id="summarizeBtn" style="background:none;border:none;color:white;cursor:pointer;">✨ Summary</button>
      <button id="notesBtn" style="background:none;border:none;color:white;cursor:pointer;">📝 Notes</button>
      <button id="translateBtn" style="background:none;border:none;color:white;cursor:pointer;">🌐 Translate</button>
      <button id="viewHistoryBtn" style="background:none;border:none;color:white;cursor:pointer;">📋 History</button>
      <button id="highlightBtn" style="background:none;border:none;color:white;cursor:pointer;">📑 Highlight</button>
    `;

    document.body.appendChild(popup);
    requestAnimationFrame(() => {
      popup.style.opacity = "1";
      popup.style.transform = "translateX(-50%) translateY(0)";
    });

    popup.querySelector("#summarizeBtn").onclick = async () => {
      try {
        const res = await fetch("http://localhost:5000/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: selectedText }),
        });
        const data = await res.json();
        showModal("summaryModal", "Summary", data.summary || "No summary", popup);
      } catch {
        showModal("summaryModal", "Summary", "Failed to fetch summary", popup);
      }
    };

    popup.querySelector("#notesBtn").onclick = async () => {
      try {
        const res = await fetch("http://localhost:5000/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: selectedText }),
        });
        const data = await res.json();
        showModal("notesModal", "Notes", data.notes || "No notes", popup);
      } catch {
        showModal("notesModal", "Notes", "Failed to fetch notes", popup);
      }
    };

    popup.querySelector("#translateBtn").onclick = () => {
      alert("Translate: " + selectedText);
    };

    popup.querySelector("#viewHistoryBtn").onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      window.Clarity.Clipboard.showClipboardHistory(popup);
    };

    popup.querySelector("#highlightBtn").onclick = () => {
      highlightSelectionWithPicker((highlight) => {
        try { popup.remove(); } catch (_) {}
        window.Clarity.HighlightCore.showTagActionsMenu(highlight);
      });
    };
  }

  window.Clarity.Popup = { showHighlightPopup };
})();

