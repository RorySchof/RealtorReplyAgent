
// src/agent.js

import wrapperPrompt from "@/prompts/wrapper-prompt.txt";


// Groq endpoint + model
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-70b-versatile";

// Required JSON keys
const REQUIRED_KEYS = ["action_items", "client_questions", "followup_items", "reply"];

// Diagnostic-only: fingerprint strings for log correlation (no functional use).
function diagHash(str) {
  if (str == null) return null;
  const s = String(str);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

function logMessagesDiagnostics(label, messages) {
  console.log(`[DIAG] ${label} — full messages array:`, JSON.stringify(messages));
  messages.forEach((m, i) => {
    const c = m.content ?? "";
    const contentStr = typeof c === "string" ? c : JSON.stringify(c);
    console.log(`[DIAG] ${label} — message[${i}] role=${m.role} contentLength=${contentStr.length}`);
    console.log(`[DIAG] ${label} — message[${i}] contentStart:`, contentStr.slice(0, 200));
    console.log(`[DIAG] ${label} — message[${i}] contentEnd:`, contentStr.slice(-200));
    if (m.role === "system") {
      console.log(`[DIAG] ${label} — system prompt length=${contentStr.length} hash=${diagHash(contentStr)}`);
    }
  });
}

// --- ULTRA-FORGIVING JSON EXTRACTION ---
function extractJson(text) {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found");
  }

  let jsonString = text.slice(firstBrace, lastBrace + 1).trim();

  if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
    try {
      jsonString = JSON.parse(jsonString);
    } catch { }
  }

  jsonString = jsonString.replace(/```json|```/g, "").trim();

  return jsonString;
}

function autoFill(parsed) {
  return {
    action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
    client_questions: Array.isArray(parsed.client_questions) ? parsed.client_questions : [],
    followup_items: Array.isArray(parsed.followup_items) ? parsed.followup_items : [],
    reply: typeof parsed.reply === "string" ? parsed.reply : ""
  };
}

// --- REAL LLM CALL (GROQ) ---

// async function callGroqLLM(inputText) {
//   const messages = [
//     { role: "system", content: wrapperPrompt },
//     { role: "system", content: SYSTEM_PROMPT },
//     { role: "user", content: inputText }
//   ];

//   logMessagesDiagnostics("agent.js outbound to groq-proxy", messages);
//   console.log("[DIAG] agent.js — SYSTEM_PROMPT source: inline SYSTEM_PROMPT constant");
//   console.log("[DIAG] agent.js — SYSTEM_PROMPT length:", SYSTEM_PROMPT.length);
//   console.log("[DIAG] agent.js — SYSTEM_PROMPT hash:", diagHash(SYSTEM_PROMPT));

//   const response = await fetch("/api/groq-proxy", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify({ messages })
//   });

//   if (!response.ok) {
//     throw new Error("Proxy request failed");
//   }

//   return response;
// }


async function callGroqLLM(inputText) {
  const messages = [
    { role: "system", content: wrapperPrompt },
    { role: "user", content: inputText }
  ];

  logMessagesDiagnostics("PASS 1 — wrapper outbound", messages);

  const response = await fetch("/api/groq-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

// --- MAIN ENTRY POINT (updated with extractor + autofill) ---


export async function processMessage(inputText) {
  console.log("[DIAG] agent.js — processMessage input length (before sanitize):", inputText?.length ?? 0);

  inputText = inputText
    .trim()
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ");

  console.log("[DIAG] agent.js — processMessage input length (after sanitize):", inputText.length);

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

  // ⭐ NEW: read parsed JSON directly from proxy
  const data = await response.json();
  console.log("[DIAG] agent.js — proxy response top-level keys:", Object.keys(data ?? {}));
  console.log("[DIAG] agent.js — extraction path: data.parsed (from groq-proxy)");
  console.log("[DIAG] agent.js — data.parsed:", data.parsed);
  console.log(
    "[DIAG] agent.js — data.completion.choices[0].message.content:",
    data.completion?.choices?.[0]?.message?.content ?? null
  );
  console.log(
    "[DIAG] agent.js — data.completion.choices[0].message.content length:",
    data.completion?.choices?.[0]?.message?.content?.length ?? null
  );
  let parsed = data.parsed || {};

  // Normalize curly quotes etc.
  const normalize = (str) =>
    typeof str === "string"
      ? str
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2018\u2019]/g, "'")
      : str;

  for (const key of Object.keys(parsed)) {
    if (typeof parsed[key] === "string") {
      parsed[key] = normalize(parsed[key]);
    }
    if (Array.isArray(parsed[key])) {
      parsed[key] = parsed[key].map(normalize);
    }
  }
  parsed = autoFill(parsed);
  return validateOutput(parsed);
}


