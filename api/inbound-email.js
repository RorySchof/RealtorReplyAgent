//inbound-email.js (working!)

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

    console.log("Mailgun inbound email:", {
      from: data.sender,
      subject: data.subject,
      bodyPlain: data['body-plain'],
      bodyHtml: data['body-html'],
    });
    console.log("cleanMessage:", cleanMessage);

    // --- CALL GROQ PROXY ---
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

    const groqMessages = [
      { role: "system", content: process.env.SYSTEM_PROMPT },
      { role: "user", content: cleanMessage }
    ];
    logMessagesDiagnostics("inbound-email outbound to groq-proxy", groqMessages);
    console.log("[DIAG] inbound-email — SYSTEM_PROMPT source: process.env.SYSTEM_PROMPT");
    console.log("[DIAG] inbound-email — SYSTEM_PROMPT length:", process.env.SYSTEM_PROMPT?.length ?? 0);
    console.log("[DIAG] inbound-email — SYSTEM_PROMPT hash:", diagHash(process.env.SYSTEM_PROMPT));
    console.log("[DIAG] inbound-email — cleanMessage length:", cleanMessage.length);

    console.log("[DIAG] inbound-email — SYSTEM_PROMPT FULL TEXT:", process.env.SYSTEM_PROMPT);

    const proxyRes = await fetch(`${baseUrl}/api/groq-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: groqMessages })
    });

    console.log("[DIAG] inbound-email — groq-proxy HTTP status:", proxyRes.status);

    const completion = await proxyRes.json();
    console.log("Groq completion envelope:", completion);
    console.log("[DIAG] inbound-email — proxy response top-level keys:", Object.keys(completion ?? {}));
    console.log("[DIAG] inbound-email — proxy response has parsed:", "parsed" in (completion ?? {}));
    console.log("[DIAG] inbound-email — proxy response has completion:", "completion" in (completion ?? {}));
    console.log("[DIAG] inbound-email — proxy parsed keys:", Object.keys(completion?.parsed ?? {}));
    console.log(
      "[DIAG] inbound-email — proxy completion.choices[0].message.content length:",
      completion?.completion?.choices?.[0]?.message?.content?.length ?? null
    );
    console.log(
      "[DIAG] inbound-email — proxy completion.choices[0].message.content:",
      completion?.completion?.choices?.[0]?.message?.content ?? null
    );

    // --- EXTRACT MODEL OUTPUT ---
    const agent = completion.parsed;

    console.log("Parsed agent JSON:", agent);

    // --- SAFE FALLBACKS ---
    const actionItems = agent.action_items || [];
    const clientQuestions = agent.client_questions || [];
    const followUps = agent.followups || agent.followup_items || [];
    const draftReply = agent.draft_reply || agent.reply || "";

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

Client Questions:
${clientQuestions.map(q => "- " + q).join("\n")}

Follow-Ups:
${followUps.map(f => "- " + f).join("\n")}

Draft Reply:
${draftReply}

Send to Client:
mailto:${clientEmail}?subject=${encodeURIComponent("Re: " + data.subject)}
`;

    console.log("Outbound Mailgun: sending", {
      domain: process.env.MAILGUN_DOMAIN,
      hasApiKey: !!process.env.MAILGUN_API_KEY,
      to: data.sender,
    });

    // Button

    const mailtoLink = `mailto:${clientEmail}?subject=${encodeURIComponent("Re: " + data.subject)}`;
    const mailtoHref = escapeHtmlAttr(mailtoLink);

    const emailHtml = `<h3>Action Items:</h3>
<ul>
${actionItems.map(i => `<li>${escapeHtml(i)}</li>`).join("")}
</ul>

<h3>Client Questions:</h3>
<ul>
${clientQuestions.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
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
    console.log("Outbound Mailgun: response", {
      status: mailgunResponse.status,
      ok: mailgunResponse.ok,
      body: mailgunBody,
    });

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
