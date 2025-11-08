import { useEffect, useState } from "react";

function App() {
  const [highlights, setHighlights] = useState([]);

  useEffect(() => {
    chrome.storage.local.get(["highlights"], (result) => {
      if (result.highlights) setHighlights(result.highlights);
    });
  }, []);

  return (
    <div className="w-[320px] h-[450px] bg-[#FAFAFA] p-4 text-[#2B2B2B] overflow-y-auto">
      <h1 className="text-lg font-semibold mb-3">🖍️ Clarity</h1>

      {highlights.length === 0 && (
        <p className="text-sm opacity-50">No saved highlights yet</p>
      )}

      {highlights.map((item, index) => (
        <div key={index} className="p-3 mb-2 bg-white rounded-lg shadow-sm border border-[#ececec]">
          <p className="text-sm mb-2">{item.text}</p>
          {item.summary && (
            <p className="text-xs italic opacity-70 mb-1">“{item.summary}”</p>
          )}
          <p className="text-[10px] opacity-40">{item.date}</p>
        </div>
      ))}
    </div>
  );
}

export default App;
