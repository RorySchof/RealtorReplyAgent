export const runtime = "nodejs20.x";

export async function POST(request: Request) {
  console.log("=== HF PROXY START ===");

  try {
    const body = await request.json();
    console.log("Request JSON:", body);

    const { messages } = body || {};
    console.log("Messages:", messages);

    const prompt = Array.isArray(messages)
      ? messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")
      : "NO_MESSAGES_PROVIDED";

    console.log("Prompt:", prompt);

    console.log("HF KEY PRESENT:", !!process.env.HF_API_KEY);
    console.log("HF KEY LENGTH:", process.env.HF_API_KEY?.length);

    const hfPayload = {
      inputs: prompt,
      parameters: {
        temperature: 0.2,
        max_new_tokens: 2048,
      },
    };

    console.log("HF Payload:", hfPayload);

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

    const data = await response.json();
    console.log("HF Raw Response:", data);

    const text =
      Array.isArray(data) && data[0]?.generated_text
        ? data[0].generated_text
        : data.generated_text || "";

    console.log("HF Generated Text:", text);

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
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("=== HF PROXY ERROR ===");
    console.error(err);

    return new Response(
      JSON.stringify({
        error: "HF proxy failed",
        details: err.message || err,
        stack: err.stack || null,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

