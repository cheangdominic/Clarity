document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        func: () => window.getSelection().toString().trim(),
      },
      (results) => {
        const selection = results[0].result;
        document.getElementById("highlightedTextDisplay").innerText =
          selection || "No text highlighted yet";
      }
    );
  });
});
