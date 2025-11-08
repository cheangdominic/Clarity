(function () {
  const { tagToColor, hexToRgba } = window.Clarity.Common;

  let lastCreatedHighlight = null;
  let hoverHideTimeout = null;
  let menuHovering = false;

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
      { h: 52, s: 95, l: 62 },
      { h: 140, s: 60, l: 60 },
      { h: 210, s: 80, l: 66 },
      { h: 280, s: 60, l: 72 },
      { h: 12, s: 85, l: 66 },
      { h: 190, s: 70, l: 70 },
      { h: 330, s: 65, l: 72 },
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

    const label = document.createElement("label");
    label.textContent = " Custom";
    label.style.fontSize = "12px";
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
    label.appendChild(input);
    picker.appendChild(label);

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

  function showTagActionsMenu(anchorEl) {
    try { document.getElementById("tagActionsMenu")?.remove(); } catch (_) {}
    const rect = anchorEl.getBoundingClientRect();
    const menu = document.createElement("div");
    menu.id = "tagActionsMenu";
    Object.assign(menu.style, {
      position: "absolute",
      top: `${window.scrollY + rect.top - 8}px`,
      left: `${window.scrollX + rect.left + rect.width / 2}px`,
      transform: "translateX(-50%) translateY(-100%)",
      background: "#333",
      color: "#fff",
      padding: "6px 8px",
      borderRadius: "8px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      zIndex: "1000001",
      fontSize: "13px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    });

    const mkBtn = (label) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      Object.assign(btn.style, {
        background: "none",
        border: "none",
        color: "white",
        cursor: "pointer",
        padding: "2px 4px",
      });
      return btn;
    };

    const badgesWrap = document.createElement("div");
    Object.assign(badgesWrap.style, { display: "flex", gap: "6px", alignItems: "center" });
    menu.appendChild(badgesWrap);

    const renderBadges = (colorsMap) => {
      badgesWrap.innerHTML = "";
      const tags = getHighlightTags(anchorEl);
      tags.forEach((t) => {
        const badge = document.createElement("span");
        badge.textContent = t;
        Object.assign(badge.style, {
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "999px",
          fontSize: "11px",
          color: "#fff",
        });
        if (colorsMap && colorsMap[t]) {
          badge.style.background = colorsMap[t];
        } else {
          const hc = tagToColor(t);
          badge.style.background = `hsl(${hc.h}, ${hc.s}%, ${Math.max(35, hc.l - 35)}%)`;
        }
        badgesWrap.appendChild(badge);
      });
    };

    chrome.storage.local.get(["tagColors"], (res) => renderBadges(res.tagColors || {}));

    const createTagBtn = mkBtn("Create Tag");
    const openTagsBtn = mkBtn("Tags");

    createTagBtn.addEventListener("click", () => {
      const existing = getHighlightTags(anchorEl);
      const input = prompt("Enter tags (comma-separated):", existing.join(", "));
      if (input === null) return;
      const tags = input.split(",").map((t) => t.trim()).filter(Boolean);
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
        uniqueTags.forEach((t) => { if (!tagColors[t] && baseColor) tagColors[t] = baseColor; });
        list.unshift(record);
        chrome.storage.local.set({ highlights: list.slice(0, 500), tagColors });
      });

      showTagActionsMenu(anchorEl);
    });

    openTagsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      window.Clarity.TagsPanel.showHighlightsPanel(menu);
    });

    menu.appendChild(createTagBtn);
    menu.appendChild(openTagsBtn);
    document.body.appendChild(menu);

    const closer = (e) => {
      const panel = document.getElementById("highlightsPanel");
      if (!menu.contains(e.target) && (!panel || !panel.contains(e.target))) {
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
        if (panel && !panel.matches(":hover")) { try { panel.remove(); } catch (_) {} }
      }
    }, 180);
  }

  function highlightSelectionWithPicker(onDone) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0).cloneRange();
    const rect = range.getBoundingClientRect();
    showHighlightColorPicker(rect, (styleSpec) => {
      try {
        const extracted = range.extractContents();
        const highlight = document.createElement("span");
        highlight.style.backgroundColor = styleSpec.background;
        if (styleSpec.boxShadow) highlight.style.boxShadow = styleSpec.boxShadow;
        highlight.style.borderRadius = "2px";
        highlight.style.padding = "0 2px";
        highlight.className = "clarity-highlight";
        highlight.appendChild(extracted);
        range.insertNode(highlight);
        selection.removeAllRanges();
        lastCreatedHighlight = highlight;
        if (onDone) onDone(highlight);
      } catch (err) {
        console.error("Highlight failed:", err);
        alert("Cannot highlight across complex HTML elements. Try a simpler selection.");
      }
    });
  }

  window.Clarity.HighlightCore = {
    getHighlightTags,
    setHighlightTags,
    showHighlightColorPicker,
    showTagActionsMenu,
    scheduleHoverMenuHide,
    highlightSelectionWithPicker,
  };
})();

