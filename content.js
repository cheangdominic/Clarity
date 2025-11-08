let clarityBubble = null;

document.addEventListener("mouseup", (event) => {
  const selection = window.getSelection().toString().trim();
  if (!selection) {
    if (clarityBubble) clarityBubble.remove();
    return;
  }

  const highlight = {
    text: selection,
    summary: null,
    date: new Date().toLocaleString(),
  };

  chrome.storage.local.get(["highlights"], (result) => {
    const current = result.highlights || [];
    current.push(highlight);
    chrome.storage.local.set({ highlights: current });
  });

  const x = event.pageX;
  const y = event.pageY;

  if (!clarityBubble) {
    clarityBubble = document.createElement("div");
    clarityBubble.id = "clarity-bubble";
    clarityBubble.innerText = "🖍️";
    clarityBubble.style.position = "absolute";
    clarityBubble.style.background = "#ffffff";
    clarityBubble.style.border = "1px solid #ccc";
    clarityBubble.style.borderRadius = "50%";
    clarityBubble.style.padding = "6px";
    clarityBubble.style.fontSize = "18px";
    clarityBubble.style.cursor = "pointer";
    clarityBubble.style.zIndex = 999999;
    clarityBubble.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    document.body.appendChild(clarityBubble);

    clarityBubble.addEventListener("click", showClarityToolbar);
  }

  clarityBubble.style.left = `${x + 8}px`;
  clarityBubble.style.top = `${y - 30}px`;
});

function showClarityToolbar() {
  const old = document.getElementById("clarity-toolbar");
  if (old) old.remove();

  const toolbar = document.createElement("div");
  toolbar.id = "clarity-toolbar";
  toolbar.style.position = "absolute";
  toolbar.style.left = clarityBubble.style.left;
  toolbar.style.top = `calc(${clarityBubble.style.top} + 30px)`;
  toolbar.style.background = "#ffffff";
  toolbar.style.border = "1px solid #ddd";
  toolbar.style.borderRadius = "8px";
  toolbar.style.padding = "6px 10px";
  toolbar.style.display = "flex";
  toolbar.style.gap = "10px";
  toolbar.style.fontSize = "14px";
  toolbar.style.zIndex = 999999;
  toolbar.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";

  toolbar.innerHTML = `
    <button>✨ Summarize</button>
    <button>📝 Note</button>
    <button>🌐 Translate</button>
  `;

  document.body.appendChild(toolbar);
}
