//inbound-email.js (working)

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

    const proxyRes = await fetch(`${baseUrl}/api/groq-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: process.env.SYSTEM_PROMPT },
          { role: "user", content: cleanMessage }
        ]
      })
    });

    const completion = await proxyRes.json();
    console.log("Groq completion envelope:", completion);

    // --- EXTRACT MODEL OUTPUT ---
    const raw = completion?.choices?.[0]?.message?.content || "{}";

    let agent;
    try {
      agent = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse Groq JSON:", raw);
      console.error("PARSE ERROR:", e.name, e.message);
      console.error("RAW LENGTH:", raw.length);
      console.error("RAW START:", raw.slice(0, 30));
      console.error("RAW END:", raw.slice(-20));
      console.error("SYSTEM PROMPT START:", process.env.SYSTEM_PROMPT.slice(0, 50));
      console.error("SYSTEM PROMPT END:", process.env.SYSTEM_PROMPT.slice(-50));
      agent = {};
    }

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
mailto:${clientEmail}?subject=${encodeURIComponent("Re: " + data.subject)}&body=${encodeURIComponent(draftReply)}
`;

    console.log("Outbound Mailgun: sending", {
      domain: process.env.MAILGUN_DOMAIN,
      hasApiKey: !!process.env.MAILGUN_API_KEY,
      to: data.sender,
    });

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
