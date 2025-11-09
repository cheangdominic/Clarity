//   popup.querySelector("#summarizeBtn").onclick = async () => {
//     const modal = createModal(`summaryModal-${Date.now()}`, "Summary");
//     modal._highlight = highlightSpan;
//     const content = modal.querySelector(".modal-content");
//     showLoadingSpinner(content);
//     modal.style.display = "block";
//     const rect = popup.getBoundingClientRect();
//     modal.style.top = `${window.scrollY + rect.top - 12}px`;
//     modal.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;
//     modal.style.transform = "translateX(-50%) translateY(-100%)";
//     modal.style.opacity = "0";
//     modal.style.zIndex = "10000";
//     requestAnimationFrame(() => (modal.style.opacity = "1"));
//     try {
//       const res = await fetch("http://localhost:5000/summarize", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ text: selectedText }),
//       });
//       const data = await res.json();
//       content.innerHTML = data.summary || "No summary available.";
//     } catch {
//       content.innerHTML = `<p style="color:#a00;">Failed to fetch summary.</p>`;
//     }
//   };
