let popupTimeout;
let documentClickListener = null;
let lastClipboardText = "";
let lastCreatedHighlight = null; 

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
    <button id="highlightBtn" style="background:none;border:none;color:white;cursor:pointer;">💡 Highlight</button>
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
      popup.innerHTML = `<div style="padding:10px; color:white;">✨ Summary: ${data.summary}</div>`;
    } catch (err) {
      console.error(err);
      popup.innerHTML = `<div style="padding:10px; color:red;">Failed to get summary</div>`;
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

  document.querySelector("#highlightBtn").addEventListener("click", () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) return;

    const range = selection.getRangeAt(0);

    try {
      const extracted = range.extractContents();
      const highlight = document.createElement("span");
      highlight.style.backgroundColor = "yellow";
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

  setTimeout(() => {
    documentClickListener = (e) => {
      const historyCard = document.getElementById("clipboardHistoryCard");
      const highlightsPanel = document.getElementById("highlightsPanel");
      if (
        !popup.contains(e.target) &&
        (!historyCard || !historyCard.contains(e.target)) &&
        (!highlightsPanel || !highlightsPanel.contains(e.target))
      ) {
        popup.remove();
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

  chrome.storage.local.get(["clipboard"], (result) => {
    const history = result.clipboard || [];

    const card = document.createElement("div");
    card.id = "clipboardHistoryCard";
    card.style.position = "absolute";

    const popupRect = popup.getBoundingClientRect();
    card.style.top = `${window.scrollY + popupRect.top - 10}px`;
    card.style.left = `${
      window.scrollX + popupRect.left + popupRect.width / 2
    }px`;
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

  chrome.storage.local.get(["highlights"], (result) => {
    const highlights = Array.isArray(result.highlights) ? result.highlights : [];

    const panel = document.createElement("div");
    panel.id = "highlightsPanel";
    panel.style.position = "absolute";
    const popupRect = popup.getBoundingClientRect();
    panel.style.top = `${window.scrollY + popupRect.top - 10}px`;
    panel.style.left = `${window.scrollX + popupRect.left + popupRect.width / 2}px`;
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
      const groups = highlights.reduce((acc, h) => {
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
        const color = tagToColor(tag);
        const section = document.createElement("div");
        section.style.border = "1px solid #eee";
        section.style.borderRadius = "8px";

        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.alignItems = "center";
        header.style.justifyContent = "space-between";
        header.style.padding = "8px 10px";
        header.style.cursor = "pointer";
        header.style.background = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.25)`;
        header.style.borderBottom = "1px solid #eee";

        const left = document.createElement("div");
        const badge = document.createElement("span");
        badge.textContent = tag;
        badge.style.display = "inline-block";
        badge.style.padding = "2px 8px";
        badge.style.borderRadius = "999px";
        badge.style.background = `hsl(${color.h}, ${color.s}%, ${Math.max(35, color.l - 35)}%)`;
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
          openBtn.style.background = "#fff";
          openBtn.style.borderRadius = "6px";
          openBtn.style.padding = "4px 8px";
          openBtn.style.cursor = "pointer";
          openBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            window.open(item.url, "_blank");
          });

          const copyBtn = document.createElement("button");
          copyBtn.textContent = "Copy";
          copyBtn.style.fontSize = "11px";
          copyBtn.style.border = "1px solid #ddd";
          copyBtn.style.background = "#fff";
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
            popup.remove();
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
  menu.style.gap = "8px";

  const mkBtn = (label) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.background = "none";
    btn.style.border = "none";
    btn.style.color = "white";
    btn.style.cursor = "pointer";
    btn.style.padding = "2px 4px";
    return btn;
  };

  const createTagBtn = mkBtn("Create Tag");
  const openTagsBtn = mkBtn("Tags");

  createTagBtn.addEventListener("click", () => {
    const currentTag = anchorEl.dataset.tag || "";
    const tag = prompt("Enter a tag for the highlighted text:", currentTag);
    if (tag === null) return; 
    const cleanTag = (tag || "untagged").trim();

    const color = tagToColor(cleanTag);
    anchorEl.style.backgroundColor = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.35)`;
    anchorEl.style.borderRadius = "2px";
    anchorEl.style.padding = "0 2px";
    anchorEl.style.boxShadow = `inset 0 0 0 1px hsl(${color.h}, ${color.s}%, ${Math.max(0, color.l - 10)}%)`;
    anchorEl.classList.add("clarity-highlight");
    anchorEl.dataset.tag = cleanTag;
    anchorEl.title = `Tag: ${cleanTag}`;

    const item = {
      tag: cleanTag,
      text: anchorEl.textContent || "",
      url: location.href,
      title: document.title,
      date: new Date().toISOString(),
    };
    chrome.storage.local.get(["highlights"], (result) => {
      const list = Array.isArray(result.highlights) ? result.highlights : [];
      list.unshift(item);
      chrome.storage.local.set({ highlights: list.slice(0, 500) });
    });
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
    if (
      !menu.contains(e.target) &&
      (!panel || !panel.contains(e.target))
    ) {
      try { menu.remove(); } catch (_) {}
      if (panel) try { panel.remove(); } catch (_) {}
      document.removeEventListener("click", closer);
    }
  };
  setTimeout(() => document.addEventListener("click", closer), 0);
}

function getHighlightFromSelection() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const node = sel.getRangeAt(0).startContainer;
  return findAncestorHighlight(node);
}

function findAncestorHighlight(node) {
  let el = node && node.nodeType === 1 ? node : node && node.parentElement;
  while (el) {
    if (el.classList && el.classList.contains("clarity-highlight")) return el;
    el = el.parentElement;
  }
  return null;
}

function getLastHighlightInDocument() {
  const nodes = document.querySelectorAll(".clarity-highlight");
  return nodes.length ? nodes[nodes.length - 1] : null;
}

document.addEventListener("dblclick", () => {
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(showHighlightPopup, 120);
});

document.addEventListener("selectionchange", () => {
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(showHighlightPopup, 150);
});
