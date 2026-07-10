
export const config = {
    runtime: "nodejs20.x",
  };
  
  export default async function handler(req) {
    try {
      const { messages } = await req.json();
  
      // Flatten OpenAI-style messages into a single prompt
      const prompt = messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");
  
      const response = await fetch(
        "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-70B-Instruct",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              temperature: 0.2,
              max_new_tokens: 2048,
            },
          }),
        }
      );
  
      const data = await response.json();
  
      // HF returns either { generated_text } or an array
      const text =
        Array.isArray(data) && data[0]?.generated_text
          ? data[0].generated_text
          : data.generated_text || "";
  
      // Extract JSON object from the model output
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      let parsed = {};
  
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (err) {
          parsed = { error: "Failed to parse JSON from HF output" };
        }
      }
  
      return new Response(
        JSON.stringify({
          parsed,
          raw: text,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: "HF proxy failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }