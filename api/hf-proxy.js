export default async function handler(req) {
  console.log("=== HF PROXY START ===");

  try {
    // Parse request
    let body;
    try {
      body = await req.json();
      console.log("Request JSON:", body);
    } catch (err) {
      console.error("Failed to parse req.json()", err);
      return new Response(
        JSON.stringify({
          error: "Failed to parse JSON body",
          details: err.message,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages } = body || {};
    console.log("Messages:", messages);

    // Build prompt
    const prompt = Array.isArray(messages)
      ? messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")
      : "NO_MESSAGES_PROVIDED";

    console.log("Prompt:", prompt);

    // Check env var
    console.log("HF KEY PRESENT:", !!process.env.HF_API_KEY);
    console.log("HF KEY LENGTH:", process.env.HF_API_KEY?.length);

    // Build HF request payload
    const hfPayload = {
      inputs: prompt,
      parameters: {
        temperature: 0.2,
        max_new_tokens: 2048,
      },
    };

    console.log("HF Payload:", hfPayload);

    // Make HF request
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

    console.log("HF Status:", response.status);

    let data;
    try {
      data = await response.json();
      console.log("HF Raw Response:", data);
    } catch (err) {
      console.error("Failed to parse HF JSON response:", err);
      return new Response(
        JSON.stringify({
          error: "Failed to parse HF JSON response",
          details: err.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract text
    const text =
      Array.isArray(data) && data[0]?.generated_text
        ? data[0].generated_text
        : data.generated_text || "";

    console.log("HF Generated Text:", text);

    // Try to parse JSON inside model output
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    let parsed = {};

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
        console.log("Parsed JSON:", parsed);
      } catch (err) {
        console.error("Failed to parse JSON from HF output:", err);
        parsed = { error: "Failed to parse JSON from HF output" };
      }
    } else {
      console.log("No JSON found in HF output");
    }

    console.log("=== HF PROXY SUCCESS ===");

    return new Response(
      JSON.stringify({
        parsed,
        raw: text,
        hfStatus: response.status,
        hfRaw: data,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("=== HF PROXY ERROR ===");
    console.error(err);

    return new Response(
      JSON.stringify({
        error: "HF proxy failed",
        details: err.message || err,
        stack: err.stack || null,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
