(function () {
  const Common = {};

  Common.escapeHtml = function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  Common.inlineMarkdown = function inlineMarkdown(s) {
    s = s.replace(/`([^`]+)`/g, (_, p1) => `<code>${p1}</code>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, (_, p1) => `<strong>${p1}</strong>`);
    s = s.replace(/\*([^*]+)\*/g, (_, p1) => `<em>${p1}</em>`);
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, p1, p2) => `<a href="${p2}" target="_blank">${p1}</a>`);
    return s;
  };

  Common.markdownToHtml = function markdownToHtml(md) {
    md = Common.escapeHtml(md || "");
    const lines = String(md).split(/\r?\n/);
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
        html += `<h${level} style="margin:10px 0 6px;font-weight:700;color:#111;">${Common.inlineMarkdown(
          h[2]
        )}</h${level}>`;
        continue;
      }

      const isBullet = /^[-*•]\s+/.test(line);
      const nextIdx = nextNonEmptyIndex(i);
      const nextIsBullet = nextIdx !== -1 && /^[-*•]\s+/.test(lines[nextIdx].trim());

      if (!isBullet && nextIsBullet) {
        html += `<p style="margin:10px 0 6px;font-weight:700;color:#111;">${Common.inlineMarkdown(
          line
        )}</p>`;
        continue;
      }

      if (isBullet) {
        const content = line.replace(/^[-*•]\s+/, "");
        html += `<p style="margin:4px 0 4px 16px;line-height:1.5;color:#222;">• ${Common.inlineMarkdown(
          content
        )}</p>`;
        continue;
      }

      html += `<p style="margin:8px 0;line-height:1.6;color:#222;">${Common.inlineMarkdown(
        line
      )}</p>`;
    }

    return html || "<p style='color:#666;'>No content</p>";
  };

  Common.tagToColor = function tagToColor(tag) {
    let hash = 0;
    for (let i = 0; i < String(tag).length; i++) {
      hash = (hash << 5) - hash + String(tag).charCodeAt(i);
      hash |= 0;
    }
    const h = Math.abs(hash) % 360;
    const s = 65;
    const l = 75;
    return { h, s, l };
  };

  Common.hexToRgba = function hexToRgba(hex, alpha) {
    const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!res) return hex;
    const r = parseInt(res[1], 16);
    const g = parseInt(res[2], 16);
    const b = parseInt(res[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  Common.showLoadingSpinner = function showLoadingSpinner(container) {
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100px;color:#666;">
        <div style="border:4px solid #f3f3f3;border-top:4px solid #333;border-radius:50%;width:28px;height:28px;animation:clarity-spin 1s linear infinite;"></div>
        <div style="margin-top:10px;font-size:13px;">Loading...</div>
      </div>
      <style>@keyframes clarity-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>
    `;
  };

  window.Clarity.Common = Common;
})();
