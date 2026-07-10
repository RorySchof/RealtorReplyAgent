
export const runtime = "edge";

export async function POST(request: Request) {
  console.log("=== HF PROXY INVOKED (EDGE RUNTIME) ===");

  const body = await request.json();
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
    "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-8B-Instruct",
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

  return new Response(
    JSON.stringify({
      hfStatus: response.status,
      hfRaw: data,
      raw: data[0]?.generated_text || data.generated_text || "",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
