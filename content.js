console.log("content.js loaded");

let popupTimeout;

function showHighlightPopup() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  const oldPopup = document.getElementById("highlightPopup");
  if (oldPopup) oldPopup.remove();

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
    <button id="translateBtn" style="background:none;border:none;color:white;cursor:pointer;">🌍 Translate</button>
    <button id="copyBtn" style="background:none;border:none;color:white;cursor:pointer;">📋 Copy</button>
  `;

  document.body.appendChild(popup);

  requestAnimationFrame(() => {
    popup.style.opacity = "1";
    popup.style.transform = "translateX(-50%) translateY(0)";
  });

  popup.querySelector("#summarizeBtn").addEventListener("click", () => {
    alert("Summarize: " + selectedText);
});

popup.querySelector("#notesBtn").addEventListener("click", async () => {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that converts text into clear, structured, and study-friendly notes. Organize the content into bullet points or numbered lists, highlight key terms, concepts, and examples, and make it easy to review and understand.",
            },
            { role: "user", content: selectedText },
          ],
          max_tokens: 300,
        }),
      }
    );

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      const notes = data.choices[0].message.content;
      popup.innerHTML = `<div style="padding:10px; color:white; max-width:300px; word-wrap:break-word;">📝 Notes:<br>${notes}</div>`;
    } else {
      popup.innerHTML = `<div style="padding:10px; color:red;">No notes returned from API.</div>`;
    }
  } catch (err) {
    console.error(err);
    popup.innerHTML = `<div style="padding:10px; color:red;">Failed to get notes</div>`;
  }
});


popup.querySelector("#translateBtn").addEventListener("click", () => {
    alert("Translate: " + selectedText);
});

popup.querySelector("#copyBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(selectedText);
    popup.innerHTML = "Copied!";
    setTimeout(() => popup.remove(), 1000);
});


  document.addEventListener(
    "click",
    (e) => {
      if (!popup.contains(e.target)) popup.remove();
    },
    { once: true }
  );
}

document.addEventListener("mouseup", () => {
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(showHighlightPopup, 120);
});

document.addEventListener("dblclick", () => {
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(showHighlightPopup, 120);
});

document.addEventListener("selectionchange", () => {
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(showHighlightPopup, 150);
});