import Groq from "groq-sdk";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages } = req.body;

    // ⭐ Debug log — this tells us if your .env key is being loaded
    console.log("Proxy running, key exists:", !!process.env.GROQ_API_KEY);

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.2,
    });

    res.status(200).json(completion);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: "Groq proxy failed" });
  }
}
