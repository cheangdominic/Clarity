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
