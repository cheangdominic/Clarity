const switchEl = document.getElementById("switch");
const checkbox = document.getElementById("extensionToggle");
const statusText = document.getElementById("statusText");

function setVisualState(isDisabled) {
  const isEnabled = !isDisabled;
  switchEl.dataset.checked = isEnabled ? "true" : "false";
  switchEl.setAttribute("aria-checked", String(isEnabled));
  checkbox.checked = isEnabled;
  statusText.textContent = isEnabled ? "Enabled" : "Disabled";
}

chrome.storage.local.get(["extensionDisabled"], (res) => {
  const isDisabled = !!res.extensionDisabled;
  setVisualState(isDisabled);
});

switchEl.addEventListener("click", () => {
  chrome.storage.local.get(["extensionDisabled"], (res) => {
    const currentlyDisabled = !!res.extensionDisabled;
    const newDisabled = !currentlyDisabled;
    chrome.storage.local.set({ extensionDisabled: newDisabled }, () => {
      setVisualState(newDisabled);
    });
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.extensionDisabled) {
    setVisualState(!!changes.extensionDisabled.newValue);
  }
});
