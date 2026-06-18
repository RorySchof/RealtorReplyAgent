// src/agent.js

const SYSTEM_PROMPT = `You are a professional and warm real estate assistant.
Infer missing steps. Return ONLY strict JSON with keys:
action_items, client_questions, followup_items, reply.`;

// Groq endpoint + model
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-70b-versatile";

// Required JSON keys
const REQUIRED_KEYS = ["action_items", "client_questions", "followup_items", "reply"];

// --- REAL LLM CALL (GROQ) ---
async function callGroqLLM(inputText) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: inputText }
  ];

  const response = await fetch("/api/groq-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ messages })
  });

  if (!response.ok) {
    throw new Error("Proxy request failed");
  }

  return response;
}

// --- MOCK FALLBACK (unchanged) ---
async function mockLLMResponse(inputText) {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const body = JSON.stringify({
    action_items: ["Review the shared message", "Identify next steps"],
    client_questions: ["What is your preferred timeline?"],
    followup_items: ["Send a follow-up within 24 hours"],
    reply: `Thank you for your message. I've reviewed the details and will follow up shortly.\n\n${inputText.slice(0, 200)}`
  });

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

// --- STRICT JSON VALIDATION (unchanged) ---
function validateOutput(parsed) {
  for (const key of REQUIRED_KEYS) {
    if (!(key in parsed)) {
      throw new Error("Invalid JSON schema");
    }
    if (key !== "reply" && !Array.isArray(parsed[key])) {
      throw new Error("Invalid JSON schema");
    }
    if (key === "reply" && typeof parsed.reply !== "string") {
      throw new Error("Invalid JSON schema");
    }
  }
  return parsed;
}

// --- MAIN ENTRY POINT (updated to use Groq) ---
export async function processMessage(inputText) {
  let response;

  try {
    response = await callGroqLLM(inputText);
    if (!response.ok) {
      throw new Error("Groq request failed");
    }
  } catch (err) {
    console.warn("Groq failed, using mock:", err);
    response = await mockLLMResponse(inputText);
  }

  const text = await response.text();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }

  return validateOutput(parsed);
}
