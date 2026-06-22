import Groq from "groq-sdk";

export const config = {
  runtime: "edge",
};

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req) {
  try {
    const { messages } = await req.json();

    // --- NORMALIZE MESSAGES ---
    const normalizedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // --- CREATE PROMISE (DO NOT AWAIT YET) ---
    const promise = groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: normalizedMessages,
      temperature: 0.2,
    });

    // --- RAW HTTP RESPONSE BEFORE SDK PARSES IT ---
    const rawResponse = await promise.asResponse();
    const rawText = await rawResponse.clone().text();

    console.error("GROQ RAW HTTP status:", rawResponse.status);
    console.error("GROQ RAW BODY LENGTH:", rawText.length);
    console.error("GROQ RAW BODY END:", rawText.slice(-80));

    // Parse raw JSON to inspect finish_reason + content
    let rawJson;
    try {
      rawJson = JSON.parse(rawText);
    } catch (e) {
      console.error("GROQ RAW JSON PARSE ERROR:", e.message);
      console.error("GROQ RAW TEXT START:", rawText.slice(0, 80));
      console.error("GROQ RAW TEXT END:", rawText.slice(-80));
      return new Response(
        JSON.stringify({ error: "Failed to parse raw Groq JSON" }),
        { status: 500 }
      );
    }

    const choice = rawJson?.choices?.[0];
    const content = choice?.message?.content ?? "";

    // --- EXTRACT JSON OBJECT FROM MODEL OUTPUT ---
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.error("NO JSON OBJECT FOUND IN MODEL OUTPUT");
        console.error("MODEL CONTENT START:", content.slice(0, 200));
        console.error("MODEL CONTENT END:", content.slice(-200));
        parsed = {};
      } else {
        const jsonString = jsonMatch[0];

        try {
          parsed = JSON.parse(jsonString);
        } catch (err) {
          console.error("JSON PARSE ERROR:", err.message);
          console.error("RAW JSON STRING START:", jsonString.slice(0, 200));
          console.error("RAW JSON STRING END:", jsonString.slice(-200));
          parsed = {};
        }
      }
    } catch (err) {
      console.error("UNEXPECTED JSON EXTRACTION ERROR:", err);
      parsed = {};
    }

    console.error("GROQ RAW finish_reason:", choice?.finish_reason);
    console.error("GROQ RAW content length:", content.length);
    console.error("GROQ RAW content end:", content.slice(-20));

    // --- NOW LET SDK PARSE NORMALLY ---
    const completion = await promise;

    // --- RETURN PARSED JSON + RAW COMPLETION ---
    return new Response(
      JSON.stringify({
        parsed,
        completion,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    console.error("Groq proxy error:", err);
    return new Response(JSON.stringify({ error: "Groq proxy failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
