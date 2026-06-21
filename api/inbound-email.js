
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
    // Vercel gives us the raw body as a Buffer when bodyParser is disabled
    const rawBody = await getRawBody(req);
    const text = rawBody.toString();

    // Mailgun sends x-www-form-urlencoded
    const data = Object.fromEntries(new URLSearchParams(text));

    const cleanMessage = extractForwardedMessage(data['body-plain']);

    console.log("Mailgun inbound email:", {
      from: data.sender,
      subject: data.subject,
      bodyPlain: data['body-plain'],
      bodyHtml: data['body-html'],
    });
    console.log("cleanMessage:", cleanMessage);

    const agentResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/groq-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: cleanMessage,
        mode: "email_inbound"
      })
    });

    const agentJson = await agentResponse.json();

    console.log("Agent output:", agentJson);

    const fromLine = data['body-plain']?.split(/\r?\n/).find((line) => /^From:\s*/i.test(line.trim()));
    const clientEmail =
      fromLine?.match(/<([^>]+)>/)?.[1] ||
      fromLine?.match(/From:\s*(\S+@\S+)/i)?.[1] ||
      '';

    const emailBody = `
Action Items:
${agentJson.action_items?.map(i => "- " + i).join("\n")}

Client Questions:
${agentJson.client_questions?.map(q => "- " + q).join("\n")}

Follow-Ups:
${agentJson.followups?.map(f => "- " + f).join("\n")}

Draft Reply:
${agentJson.draft_reply}

Send to Client:
mailto:${clientEmail}?subject=${encodeURIComponent("Re: " + data.subject)}&body=${encodeURIComponent(agentJson.draft_reply)}
`;

    console.log("Outbound Mailgun: sending", {
      domain: process.env.MAILGUN_DOMAIN,
      hasApiKey: !!process.env.MAILGUN_API_KEY,
      to: data.sender,
    });

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