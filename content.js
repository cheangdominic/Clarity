let popupTimeout;
let documentClickListener = null;
let lastClipboardText = "";
let lastCreatedHighlight = null; 
let hoverHideTimeout = null; // for hover-based menu hide
let menuHovering = false; // track mouse over mini-menu

setInterval(async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text && text !== lastClipboardText && text.trim().length > 0) {
      lastClipboardText = text
      chrome.runtime.sendMessage({ action: "saveToClipboard", text })
    }
  } catch {}
}, 500)

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function inlineMarkdown(s) {
  s = s.replace(/`([^`]+)`/g, (_, p1) => `<code>${p1}</code>`)
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, p1) => `<strong>${p1}</strong>`)
  s = s.replace(/\*([^*]+)\*/g, (_, p1) => `<em>${p1}</em>`)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, p1, p2) => `<a href="${p2}" target="_blank">${p1}</a>`)
  return s
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

function createModal(id, title) {
  if (document.getElementById(id)) return
  const modal = document.createElement("div")
  modal.id = id
  Object.assign(modal.style, {
    width: "380px",
    maxWidth: "90%",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
    zIndex: "999999",
    overflow: "hidden",
    display: "none",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    position: "absolute",
    transition: "opacity 0.2s ease, transform 0.2s ease",
  })
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#111;color:#fff;">
      <span style="font-weight:600;">${title}</span>
      <button aria-label="Close" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">×</button>
    </div>
    <div class="modal-content" style="padding:16px;max-height:320px;overflow:auto;font-size:14px;"></div>
  `
  document.body.appendChild(modal)
  modal.querySelector("button").onclick = () => (modal.style.display = "none")
}

function showModal(id, title, text, toolbar) {
  createModal(id, title)
  const modal = document.getElementById(id)
  modal.querySelector(".modal-content").innerHTML = markdownToHtml(text.trim())
  const rect = toolbar.getBoundingClientRect()
  modal.style.top = `${window.scrollY + rect.top - 12}px`
  modal.style.left = `${window.scrollX + rect.left + rect.width / 2}px`
  modal.style.transform = "translateX(-50%) translateY(-100%)"
  modal.style.opacity = "0"
  modal.style.display = "block"
  requestAnimationFrame(() => (modal.style.opacity = "1"))
}

function showHighlightPopup() {
  const selection = window.getSelection()
  const selectedText = selection.toString().trim()
  if (!selectedText) return

  document.getElementById("highlightPopup")?.remove()
  document.getElementById("clipboardHistoryCard")?.remove()
  if (documentClickListener) {
    document.removeEventListener("click", documentClickListener)
    documentClickListener = null
  }

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  const popup = document.createElement("div")
  popup.id = "highlightPopup"
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
  })
  popup.innerHTML = `
    <button id="summarizeBtn" style="background:none;border:none;color:white;cursor:pointer;">✨ Summarize</button>
    <button id="notesBtn" style="background:none;border:none;color:white;cursor:pointer;">📝 Notes</button>
    <button id="translateBtn" style="background:none;border:none;color:white;cursor:pointer;">🌐 Translate</button>
    <button id="viewHistoryBtn" style="background:none;border:none;color:white;cursor:pointer;">📋 History</button>
    <button id="highlightBtn" style="background:none;border:none;color:white;cursor:pointer;">💡 Highlight</button>
  `;

  document.body.appendChild(popup);

  requestAnimationFrame(() => {
    popup.style.opacity = "1"
    popup.style.transform = "translateX(-50%) translateY(0)"
  })

  popup.querySelector("#summarizeBtn").onclick = async () => {
    try {
      const res = await fetch("http://localhost:5000/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText }),
      })
      const data = await res.json()
      showModal("summaryModal", "Summary", data.summary || "No summary", popup)
    } catch {
      showModal("summaryModal", "Summary", "Failed to fetch summary", popup)
    }
  }

  popup.querySelector("#notesBtn").onclick = async () => {
    try {
      const res = await fetch("http://localhost:5000/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText }),
      })
      const data = await res.json()
      showModal("notesModal", "Notes", data.notes || "No notes", popup)
    } catch {
      showModal("notesModal", "Notes", "Failed to fetch notes", popup)
    }
  }

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

    const range = selection.getRangeAt(0).cloneRange();
    const rectSel = range.getBoundingClientRect();

    showHighlightColorPicker(rectSel, (styleSpec) => {
      try {
        const extracted = range.extractContents();
        const highlight = document.createElement("span");
        // apply chosen color style
        highlight.style.backgroundColor = styleSpec.background;
        if (styleSpec.boxShadow) highlight.style.boxShadow = styleSpec.boxShadow;
        highlight.style.borderRadius = "2px";
        highlight.style.padding = "0 2px";
        highlight.className = "clarity-highlight";
        highlight.appendChild(extracted);
        range.insertNode(highlight);
        selection.removeAllRanges();
        lastCreatedHighlight = highlight;

        try { popup.remove(); } catch (_) {}
        if (documentClickListener) {
          document.removeEventListener("click", documentClickListener);
          documentClickListener = null;
        }
        showTagActionsMenu(highlight);
      } catch (err) {
        console.error("Highlight failed, likely spans multiple elements:", err);
        alert("Cannot highlight across complex HTML elements. Try a simpler selection.");
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
        popup.remove();
        if (historyCard) historyCard.remove();
        if (highlightsPanel) highlightsPanel.remove();
        document.removeEventListener("click", documentClickListener);
        documentClickListener = null;
      }
    }
    document.addEventListener("click", documentClickListener)
  }, 300)
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
        </div>`
    } else {
      card.innerHTML = `
        <div style="font-weight:bold;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
          <span>📋 Clipboard History</span>
          <button id="clearHistoryBtn" style="background:#ff5252;color:white;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;">Clear</button>
        </div>`
      const list = document.createElement("div")
      list.style.display = "flex"
      list.style.flexDirection = "column"
      list.style.gap = "8px"
      history.slice(0, 10).forEach((item) => {
        const div = document.createElement("div")
        Object.assign(div.style, {
          padding: "10px",
          background: "#f7f7f7",
          borderRadius: "8px",
          cursor: "pointer",
          transition: "background 0.2s",
          border: "1px solid #eee",
          position: "relative",
        })
        div.innerHTML = `
          <div style="font-size:10px;color:#666;margin-bottom:4px;">${escapeHtml(
            item.date || ""
          )}</div>
          <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(
            item.text || ""
          )}</div>`
        div.onclick = (e) => {
          e.stopPropagation()
          navigator.clipboard.writeText(item.text)
          div.style.background = "#c8e6c9"
          const fb = document.createElement("div")
          fb.textContent = "✓ Copied"
          Object.assign(fb.style, {
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
          })
          div.appendChild(fb)
          setTimeout(() => {
            div.style.background = "#f5f5f5"
            fb.remove()
          }, 1000)
        }
        div.onmouseenter = () => (div.style.background = "#e0e0e0")
        div.onmouseleave = () => (div.style.background = "#f5f5f5")
        list.appendChild(div)
      })
      card.appendChild(list)
      card.querySelector("#clearHistoryBtn").onclick = (e) => {
        e.stopPropagation()
        if (confirm("Clear all clipboard history?"))
          chrome.storage.local.set({ clipboard: [] }, () => {
            card.remove()
            popup.remove()
          })
      }
    }
    document.body.appendChild(card)
    requestAnimationFrame(() => (card.style.opacity = "1"))
  })
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

  chrome.storage.local.get(["highlights", "tagColors"], (result) => {
    const highlights = Array.isArray(result.highlights) ? result.highlights : [];
    const tagColors = result.tagColors && typeof result.tagColors === "object" ? result.tagColors : {};

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
      const flat = [];
      highlights.forEach((h) => {
        const tags = Array.isArray(h.tags) && h.tags.length ? h.tags : ((h.tag || "").trim() ? [h.tag.trim()] : ["untagged"]);
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
        header.style.background = colorStr ? colorStr : `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.25)`;
        header.style.borderBottom = "1px solid #eee";

        const left = document.createElement("div");
        const badge = document.createElement("span");
        badge.textContent = tag;
        badge.style.display = "inline-block";
        badge.style.padding = "2px 8px";
        badge.style.borderRadius = "999px";
        badge.style.background = colorStr ? colorStr : `hsl(${color.h}, ${color.s}%, ${Math.max(35, color.l - 35)}%)`;
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
        badge.style.background = `hsl(${hc.h}, ${hc.s}%, ${Math.max(35, hc.l - 35)}%)`;
        badge.style.color = "#fff";
      }
      badge.style.fontSize = "11px";
      badgesWrap.appendChild(badge);
    });
  };

  chrome.storage.local.get(["tagColors"], (res) => {
    renderBadges(res.tagColors || {});
  });

  const createTagBtn = mkBtn("Create Tag");
  const openTagsBtn = mkBtn("Tags");

  createTagBtn.addEventListener("click", () => {
    const existing = getHighlightTags(anchorEl);
    const input = prompt(
      "Enter tags (comma-separated):",
      existing.join(", ")
    );
    if (input === null) return; 
    const tags = input
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const uniqueTags = Array.from(new Set(tags));
    setHighlightTags(anchorEl, uniqueTags);

    const record = {
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
      const tagColors = result.tagColors && typeof result.tagColors === "object" ? result.tagColors : {};

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

function scheduleHoverMenuHide(anchorEl) {
  if (hoverHideTimeout) clearTimeout(hoverHideTimeout);
  hoverHideTimeout = setTimeout(() => {
    const menu = document.getElementById("tagActionsMenu");
    if (!menu) return;
    if (menuHovering) return;
    const stillOnHighlight = anchorEl && anchorEl.matches(":hover");
    const stillOnMenu = menu.matches(":hover");
    if (!stillOnHighlight && !stillOnMenu) {
      try { menu.remove(); } catch (_) {}
      const panel = document.getElementById("highlightsPanel");
      if (panel && !panel.matches(":hover")) {
        try { panel.remove(); } catch (_) {}
      }
    }
  }, 180);
}

function showHighlightColorPicker(rect, onPick, onCancel) {
  const id = "highlightColorPicker";
  document.getElementById(id)?.remove();
  const picker = document.createElement("div");
  picker.id = id;
  Object.assign(picker.style, {
    position: "absolute",
    top: `${window.scrollY + rect.top - 8}px`,
    left: `${window.scrollX + rect.left + rect.width / 2}px`,
    transform: "translateX(-50%) translateY(-100%)",
    background: "#111",
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
    { h: 52, s: 95, l: 62 },   // yellow
    { h: 140, s: 60, l: 60 },  // green
    { h: 210, s: 80, l: 66 },  // blue
    { h: 280, s: 60, l: 72 },  // purple
    { h: 12, s: 85, l: 66 },   // orange
    { h: 190, s: 70, l: 70 },  // cyan
    { h: 330, s: 65, l: 72 },  // pink
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
      try { picker.remove(); } catch (_) {}
      onPick({ background: bg, boxShadow: `inset 0 0 0 1px hsl(${c.h}, ${c.s}%, ${Math.max(0, c.l - 10)}%)` });
    });
    picker.appendChild(dot);
  });

  const customWrap = document.createElement("label");
  customWrap.textContent = " Custom";
  customWrap.style.fontSize = "12px";
  const input = document.createElement("input");
  input.type = "color";
  input.value = "#ffff00";
  input.style.marginLeft = "6px";
  input.addEventListener("input", () => {
    const hex = input.value;
    const rgba = hexToRgba(hex, 0.35);
    const border = hexToRgba(hex, 0.6);
    try { picker.remove(); } catch (_) {}
    onPick({ background: rgba, boxShadow: `inset 0 0 0 1px ${border}` });
  });
  customWrap.appendChild(input);
  picker.appendChild(customWrap);

  document.body.appendChild(picker);

  const close = (e) => {
    if (!picker.contains(e.target)) {
      try { picker.remove(); } catch (_) {}
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
  const unique = Array.from(new Set((tags || []).map((t) => t.trim()).filter(Boolean)));
  if (!el.dataset) el.dataset = {};
  el.dataset.tags = unique.join(",");
  el.title = unique.length ? `Tags: ${unique.join(", ")}` : "";
  el.classList.add("clarity-highlight");
}

document.addEventListener("dblclick", () => {
  clearTimeout(popupTimeout)
  popupTimeout = setTimeout(showHighlightPopup, 120)
})

document.addEventListener("selectionchange", () => {
  clearTimeout(popupTimeout)
  popupTimeout = setTimeout(showHighlightPopup, 150)
})

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
