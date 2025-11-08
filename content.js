console.log("content.js loaded");

let popupTimeout;

// Function to create the modal structure for summarize (modified to not apply fixed positioning)
function createSummaryModal() {
  if (document.getElementById("summaryModal")) return; // already exists

  // Modal (We will NOT set position/top/left here, we'll do it in showSummaryPopup)
  const modal = document.createElement("div");
  modal.id = "summaryModal";
  Object.assign(modal.style, {
    // These styles are the core look you wanted to keep
    width: "340px",
    maxWidth: "90%",
    background: "#fff",
    borderRadius: "10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
    zIndex: "999999",
    overflow: "hidden",
    display: "none",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    // We explicitly set the position to absolute, which showSummaryPopup will use
    position: "absolute",
    transition: "opacity 0.2s ease, transform 0.2s ease",
  });

  modal.innerHTML = `
   <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#333;color:#fff;">
     <span style="font-weight:600;">Summary</span>
     <button class="close-btn" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0;line-height:1;">×</button>
   </div>
   <div class="modal-content" style="padding:14px 16px;max-height:220px;overflow:auto;font-size:14px;line-height:1.45;color:#333;"></div>
`;

  // document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  // Close modal when any close button clicked
  modal.querySelectorAll(".close-btn").forEach((btn) => {
    btn.onclick = () => {
      modal.style.display = "none";
    };
  });
}

// Function to show the modal for summarize positioned above the toolbar
function showSummaryPopup(text, toolbar) {
  createSummaryModal();

  const modal = document.getElementById("summaryModal");
  // const backdrop = document.getElementById("summaryBackdrop"); // Not used for anchored position

  modal.querySelector(".modal-content").innerHTML = text;

  // 1. Get the toolbar position
  const toolbarRect = toolbar.getBoundingClientRect();

  // 2. Calculate the position and set the transform (same as clipboard history)
  // This overrides the original fixed-center-screen positioning.
  modal.style.top = `${window.scrollY + toolbarRect.top - 12}px`;
  modal.style.left = `${
    window.scrollX + toolbarRect.left + toolbarRect.width / 2
  }px`;

  // 3. Transform to center it on the X axis and move it up above the toolbar
  modal.style.transform = "translateX(-50%) translateY(-100%)";

  // 4. Show the modal
  modal.style.opacity = "0"; // Start invisible for transition
  modal.style.display = "block";

  // 5. Fade in
  requestAnimationFrame(() => {
    modal.style.opacity = "1";
  });
}

// Function to create the modal structure for notes

// Function to show the modal for notes positioned above the toolbar

// Highlight popup logic
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
  Object.assign(popup.style, {
    position: "absolute",
    top: `${window.scrollY + rect.top - 40}px`,
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

  // Replace alert with modal
  // Example of how the call should look in your content.js:
  popup.querySelector("#summarizeBtn").addEventListener("click", () => {
    // Assuming 'selectedText' holds the text and 'popup' is the toolbar element
    const summaryText = "Your AI summary goes here..."; // Replace with actual summary from API
    showSummaryPopup(summaryText, popup);
  });

  popup.querySelector("#notesBtn").addEventListener("click", () => {
    alert("Notes: " + selectedText);
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

// Event listeners
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
