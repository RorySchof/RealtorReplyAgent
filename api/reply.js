// api/reply.js

import { generateReply } from "../server/reply.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Missing text" });
    }

    // IDENTICAL LOGIC to Mailgun inbound (via shared generateReply)
    const agent = await generateReply(text);

    return res.status(200).json(agent);
  } catch (err) {
    console.error("Reply generation error:", err);
    return res.status(500).json({ error: "Failed to generate reply" });
  }
}
