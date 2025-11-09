import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.post("/summarize", async (req, res) => {
  const { text } = req.body;
  console.log("\nInput Text:", text);

  if (!text || text.trim().length === 0) {
    const message = "Not enough context to summarize";
    console.log("Generated Summary:", message);
    return res.json({ summary: message });
  }

  try {
    const checkResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that evaluates text for summarization.",
            },
            {
              role: "user",
              content: `Determine if the following text is long enough and meaningful enough to summarize. 
Do not summarize it yet. Only respond with YES or NO. 
If it's too short or just a definition, respond NO.\n\nText: ${text}`,
            },
          ],
          max_completion_tokens: 20,
        }),
      }
    );

    const checkData = await checkResponse.json();
    const decisionRaw =
      checkData?.choices?.[0]?.message?.content?.toUpperCase() || "";

    const decision = decisionRaw.includes("YES") ? "YES" : "NO";

    if (decision !== "YES") {
      const message = "Not enough context to summarize";
      console.log("Generated Summary:", message);
      return res.json({ summary: message });
    }

    const summaryResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant. Summarize the text concisely, focusing on the key ideas only." +
                "The length of the text should be much less than the length of the selected text. Briefly convey the idea leaving only important ideas.",
            },
            { role: "user", content: text },
          ],
          max_completion_tokens: 250,
        }),
      }
    );

    const summaryData = await summaryResponse.json();
    const summary =
      summaryData?.choices?.[0]?.message?.content?.trim() ||
      "No summary generated";

    console.log("Generated Summary:", summary);

    res.json({ summary });
  } catch (err) {
    console.error("OpenAI API error:", err);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

app.post("/notes", async (req, res) => {
  const { text } = req.body;
  console.log("\nInput Text:", text);

  if (!text || text.trim().length === 0) {
    const message = "Not enough content to make notes";
    console.log("Generated Notes:", message);
    return res.json({ notes: message });
  }

  try {
    const checkResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that evaluates text for formatted notes.",
            },
            {
              role: "user",
              content: `Determine if the following text is long enough and meaningful enough to create study notes. 
              Do not create any notes yet. Only respond with YES or NO. 
              If it's too short, a single definition, or lacks enough information to form notes, respond NO.\n\nText: ${text}`,
            },
          ],
          max_completion_tokens: 20,
        }),
      }
    );

    const checkData = await checkResponse.json();
    const decisionRaw =
      checkData?.choices?.[0]?.message?.content?.toUpperCase() || "";

    const decision = decisionRaw.includes("YES") ? "YES" : "NO";

    if (decision !== "YES") {
      const message = "Not enough content to write notes";
      console.log("Generated Notes:", message);
      return res.json({ notes: message });
    }

    const notesResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a helpful note-taking assistant. Create concise, well-formatted notes based on the provided text.
              - Use plain text only (no Markdown, no asterisks, no bold or italics).
              - Use simple bullet points (- or •).
              - Focus on clear study notes with short, meaningful phrases.
              - Avoid filler words, redundant text, and examples unless needed for understanding.
              - Format output for readability, not decoration.
              - If it is a title of a subsection then do not have a bullet point
              - Note sections should have a title followed by points. Seperate sections with a new line in between the last section and the new one.`,
            },
            { role: "user", content: text },
          ],
          max_completion_tokens: 250,
        }),
      }
    );

    const notesData = await notesResponse.json();
    const notes =
      notesData?.choices?.[0]?.message?.content?.trim() || "No notes generated";

    console.log("Generated Notes:", notes);

    res.json({ notes });
  } catch (err) {
    console.error("OpenAI API error:", err);
    res.status(500).json({ error: "Failed to generate notes" });
  }
});

app.post("/openai", async (req, res) => {
  const { model, messages, max_tokens } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model, messages, max_tokens }),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
