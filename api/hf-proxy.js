export default async function handler(req, res) {
  console.log("=== HF PROXY INVOKED (NODE RUNTIME) ===");

  try {
    // Read raw body from Node stream
    let raw = "";
    for await (const chunk of req) raw += chunk;

    console.log("RAW BODY:", raw);

    let body;
    try {
      body = JSON.parse(raw || "{}");
      console.log("PARSED BODY:", body);
    } catch (err) {
      console.error("JSON PARSE ERROR:", err);
      return res.status(400).json({
        error: "Failed to parse JSON body",
        details: err.message,
      });
    }

    const { messages } = body || {};
    console.log("MESSAGES:", messages);

    const prompt = Array.isArray(messages)
      ? messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")
      : "NO_MESSAGES";

    console.log("PROMPT:", prompt);

    console.log("HF KEY PRESENT:", !!process.env.HF_API_KEY);
    console.log("HF KEY LENGTH:", process.env.HF_API_KEY?.length);

    const hfPayload = {
      inputs: prompt,
      parameters: {
        temperature: 0.2,
        max_new_tokens: 2048,
      },
    };

    console.log("HF PAYLOAD:", hfPayload);

    const response = await fetch(
      "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-70B-Instruct",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(hfPayload),
      }
    );

    console.log("HF STATUS:", response.status);

    let data;
    try {
      data = await response.json();
      console.log("HF RAW:", data);
    } catch (err) {
      console.error("HF JSON PARSE ERROR:", err);
      return res.status(500).json({
        error: "Failed to parse HF JSON",
        details: err.message,
      });
    }

    const text =
      Array.isArray(data) && data[0]?.generated_text
        ? data[0].generated_text
        : data.generated_text || "";

    console.log("HF TEXT:", text);

    return res.status(200).json({
      hfStatus: response.status,
      hfRaw: data,
      raw: text,
    });
  } catch (err) {
    console.error("=== HF PROXY CRASH ===");
    console.error(err);

    return res.status(500).json({
      error: "HF proxy crashed",
      details: err.message,
      stack: err.stack,
    });
  }
}
