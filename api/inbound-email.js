//inbound-email.js (working!!)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

    // --- TWO-PASS GROQ PIPELINE ---
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

    // PASS 1 — Preprocessing (wrapper)
    const pass1Messages = [
      { role: "system", content: wrapperPrompt },
      { role: "user", content: cleanMessage }
    ];
    logMessagesDiagnostics("PASS 1 — inbound-email outbound to groq-proxy", pass1Messages);

    const pass1Res = await fetch(`${baseUrl}/api/groq-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: pass1Messages })
    });

    const pass1Completion = await pass1Res.json();

    const preprocessed = pass1Completion.parsed?.preprocessed ?? pass1Completion.parsed ?? {};

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
    const agent = pass2Completion.parsed;

    // --- SAFE FALLBACKS ---
    const actionItems = agent.action_items || [];
    const clientQuestions = agent.client_questions || [];
    const followUps = agent.followups || agent.followup_items || [];
    const draftReply = agent.draft_reply || agent.reply || "";
    const questionsForClient = agent.client_questions || agent.questions_for_client || [];
    const questionsFromClient = extractQuestionsFromClient(cleanMessage);


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
  return text
    .split(/\r?\n/)
    .filter(line => line.trim().endsWith("?"))
    .map(line => line.trim());
}
