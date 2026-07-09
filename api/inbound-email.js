//inbound-email.js (working!!!)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// import { validateAgentOutput, replyOpenerViolates, stripReplyLeakage } from "./validate-agent-output.js";
import { extractEmail } from "../src/extractEmail.js";


const __dirname = dirname(fileURLToPath(import.meta.url));
const wrapperPrompt = readFileSync(join(__dirname, "../prompts/wrapper-prompt.txt"), "utf8");
const SYSTEM_PROMPT = readFileSync(join(__dirname, "../prompts/system-prompt.txt"), "utf8");

export const config = {
  api: {
    bodyParser: false, // Required for Mailgun
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --- RAW BODY (Mailgun x-www-form-urlencoded) ---
    const rawBody = await getRawBody(req);
    const text = rawBody.toString();
    const data = Object.fromEntries(new URLSearchParams(text));

    const cleanMessage = extractForwardedMessage(data['body-plain']);
    const extraction = extractEmail(cleanMessage);

    // --- TWO-PASS GROQ PIPELINE ---
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

    // PASS 1 DISABLED — send raw email directly to PASS 2 (coach notes are internal only)
    const preprocessed = { raw_email: cleanMessage };

    // PASS 2 — Main assistant (SYSTEM_PROMPT)
    const pass2Messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(preprocessed) }
    ];
    logMessagesDiagnostics("PASS 2 — inbound-email outbound to groq-proxy", pass2Messages);

    const pass2Res = await fetch(`${baseUrl}/api/groq-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: pass2Messages })
    });

    const pass2Completion = await pass2Res.json();

// --- EXTRACT MODEL OUTPUT ---
const rawAgent = pass2Completion.parsed;

// --- VALIDATE AND CLEAN (disabled for testing) ---

const agent = rawAgent;
const replyNeedsRegeneration = false;

// --- REPLY OPENER REGENERATION (disabled — validator off) ---
let draftReply = agent.reply || "";

// if (replyNeedsRegeneration) {
//   console.error("[VALIDATOR] reply opener violation — requesting narrow regeneration");
//   const regenMessages = [
//     { role: "system", content: SYSTEM_PROMPT },
//     {
//       role: "user",
//       content: JSON.stringify({ raw_email: cleanMessage })
//     },
//     {
//       role: "assistant",
//       content: agent.reply
//     },
//     {
//       role: "user",
//       content: `The opening sentence of your reply violates the rules. Rewrite ONLY the opening sentence so that it begins with the property name or a specific detail from the client's message. Do not change anything else. Return ONLY a JSON object with a single field named "reply". The value of "reply" must be the full regenerated reply as a string. Do not return text outside the JSON object. Do not include explanations, comments, or additional fields. Your entire output MUST be valid JSON.`
//     }
//
//   ];
//
//   try {
//     const regenRes = await fetch(`${baseUrl}/api/groq-proxy`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ messages: regenMessages })
//     });
//     const regenCompletion = await regenRes.json();
//     console.error("[REGEN RAW COMPLETION]", JSON.stringify(regenCompletion, null, 2));
//
//     const regenReply = stripReplyLeakage(regenCompletion.parsed?.reply || "");
//     if (regenReply && !replyOpenerViolates(regenReply)) {
//       draftReply = regenReply;
//       agent.reply = regenReply;
//       console.error("[VALIDATOR] reply opener regenerated successfully");
//     } else {
//       console.error("[VALIDATOR] regeneration did not fix opener — using original");
//     }
//   } catch (err) {
//     console.error("[VALIDATOR] regeneration failed:", err);
//   }
// }

agent.reply = draftReply;

// --- SAFE FALLBACKS (from cleaned agent) ---
const actionItems = agent.action_items || [];
const questionsFromClient = agent.questions_from_client || [];
const questionsForClient = agent.questions_for_client || [];
const coachNotes = agent.coach_notes || [];
const followUps = agent.followup_items || [];

// --- SEMANTIC DEDUPE FOR ACTION ITEMS ---
const seen = new Set();
const dedupedActionItems = [];

for (const item of actionItems) {
  const norm = normalizeActionItem(item);
  if (!seen.has(norm)) {
    seen.add(norm);
    dedupedActionItems.push(item);
  }
}

actionItems.length = 0;
actionItems.push(...dedupedActionItems);


    // --- EXTRACT CLIENT EMAIL FROM FORWARDED HEADER ---
    const fromLine = data['body-plain']?.split(/\r?\n/).find((line) =>
      /^From:\s*/i.test(line.trim())
    );

    const clientEmail =
      fromLine?.match(/<([^>]+)>/)?.[1] ||
      fromLine?.match(/From:\s*(\S+@\S+)/i)?.[1] ||
      '';

    // --- BUILD OUTBOUND EMAIL BODY ---
    const emailBody = `
Action Items:
${actionItems.map(i => "- " + i).join("\n")}

Questions FROM Client:
${questionsFromClient.map(q => "- " + q).join("\n")}

Questions FOR Client:
${questionsForClient.map(q => "- " + q).join("\n")}

Coach's Notes:
${coachNotes.map(n => "- " + n).join("\n")}

Follow-Ups:
${followUps.map(f => "- " + f).join("\n")}

Draft Reply:
${draftReply}

Send to Client:
mailto:${clientEmail}?subject=${encodeURIComponent("Re: " + data.subject)}
`;

    // Button

    const draftReplyEscapedForJs = escapeHtml(draftReply).replace(/'/g, "\\'");

    const mailtoLink =
      `mailto:${clientEmail}` +
      `?subject=${encodeURIComponent("Re: " + data.subject)}` +
      `&body=${encodeURIComponent(draftReply)}`;

    const mailtoHref = escapeHtmlAttr(mailtoLink);

    const emailHtml = `<h3>Action Items:</h3>
<ul>
${actionItems.map(i => `<li>${escapeHtml(i)}</li>`).join("")}
</ul>

<h3>Questions FROM Client:</h3>
<ul>
${questionsFromClient.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
</ul>

<h3>Questions FOR Client:</h3>
<ul>
${questionsForClient.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
</ul>

<h3>Coach's Notes:</h3>
<ul>
${coachNotes.map(n => `<li>${escapeHtml(n)}</li>`).join("")}
</ul>

<h3>Follow-Ups:</h3>
<ul>
${followUps.map(f => `<li>${escapeHtml(f)}</li>`).join("")}
</ul>

<h3>Draft Reply:</h3>
<pre>${escapeHtml(draftReply)}</pre>

<h3>Send to Client:</h3>
<p>
<a href="${mailtoHref}" style="
display:inline-block;
padding:12px 18px;
background:#2563eb;
color:white;
text-decoration:none;
border-radius:6px;
font-weight:600;
">Send to Client</a>

<a href="#" onclick="navigator.clipboard.writeText('${draftReplyEscapedForJs}')" style="
display:inline-block;
padding:12px 18px;
background:#6b7280;
color:white;
text-decoration:none;
border-radius:6px;
font-weight:600;
margin-left:8px;
">Copy Reply</a>
</p>

<p>Or copy/paste this link:<br>${escapeHtml(mailtoLink)}</p>`;


    // --- SEND OUTBOUND EMAIL VIA MAILGUN ---
    const mailgunResponse = await fetch(
      `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          from: `Realtor Assistant <assistant@${process.env.MAILGUN_DOMAIN}>`,
          to: data.sender,
          subject: "Re: " + data.subject,
          text: emailBody,
          html: emailHtml
        }).toString(),

      }
    );

    const mailgunBody = await mailgunResponse.text();

    if (!mailgunResponse.ok) {
      throw new Error(`Mailgun send failed (${mailgunResponse.status}): ${mailgunBody}`);
    }

    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error("Mailgun inbound error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// --- HELPERS ---------------------------------------------------


function normalizeActionItem(text) {
  return text
    .toLowerCase()
    .replace(/contact|get|ask|confirm|reach out to|request/g, "")
    .replace(/the seller|listing agent|agent/g, "")
    .replace(/to|for|about|on|from/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttr(text) {
  return escapeHtml(text);
}

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
  messages.forEach((m, i) => {
    const c = m.content ?? "";
    const contentStr = typeof c === "string" ? c : JSON.stringify(c);
    if (m.role === "system") {
    }
  });
}

function extractForwardedMessage(body) {
  if (!body || typeof body !== 'string') {
    return '';
  }

  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const separatorPattern = /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i;
  const forwardedMarkerPattern = /forwarded message/i;
  const headerLinePattern = /^(From|Date|Subject|To):\s*/i;

  const separatorIndex = lines.findIndex(
    (line) => separatorPattern.test(line.trim()) || forwardedMarkerPattern.test(line.trim())
  );

  if (separatorIndex === -1) {
    return body.trim();
  }

  let index = separatorIndex + 1;

  while (index < lines.length && headerLinePattern.test(lines[index].trim())) {
    index++;
  }

  const blankIndex = lines.findIndex((line, i) => i >= index && line.trim() === '');
  if (blankIndex === -1) {
    return lines.slice(index).join('\n').trim();
  }

  return lines.slice(blankIndex + 1).join('\n').trim();
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function extractQuestionsFromClient(text) {
  if (!text) return [];

  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ");

  // Split on sentence boundaries
  const segments = normalized.split(/(?<=[.?!])\s+/);

  return segments
    .map(s => s.trim())
    .filter(s => s.endsWith("?"));
}
