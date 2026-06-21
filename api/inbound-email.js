
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

    console.log("Mailgun inbound email:", {
      from: data.sender,
      subject: data.subject,
      bodyPlain: data['body-plain'],
      bodyHtml: data['body-html'],
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Mailgun inbound error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}