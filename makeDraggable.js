// function makeModalDraggable(modal) {
//   const header = modal.querySelector(".modal-header");
//   if (!header) return;
//   let offsetX = 0,
//     offsetY = 0,
//     isDragging = false;
//   header.style.cursor = "move";

//   header.addEventListener("mousedown", (e) => {
//     isDragging = true;
//     const rect = modal.getBoundingClientRect();
//     offsetX = e.clientX - rect.left;
//     offsetY = e.clientY - rect.top;
//     modal.style.transition = "none";
//     modal.style.transform = "none";
//     document.body.style.userSelect = "none";
//   });

//   document.addEventListener("mousemove", (e) => {
//     if (!isDragging) return;

//     // --- New Boundary Logic ---
//     let newX = e.clientX - offsetX;
//     let newY = e.clientY - offsetY;

//     // Get the dimensions of the modal
//     const modalRect = modal.getBoundingClientRect();

//     // Clamp X position (left edge at 0, right edge at window width - modal width)
//     newX = Math.max(0, Math.min(newX, window.innerWidth - modalRect.width));

//     // Clamp Y position (top edge at 0, bottom edge at window height - modal height)
//     newY = Math.max(0, Math.min(newY, window.innerHeight - modalRect.height));

//     // Apply clamped position
//     modal.style.left = `${newX}px`;
//     modal.style.top = `${newY}px`;
//     // --- End Boundary Logic ---

//     // modal.style.left = `${e.clientX - offsetX}px`;
//     // modal.style.top = `${e.clientY - offsetY}px`;
//     // modal.style.transform = "none";
//   });
//   document.addEventListener("mouseup", () => {
//     isDragging = false;
//     modal.style.transition = "opacity 0.2s ease, transform 0.2s ease";
//     document.body.style.userSelect = "auto";
//   });

//   modal.addEventListener("mouseenter", () => {
//     if (modal._highlight) modal._highlight.style.backgroundColor = "#fbf719";
//   });

//   modal.addEventListener("mouseleave", () => {
//     if (modal._highlight) modal._highlight.style.backgroundColor = "";
//   });
// }
