document.addEventListener("mouseup", () => {
  const selection = window.getSelection().toString().trim();
  window.lastSelection = selection;
});
