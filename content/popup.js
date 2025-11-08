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
      <button id="highlightBtn" style="background:none;border:none;color:white;cursor:pointer;">🖍️ Highlight</button>
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

(function () {
  const { showModal } = window.Clarity.Modal;
  const { highlightSelectionWithPicker } = window.Clarity.HighlightCore;

  function showHighlightPopupWithSettings() {
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

    chrome.storage.local.get(["settings"], (res) => {
      const settings = Object.assign(
        { enabledMenu: { summarize: true, notes: true, translate: true, history: true, highlight: true }, language: "en" },
        res.settings || {}
      );
      const enabled = Object.assign({ summarize: true, notes: true, translate: true, history: true, highlight: true }, settings.enabledMenu || {});
      const lang = settings.language || "en";

      const btn = (id, label) => `<button id="${id}" style="background:none;border:none;color:white;cursor:pointer;">${label}</button>`;
      const labels = {
        summarize: "✨ Summary",
        notes: "📝 Notes",
        translate: "🌐 Translate",
        history: "📋 History",
        highlight: "🖍️ Highlight",
      };
      popup.innerHTML = `
        ${enabled.summarize ? btn("summarizeBtn", labels.summarize) : ""}
        ${enabled.notes ? btn("notesBtn", labels.notes) : ""}
        ${enabled.translate ? btn("translateBtn", labels.translate) : ""}
        ${enabled.history ? btn("viewHistoryBtn", labels.history) : ""}
        ${enabled.highlight ? btn("highlightBtn", labels.highlight) : ""}
      `;

      document.body.appendChild(popup);
      requestAnimationFrame(() => {
        popup.style.opacity = "1";
        popup.style.transform = "translateX(-50%) translateY(0)";
      });

      const sumBtn = popup.querySelector("#summarizeBtn");
      if (sumBtn) sumBtn.onclick = async () => {
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

      const notesBtn = popup.querySelector("#notesBtn");
      if (notesBtn) notesBtn.onclick = async () => {
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

      const translateBtn = popup.querySelector("#translateBtn");
      if (translateBtn) translateBtn.onclick = () => {
        alert(`Translate (${lang}): ` + selectedText);
      };

      const histBtn = popup.querySelector("#viewHistoryBtn");
      if (histBtn) histBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.Clarity.Clipboard.showClipboardHistory(popup);
      };

      const hlBtn = popup.querySelector("#highlightBtn");
      if (hlBtn) hlBtn.onclick = () => {
        highlightSelectionWithPicker((highlight) => {
          try { popup.remove(); } catch (_) {}
          window.Clarity.HighlightCore.showTagActionsMenu(highlight);
        });
      };
    });
  }

  window.Clarity.Popup.showHighlightPopup = showHighlightPopupWithSettings;
})();

(function () {
  const { createModal } = window.Clarity.Modal;
  const { showLoadingSpinner, markdownToHtml } = window.Clarity.Common;
  const { highlightSelectionWithPicker, showHighlightColorPicker } = window.Clarity.HighlightCore;

  function showHighlightPopup() {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : "";
    if (!selectedText) return;

    const old = document.getElementById("highlightPopup");
    if (old) old.remove();
    const oldHistory = document.getElementById("clipboardHistoryCard");
    if (oldHistory) oldHistory.remove();

    // Keep a clone of the current selection range for highlight insertion
    const range = selection.getRangeAt(0);
    const selectionRangeClone = range.cloneRange();
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

    function onSettingsLoaded(res) {
      const settings = Object.assign(
        {
          enabledMenu: {
            summarize: true,
            notes: true,
            translate: true,
            history: true,
            highlight: true,
          },
          language: "en",
        },
        res.settings || {}
      );
      const enabled = Object.assign(
        { summarize: true, notes: true, translate: true, history: true, highlight: true },
        settings.enabledMenu || {}
      );
      const lang = settings.language || "en";

      const btn = (id, label) =>
        `<button id="${id}" style="background:none;border:none;color:white;cursor:pointer;">${label}</button>`;
      const labels = {
        summarize: "✨ Summarize",
        notes: "📝 Notes",
        translate: "🌐 Translate",
        history: "📋 History",
        highlight: "🖍️ Highlight",
      };

      popup.innerHTML = `
        ${enabled.summarize ? btn("summarizeBtn", labels.summarize) : ""}
        ${enabled.notes ? btn("notesBtn", labels.notes) : ""}
        ${enabled.translate ? btn("translateBtn", labels.translate) : ""}
        ${enabled.history ? btn("viewHistoryBtn", labels.history) : ""}
        ${enabled.highlight ? btn("highlightBtn", labels.highlight) : ""}
      `;

      document.body.appendChild(popup);
      requestAnimationFrame(() => {
        popup.style.opacity = "1";
        popup.style.transform = "translateX(-50%) translateY(0)";
      });

      // Also show the color picker above the popup immediately
      try {
        const popupRect = popup.getBoundingClientRect();
        showHighlightColorPicker(
          {
            top: popupRect.top,
            left: popupRect.left,
            width: popupRect.width,
            height: popupRect.height,
          },
          // onPick: insert highlight using the saved selection range clone
          (styleSpec) => {
            try {
              const r = selectionRangeClone.cloneRange();
              const extracted = r.extractContents();
              const highlight = document.createElement("span");
              highlight.style.backgroundColor = styleSpec.background;
              if (styleSpec.boxShadow) highlight.style.boxShadow = styleSpec.boxShadow;
              highlight.style.borderRadius = "2px";
              highlight.style.padding = "0 2px";
              highlight.className = "clarity-highlight";
              highlight.appendChild(extracted);
              r.insertNode(highlight);
              window.getSelection().removeAllRanges();
              try { popup.remove(); } catch (_) {}
              window.Clarity.HighlightCore.showTagActionsMenu(highlight);
            } catch (e) {
              console.error("Highlight insert failed:", e);
              alert("Cannot highlight across complex HTML elements. Try a simpler selection.");
            }
          },
          // onCancel: keep popup open
          () => {}
        );
      } catch {}

      const sumBtn = popup.querySelector("#summarizeBtn");
      if (sumBtn) sumBtn.onclick = async () => {
        const modal = createModal("summaryModal", "Summary");
        const content = modal.querySelector(".modal-content");
        showLoadingSpinner(content);
        const r = popup.getBoundingClientRect();
        modal.style.top = `${window.scrollY + r.top - 12}px`;
        modal.style.left = `${window.scrollX + r.left + r.width / 2}px`;
        modal.style.transform = "translateX(-50%) translateY(-100%)";
        modal.style.opacity = "0";
        modal.style.display = "block";
        requestAnimationFrame(() => (modal.style.opacity = "1"));
        try {
          const resp = await fetch("http://localhost:5000/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: selectedText }),
          });
          const data = await resp.json();
          content.innerHTML = markdownToHtml(data.summary || "No summary");
        } catch (e) {
          content.innerHTML = "<p style='color:#a00;'>Failed to fetch summary</p>";
        }
      };

      const notesBtn = popup.querySelector("#notesBtn");
      if (notesBtn) notesBtn.onclick = async () => {
        const modal = createModal("notesModal", "Notes");
        const content = modal.querySelector(".modal-content");
        showLoadingSpinner(content);
        const r = popup.getBoundingClientRect();
        modal.style.top = `${window.scrollY + r.top - 12}px`;
        modal.style.left = `${window.scrollX + r.left + r.width / 2}px`;
        modal.style.transform = "translateX(-50%) translateY(-100%)";
        modal.style.opacity = "0";
        modal.style.display = "block";
        requestAnimationFrame(() => (modal.style.opacity = "1"));
        try {
          const resp = await fetch("http://localhost:5000/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: selectedText }),
          });
          const data = await resp.json();
          content.innerHTML = markdownToHtml(data.notes || "No notes");
        } catch (e) {
          content.innerHTML = "<p style='color:#a00;'>Failed to fetch notes</p>";
        }
      };

      const translateBtn = popup.querySelector("#translateBtn");
      if (translateBtn) translateBtn.onclick = () => {
        alert(`Translate (${lang}): ` + selectedText);
      };

      const histBtn = popup.querySelector("#viewHistoryBtn");
      if (histBtn) histBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.Clarity.Clipboard.showClipboardHistory(popup);
      };

      const hlBtn = popup.querySelector("#highlightBtn");
      if (hlBtn) hlBtn.onclick = () => {
        highlightSelectionWithPicker((highlight) => {
          try { popup.remove(); } catch (_) {}
          window.Clarity.HighlightCore.showTagActionsMenu(highlight);
        });
      };
    }

    chrome.storage.local.get(["settings"], onSettingsLoaded);
  }

  window.Clarity = window.Clarity || {};
  window.Clarity.Popup = { showHighlightPopup };
})();
