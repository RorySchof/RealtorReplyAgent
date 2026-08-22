// server/reply.js

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = readFileSync(join(__dirname, "../prompts/system-prompt.txt"), "utf8");

/**
 * Same reply-generation pipeline as the Mailgun inbound workflow:
 * preprocess → groq-proxy PASS 2 → draft_reply / reply
 */
export async function generateReply(text) {
  const cleanMessage = extractForwardedMessage(text);

  const baseUrl =
    process.env.API_BASE_URL ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    "http://localhost:3000";

  // PASS 1 DISABLED — send raw email directly to PASS 2 (identical to inbound-email)
  const preprocessed = { raw_email: cleanMessage };

  const pass2Messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(preprocessed) },
  ];

  const pass2Res = await fetch(`${baseUrl}/api/groq-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: pass2Messages }),
  });

  if (!pass2Res.ok) {
    throw new Error(`groq-proxy failed with status ${pass2Res.status}`);
  }

  const pass2Completion = await pass2Res.json();
  const agent = pass2Completion.parsed || {};

  return agent.draft_reply || agent.reply || "";
}

function extractForwardedMessage(body) {
  if (!body || typeof body !== "string") {
    return "";
  }

  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const separatorPattern = /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i;
  const forwardedMarkerPattern = /forwarded message/i;
  const headerLinePattern = /^(From|Date|Subject|To):\s*/i;

  const separatorIndex = lines.findIndex(
    (line) =>
      separatorPattern.test(line.trim()) ||
      forwardedMarkerPattern.test(line.trim())
  );

  if (separatorIndex === -1) {
    return body.trim();
  }

  let index = separatorIndex + 1;

  while (index < lines.length && headerLinePattern.test(lines[index].trim())) {
    index++;
  }

  const blankIndex = lines.findIndex(
    (line, i) => i >= index && line.trim() === ""
  );
  if (blankIndex === -1) {
    return lines.slice(index).join("\n").trim();
  }

  return lines.slice(blankIndex + 1).join("\n").trim();
}
