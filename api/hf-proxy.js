// api/hf-proxy.js

export default async function handler(req, res) {
  try {
    let raw = "";
    for await (const chunk of req) raw += chunk;

    const body = JSON.parse(raw || "{}");
    const { messages } = body || {};

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }

    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        
        model: "meta-llama/Llama-3.3-70B-Instruct:together",

        messages,           // pass your existing role/content array directly, no manual prompt templating needed
        temperature: 0.2,
        max_tokens: 2048,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Surface HF's actual error body — this is where you'll see gated-model / 404 / provider errors
      console.error("HF ERROR:", response.status, JSON.stringify(data));
      return res.status(response.status).json({
        error: "HF request failed",
        hfStatus: response.status,
        hfError: data,
      });
    }

    const content = data?.choices?.[0]?.message?.content ?? "";

    return res.status(200).json({
      hfStatus: response.status,
      hfRaw: data,
      raw: content,
    });
  } catch (err) {
    return res.status(500).json({
      error: "HF proxy crashed",
      details: err.message,
      stack: err.stack,
    });
  }
}