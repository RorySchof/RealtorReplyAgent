import { buffer } from 'micro';
import qs from 'querystring';

export const config = {
  api: {
    bodyParser: false, // Required for Mailgun: we need the raw body
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = (await buffer(req)).toString();
    const data = qs.parse(rawBody);

    console.log("Mailgun inbound email:", {
      from: data.sender,
      subject: data.subject,
      bodyPlain: data['body-plain'],
      bodyHtml: data['body-html'],
      attachments: data.attachments,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Mailgun inbound error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
