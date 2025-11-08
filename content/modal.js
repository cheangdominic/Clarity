(function () {
  const { markdownToHtml } = window.Clarity.Common;

  function createModal(id, title) {
    if (document.getElementById(id)) return document.getElementById(id);
    const modal = document.createElement("div");
    modal.id = id;
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
    });
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#111;color:#fff;">
        <span style="font-weight:600;">${title}</span>
        <button aria-label="Close" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">×</button>
      </div>
      <div class="modal-content" style="padding:16px;max-height:320px;overflow:auto;font-size:14px;"></div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("button").onclick = () => (modal.style.display = "none");
    return modal;
  }

  function showModal(id, title, text, toolbarEl) {
    const modal = createModal(id, title);
    modal.querySelector(".modal-content").innerHTML = markdownToHtml(String(text || "").trim());
    const rect = toolbarEl.getBoundingClientRect();
    modal.style.top = `${window.scrollY + rect.top - 12}px`;
    modal.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;
    modal.style.transform = "translateX(-50%) translateY(-100%)";
    modal.style.opacity = "0";
    modal.style.display = "block";
    requestAnimationFrame(() => (modal.style.opacity = "1"));
  }

  window.Clarity.Modal = { createModal, showModal };
})();

