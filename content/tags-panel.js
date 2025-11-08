(function () {
  const { tagToColor } = window.Clarity.Common;

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
              if (popup && popup.remove) popup.remove();
            });
          }
        });
      }
    });
  }

  window.Clarity.TagsPanel = { showHighlightsPanel };
})();

