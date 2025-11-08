chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "openaiRequest") {
    fetch("http://localhost:5000/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.payload),
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));

    return true;
  }
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveToClipboard") {
    chrome.storage.local.get(["clipboard"], (result) => {
      const history = result.clipboard || [];
      history.unshift({
        text: request.text,
        date: new Date().toLocaleString(),
      });

      chrome.storage.local.set({ clipboard: history.slice(0, 50) }, () => {
        sendResponse({ success: true });
      });
    });
    return true; 
  }
});