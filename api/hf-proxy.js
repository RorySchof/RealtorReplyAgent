export default async function handler(req, res) {
  try {
    let raw = "";
    for await (const chunk of req) raw += chunk;

    const body = JSON.parse(raw || "{}");
    const { messages } = body || {};

    const prompt = Array.isArray(messages)
      ? messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")
      : "NO_MESSAGES";

    const hfPayload = {
      inputs: prompt,
      parameters: {
        temperature: 0.2,
        max_new_tokens: 2048,
      },
    };

    const response = await fetch(
      "https://inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-70B-Instruct",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(hfPayload),
      }
    );

    const data = await response.json();

    return res.status(200).json({
      hfStatus: response.status,
      hfRaw: data,
      raw: data?.generated_text || "",
    });
  } catch (err) {
    return res.status(500).json({
      error: "HF proxy crashed",
      details: err.message,
      stack: err.stack,
    });
  }
}


