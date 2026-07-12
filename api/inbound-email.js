// //inbound-email.js (working!!)

// import { readFileSync } from "node:fs";
// import { dirname, join } from "node:path";
// import { fileURLToPath } from "node:url";

// const __dirname = dirname(fileURLToPath(import.meta.url));
// const wrapperPrompt = readFileSync(join(__dirname, "../prompts/wrapper-prompt.txt"), "utf8");
// const SYSTEM_PROMPT = readFileSync(join(__dirname, "../prompts/system-prompt.txt"), "utf8");

// export const config = {
//   api: {
//     bodyParser: false, // Required for Mailgun
//   },
// };

// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   try {
//     // --- RAW BODY (Mailgun x-www-form-urlencoded) ---
//     const rawBody = await getRawBody(req);
//     const text = rawBody.toString();
//     const data = Object.fromEntries(new URLSearchParams(text));

//     const cleanMessage = extractForwardedMessage(data['body-plain']);

//     // --- TWO-PASS GROQ PIPELINE ---
//     const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

//     // PASS 1 — Preprocessing (wrapper)
//     // const pass1Messages = [
//     //   { role: "system", content: wrapperPrompt },
//     //   { role: "user", content: cleanMessage }
//     // ];
//     // logMessagesDiagnostics("PASS 1 — inbound-email outbound to groq-proxy", pass1Messages);

//     // const pass1Res = await fetch(`${baseUrl}/api/groq-proxy`, {
//     //   method: "POST",
//     //   headers: { "Content-Type": "application/json" },
//     //   body: JSON.stringify({ messages: pass1Messages })
//     // });

//     // const pass1Completion = await pass1Res.json();

//     // const preprocessed = pass1Completion.parsed?.preprocessed ?? pass1Completion.parsed ?? {};

//     // PASS 1 DISABLED — send raw email directly to PASS 2
//     const preprocessed = { raw_email: cleanMessage };

//     // PASS 2 — Main assistant (SYSTEM_PROMPT)
//     const pass2Messages = [
//       { role: "system", content: SYSTEM_PROMPT },
//       { role: "user", content: JSON.stringify(preprocessed) }
//     ];
//     logMessagesDiagnostics("PASS 2 — inbound-email outbound to groq-proxy", pass2Messages);

//     // const pass2Res = await fetch(`${baseUrl}/api/groq-proxy`, {
//     //   method: "POST",
//     //   headers: { "Content-Type": "application/json" },
//     //   body: JSON.stringify({ messages: pass2Messages })
//     // });

//     // const pass2Completion = await pass2Res.json();

//     const pass2Res = await fetch(`${baseUrl}/api/hf-proxy`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ messages: pass2Messages })
//     });
    
//     const pass2Completion = await pass2Res.json();

//     // --- EXTRACT MODEL OUTPUT ---
//     // const agent = pass2Completion.parsed;
//     const agent = JSON.parse(pass2Completion.raw);



//     // --- SAFE FALLBACKS ---
//     const actionItems = agent.action_items || [];
//     const clientQuestions = agent.client_questions || [];
//     const rapportQuestions = agent.rapport_questions || [];
//     const followUps = agent.followups || agent.followup_items || [];
//     const coachNotes = agent.coach_notes || [];
//     const draftReply = agent.draft_reply || agent.reply || "";
//     const questionsForClient = agent.client_questions || agent.questions_for_client || [];
//     const questionsFromClient = extractQuestionsFromClient(cleanMessage);


//     // --- EXTRACT CLIENT EMAIL FROM FORWARDED HEADER ---
//     const fromLine = data['body-plain']?.split(/\r?\n/).find((line) =>
//       /^From:\s*/i.test(line.trim())
//     );

//     const clientEmail =
//       fromLine?.match(/<([^>]+)>/)?.[1] ||
//       fromLine?.match(/From:\s*(\S+@\S+)/i)?.[1] ||
//       '';

//     // --- BUILD OUTBOUND EMAIL BODY ---
//     const emailBody = `
// Action Items:
// ${actionItems.map(i => "- " + i).join("\n")}

// Questions FROM Client:
// ${questionsFromClient.map(q => "- " + q).join("\n")}

// Questions FOR Client:
// ${questionsForClient.map(q => "- " + q).join("\n")}

// Rapport Questions:
// ${rapportQuestions.map(q => "- " + q).join("\n")}

// Follow-Ups:
// ${followUps.map(f => "- " + f).join("\n")}

// Coach's Notes:
// ${coachNotes.map(n => "- " + n).join("\n")}

// Draft Reply:
// ${draftReply}

// Send to Client:
// mailto:${clientEmail}?subject=${encodeURIComponent("Re: " + data.subject)}
// `;

//     // Button

//     const draftReplyEscapedForJs = escapeHtml(draftReply).replace(/'/g, "\\'");

//     const mailtoLink =
//       `mailto:${clientEmail}` +
//       `?subject=${encodeURIComponent("Re: " + data.subject)}` +
//       `&body=${encodeURIComponent(draftReply)}`;

//     const mailtoHref = escapeHtmlAttr(mailtoLink);

//     const emailHtml = `<h3>Action Items:</h3>
// <ul>
// ${actionItems.map(i => `<li>${escapeHtml(i)}</li>`).join("")}
// </ul>

// <h3>Questions FROM Client:</h3>
// <ul>
// ${questionsFromClient.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
// </ul>

// <h3>Questions FOR Client:</h3>
// <ul>
// ${questionsForClient.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
// </ul>

// <h3>Follow-Ups:</h3>
// <ul>
// ${followUps.map(f => `<li>${escapeHtml(f)}</li>`).join("")}
// </ul>

// <h3>Coach's Notes:</h3>
// <ul>
// ${coachNotes.map(n => `<li>${escapeHtml(n)}</li>`).join("")}
// </ul>

// <h3>Rapport Questions:</h3>
// <ul>
// ${rapportQuestions.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
// </ul>

// <h3>Draft Reply:</h3>
// <pre>${escapeHtml(draftReply)}</pre>

// <h3>Send to Client:</h3>
// <p>
// <a href="${mailtoHref}" style="
// display:inline-block;
// padding:12px 18px;
// background:#2563eb;
// color:white;
// text-decoration:none;
// border-radius:6px;
// font-weight:600;
// ">Send to Client</a>

// <a href="#" onclick="navigator.clipboard.writeText('${draftReplyEscapedForJs}')" style="
// display:inline-block;
// padding:12px 18px;
// background:#6b7280;
// color:white;
// text-decoration:none;
// border-radius:6px;
// font-weight:600;
// margin-left:8px;
// ">Copy Reply</a>
// </p>

// <p>Or copy/paste this link:<br>${escapeHtml(mailtoLink)}</p>`;


//     // --- SEND OUTBOUND EMAIL VIA MAILGUN ---
//     const mailgunResponse = await fetch(
//       `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`,
//       {
//         method: "POST",
//         headers: {
//           Authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64")}`,
//           "Content-Type": "application/x-www-form-urlencoded",
//         },
//         body: new URLSearchParams({
//           from: `Realtor Assistant <assistant@${process.env.MAILGUN_DOMAIN}>`,
//           to: data.sender,
//           subject: "Re: " + data.subject,
//           text: emailBody,
//           html: emailHtml
//         }).toString(),

//       }
//     );

//     const mailgunBody = await mailgunResponse.text();

//     if (!mailgunResponse.ok) {
//       throw new Error(`Mailgun send failed (${mailgunResponse.status}): ${mailgunBody}`);
//     }

//     return res.status(200).json({ ok: true, sent: true });
//   } catch (err) {
//     console.error("Mailgun inbound error:", err);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// }

// // --- HELPERS ---------------------------------------------------

// function escapeHtml(text) {
//   return String(text)
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;")
//     .replace(/"/g, "&quot;");
// }

// function escapeHtmlAttr(text) {
//   return escapeHtml(text);
// }

// // Diagnostic-only: fingerprint strings for log correlation (no functional use).
// function diagHash(str) {
//   if (str == null) return null;
//   const s = String(str);
//   let h = 0;
//   for (let i = 0; i < s.length; i++) {
//     h = ((h << 5) - h + s.charCodeAt(i)) | 0;
//   }
//   return (h >>> 0).toString(16);
// }

// function logMessagesDiagnostics(label, messages) {
//   messages.forEach((m, i) => {
//     const c = m.content ?? "";
//     const contentStr = typeof c === "string" ? c : JSON.stringify(c);
//     if (m.role === "system") {
//     }
//   });
// }

// function extractForwardedMessage(body) {
//   if (!body || typeof body !== 'string') {
//     return '';
//   }

//   const lines = body.replace(/\r\n/g, '\n').split('\n');
//   const separatorPattern = /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i;
//   const forwardedMarkerPattern = /forwarded message/i;
//   const headerLinePattern = /^(From|Date|Subject|To):\s*/i;

//   const separatorIndex = lines.findIndex(
//     (line) => separatorPattern.test(line.trim()) || forwardedMarkerPattern.test(line.trim())
//   );

//   if (separatorIndex === -1) {
//     return body.trim();
//   }

//   let index = separatorIndex + 1;

//   while (index < lines.length && headerLinePattern.test(lines[index].trim())) {
//     index++;
//   }

//   const blankIndex = lines.findIndex((line, i) => i >= index && line.trim() === '');
//   if (blankIndex === -1) {
//     return lines.slice(index).join('\n').trim();
//   }

//   return lines.slice(blankIndex + 1).join('\n').trim();
// }

// function getRawBody(req) {
//   return new Promise((resolve, reject) => {
//     let chunks = [];
//     req.on("data", chunk => chunks.push(chunk));
//     req.on("end", () => resolve(Buffer.concat(chunks)));
//     req.on("error", reject);
//   });
// }

// function extractQuestionsFromClient(text) {
//   if (!text) return [];

//   // Normalize whitespace
//   const normalized = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ");

//   // Split on sentence boundaries
//   const segments = normalized.split(/(?<=[.?!])\s+/);

//   return segments
//     .map(s => s.trim())
//     .filter(s => s.endsWith("?"));
// }






// import { readFileSync } from "node:fs";
// import { dirname, join } from "node:path";
// import { fileURLToPath } from "node:url";

// const __dirname = dirname(fileURLToPath(import.meta.url));
// const wrapperPrompt = readFileSync(join(__dirname, "../prompts/wrapper-prompt.txt"), "utf8");
// const SYSTEM_PROMPT = readFileSync(join(__dirname, "../prompts/system-prompt.txt"), "utf8");

// export const config = {
//   api: {
//     bodyParser: false, // Required for Mailgun
//   },
// };

// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   try {
//     // --- RAW BODY (Mailgun x-www-form-urlencoded) ---
//     const rawBody = await getRawBody(req);
//     const text = rawBody.toString();
//     const data = Object.fromEntries(new URLSearchParams(text));

//     const cleanMessage = extractForwardedMessage(data['body-plain']);

//     // --- TWO-PASS GROQ PIPELINE ---
//     const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

//     // PASS 1 — Preprocessing (wrapper)
//     // PASS 1 DISABLED — send raw email directly to PASS 2
//     const preprocessed = { raw_email: cleanMessage };

//     // PASS 2 — Main assistant (SYSTEM_PROMPT)
//     const pass2Messages = [
//       { role: "system", content: SYSTEM_PROMPT },
//       { role: "user", content: JSON.stringify(preprocessed) }
//     ];
//     logMessagesDiagnostics("PASS 2 — inbound-email outbound to groq-proxy", pass2Messages);

//     const pass2Res = await fetch(`${baseUrl}/api/hf-proxy`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ messages: pass2Messages })
//     });
    
//     const pass2Completion = await pass2Res.json();

//     // --- EXTRACT MODEL OUTPUT ---
//     const agent = JSON.parse(pass2Completion.raw);

//     // --- SAFE FALLBACKS ---
//     const actionItems = agent.action_items || [];
//     const clientQuestions = agent.client_questions || [];
//     const rapportQuestions = agent.rapport_questions || [];
//     const followUps = agent.followups || agent.followup_items || [];
//     const coachNotes = agent.coach_notes || [];
//     const draftReply = agent.draft_reply || agent.reply || "";
//     const questionsForClient = agent.client_questions || agent.questions_for_client || [];
//     const questionsFromClient = extractQuestionsFromClient(cleanMessage);

//     // --- BUILD CLIENT SNAPSHOT (NEW) ---
//     // const clientSnapshot = buildClientSnapshot(agent, cleanMessage);

//     const clientSnapshot = agent.client_snapshot || buildClientSnapshot(agent, cleanMessage);

//     // --- EXTRACT CLIENT EMAIL FROM FORWARDED HEADER ---
//     const fromLine = data['body-plain']?.split(/\r?\n/).find((line) =>
//       /^From:\s*/i.test(line.trim())
//     );

//     const clientEmail =
//       fromLine?.match(/<([^>]+)>/)?.[1] ||
//       fromLine?.match(/From:\s*(\S+@\S+)/i)?.[1] ||
//       '';

//     // --- BUILD OUTBOUND EMAIL BODY (include snapshot at top) ---
//     const emailBody = `
// Client Snapshot:
// Client Status: ${clientSnapshot.client_status}
// Primary Concern: ${clientSnapshot.primary_concern}
// Decision Factors: ${clientSnapshot.decision_factors}
// Momentum Signal: ${clientSnapshot.momentum_signal}
// Confidence: ${clientSnapshot.confidence}

// Action Items:
// ${actionItems.map(i => "- " + i).join("\n")}

// Questions FROM Client:
// ${questionsFromClient.map(q => "- " + q).join("\n")}

// Questions FOR Client:
// ${questionsForClient.map(q => "- " + q).join("\n")}

// Rapport Questions:
// ${rapportQuestions.map(q => "- " + q).join("\n")}

// Follow-Ups:
// ${followUps.map(f => "- " + f).join("\n")}

// Coach's Notes:
// ${coachNotes.map(n => "- " + n).join("\n")}

// Draft Reply:
// ${draftReply}

// Send to Client:
// mailto:${clientEmail}?subject=${encodeURIComponent("Re: " + data.subject)}
// `;

//     // Button

//     const draftReplyEscapedForJs = escapeHtml(draftReply).replace(/'/g, "\\'");

//     const mailtoLink =
//       `mailto:${clientEmail}` +
//       `?subject=${encodeURIComponent("Re: " + data.subject)}` +
//       `&body=${encodeURIComponent(draftReply)}`;

//     const mailtoHref = escapeHtmlAttr(mailtoLink);

//     const emailHtml = `<h3>Client Snapshot</h3>
// <ul>
//   <li><strong>Client Status:</strong> ${escapeHtml(clientSnapshot.client_status)}</li>
//   <li><strong>Primary Concern:</strong> ${escapeHtml(clientSnapshot.primary_concern)}</li>
//   <li><strong>Decision Factors:</strong> ${escapeHtml(clientSnapshot.decision_factors)}</li>
//   <li><strong>Momentum Signal:</strong> ${escapeHtml(clientSnapshot.momentum_signal)}</li>
//   <li><strong>Confidence:</strong> ${escapeHtml(clientSnapshot.confidence)}</li>
// </ul>

// <h3>Action Items:</h3>
// <ul>
// ${actionItems.map(i => `<li>${escapeHtml(i)}</li>`).join("")}
// </ul>

// <h3>Questions FROM Client:</h3>
// <ul>
// ${questionsFromClient.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
// </ul>

// <h3>Questions FOR Client:</h3>
// <ul>
// ${questionsForClient.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
// </ul>

// <h3>Follow-Ups:</h3>
// <ul>
// ${followUps.map(f => `<li>${escapeHtml(f)}</li>`).join("")}
// </ul>

// <h3>Coach's Notes:</h3>
// <ul>
// ${coachNotes.map(n => `<li>${escapeHtml(n)}</li>`).join("")}
// </ul>

// <h3>Rapport Questions:</h3>
// <ul>
// ${rapportQuestions.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
// </ul>

// <h3>Draft Reply:</h3>
// <pre>${escapeHtml(draftReply)}</pre>

// <h3>Send to Client:</h3>
// <p>
// <a href="${mailtoHref}" style="
// display:inline-block;
// padding:12px 18px;
// background:#2563eb;
// color:white;
// text-decoration:none;
// border-radius:6px;
// font-weight:600;
// ">Send to Client</a>

// <a href="#" onclick="navigator.clipboard.writeText('${draftReplyEscapedForJs}')" style="
// display:inline-block;
// padding:12px 18px;
// background:#6b7280;
// color:white;
// text-decoration:none;
// border-radius:6px;
// font-weight:600;
// margin-left:8px;
// ">Copy Reply</a>
// </p>

// <p>Or copy/paste this link:<br>${escapeHtml(mailtoLink)}</p>`;

//     // --- SEND OUTBOUND EMAIL VIA MAILGUN ---
//     const mailgunResponse = await fetch(
//       `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`,
//       {
//         method: "POST",
//         headers: {
//           Authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64")}`,
//           "Content-Type": "application/x-www-form-urlencoded",
//         },
//         body: new URLSearchParams({
//           from: `Realtor Assistant <assistant@${process.env.MAILGUN_DOMAIN}>`,
//           to: data.sender,
//           subject: "Re: " + data.subject,
//           text: emailBody,
//           html: emailHtml
//         }).toString(),

//       }
//     );

//     const mailgunBody = await mailgunResponse.text();

//     if (!mailgunResponse.ok) {
//       throw new Error(`Mailgun send failed (${mailgunResponse.status}): ${mailgunBody}`);
//     }

//     return res.status(200).json({ ok: true, sent: true });
//   } catch (err) {
//     console.error("Mailgun inbound error:", err);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// }

// // --- HELPERS ---------------------------------------------------

// function escapeHtml(text) {
//   return String(text)
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;")
//     .replace(/"/g, "&quot;");
// }

// function escapeHtmlAttr(text) {
//   return escapeHtml(text);
// }

// // Diagnostic-only: fingerprint strings for log correlation (no functional use).
// function diagHash(str) {
//   if (str == null) return null;
//   const s = String(str);
//   let h = 0;
//   for (let i = 0; i < s.length; i++) {
//     h = ((h << 5) - h + s.charCodeAt(i)) | 0;
//   }
//   return (h >>> 0).toString(16);
// }

// function logMessagesDiagnostics(label, messages) {
//   messages.forEach((m, i) => {
//     const c = m.content ?? "";
//     const contentStr = typeof c === "string" ? c : JSON.stringify(c);
//     if (m.role === "system") {
//     }
//   });
// }

// function extractForwardedMessage(body) {
//   if (!body || typeof body !== 'string') {
//     return '';
//   }

//   const lines = body.replace(/\r\n/g, '\n').split('\n');
//   const separatorPattern = /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i;
//   const forwardedMarkerPattern = /forwarded message/i;
//   const headerLinePattern = /^(From|Date|Subject|To):\s*/i;

//   const separatorIndex = lines.findIndex(
//     (line) => separatorPattern.test(line.trim()) || forwardedMarkerPattern.test(line.trim())
//   );

//   if (separatorIndex === -1) {
//     return body.trim();
//   }

//   let index = separatorIndex + 1;

//   while (index < lines.length && headerLinePattern.test(lines[index].trim())) {
//     index++;
//   }

//   const blankIndex = lines.findIndex((line, i) => i >= index && line.trim() === '');
//   if (blankIndex === -1) {
//     return lines.slice(index).join('\n').trim();
//   }

//   return lines.slice(blankIndex + 1).join('\n').trim();
// }

// function getRawBody(req) {
//   return new Promise((resolve, reject) => {
//     let chunks = [];
//     req.on("data", chunk => chunks.push(chunk));
//     req.on("end", () => resolve(Buffer.concat(chunks)));
//     req.on("error", reject);
//   });
// }

// function extractQuestionsFromClient(text) {
//   if (!text) return [];

//   // Normalize whitespace
//   const normalized = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ");

//   // Split on sentence boundaries
//   const segments = normalized.split(/(?<=[.?!])\s+/);

//   return segments
//     .map(s => s.trim())
//     .filter(s => s.endsWith("?"));
// }

// /* -------------------------
//    Client Snapshot helpers
//    ------------------------- */

// function buildClientSnapshot(agentParsed, rawText) {
//   const status = inferStatus(rawText, agentParsed);
//   const primary = inferPrimaryConcern(agentParsed, rawText);
//   const factors = inferDecisionFactors(agentParsed, rawText);
//   const momentum = inferMomentumSignal(agentParsed, rawText);
//   const confidence = computeConfidence({ status, primary, factors, momentum, agentParsed });

//   return {
//     client_status: status,
//     primary_concern: primary,
//     decision_factors: factors.join("; "),
//     momentum_signal: momentum,
//     confidence
//   };
// }

// function inferStatus(text, agentParsed) {
//   const t = (text || "").toLowerCase();
//   if (/\b(ready to|moving forward|put in an offer|offer)\b/.test(t)) return "Hot buyer";
//   if (/\b(revisit|going back|this weekend|interested|thinking|considering|comparing)\b/.test(t)) return "Warm buyer";
//   if (/\b(just looking|browsing|not ready)\b/.test(t)) return "Cold buyer";
//   // fallback: if agentParsed.followups or agentParsed.action_items indicate next steps, mark Warm
//   if ((agentParsed.followups && agentParsed.followups.length) || (agentParsed.action_items && agentParsed.action_items.length)) return "Warm buyer";
//   return "Warm buyer";
// }

// function inferPrimaryConcern(agentParsed, text) {
//   // Look for explicit blocking language in client questions or agent fields
//   const cq = (agentParsed.client_questions || []).join(" ").toLowerCase();
//   const combined = (cq + " " + (text || "")).toLowerCase();

//   if (/\b(fees|maintenance fee|monthly fee|maintenance fees|what they include)\b/.test(combined)) return "Ownership costs";
//   if (/\b(deck|soft|deck felt|deck condition|deck repair)\b/.test(combined)) return "Property condition";
//   if (/\b(kitchen|reno|renovation|when it was done)\b/.test(combined)) return "Property condition";
//   if (/\b(hvac|servicing|service date)\b/.test(combined)) return "Property condition";
//   // If client explicitly asks for opinion or says "torn", primary concern is confidence
//   if (/\b(torn|not sure|unsure|need.*confidence|confidence)\b/.test(combined)) return "Needs confidence before deciding";
//   // fallback: pick first client question summary or generic
//   const firstQ = (agentParsed.client_questions && agentParsed.client_questions[0]) || "";
//   return firstQ ? firstQ.slice(0, 80) : "Decision clarity";
// }

// function inferDecisionFactors(agentParsed, text) {
//   const factors = new Set();
//   const combined = ((agentParsed.client_questions || []).join(" ") + " " + (agentParsed.action_items || []).join(" ") + " " + (text || "")).toLowerCase();

//   if (/\b(kitchen|reno|renovation|condition)\b/.test(combined)) factors.add("Property condition");
//   if (/\b(deck|deck condition|deck repair|deck felt)\b/.test(combined)) factors.add("Property condition");
//   if (/\b(fee|fees|maintenance|monthly maintenance|ownership cost|maintenance fee)\b/.test(combined)) factors.add("Ownership costs");
//   if (/\b(hvac|heating|air conditioning|servicing)\b/.test(combined)) factors.add("Systems / Maintenance");
//   if (/\b(layout|space|living room|bedroom|kitchen layout)\b/.test(combined)) factors.add("Layout / Function");
//   if (/\b(lifestyle|fit|suit my lifestyle|suit my)\b/.test(combined)) factors.add("Lifestyle fit");

//   // If none found, try to infer from coach notes
//   if (!factors.size && agentParsed.coach_notes && agentParsed.coach_notes.length) {
//     const cn = agentParsed.coach_notes.join(" ").toLowerCase();
//     if (/\b(lifestyle|priority|priorities)\b/.test(cn)) factors.add("Lifestyle fit");
//     if (/\b(condition|repair|inspection)\b/.test(cn)) factors.add("Property condition");
//   }

//   // Limit to 3
//   return Array.from(factors).slice(0, 3);
// }

// function inferMomentumSignal(agentParsed, text) {
//   const t = (text || "").toLowerCase();
//   if (/\b(this weekend|weekend|sat(urday)?|sun(day)?|available|free)\b/.test(t)) {
//     // try to capture the exact phrase if present
//     const m = t.match(/\b(this weekend|weekend|sat(urday)? after \d+|sat(urday)?|sun(day)? morning|sun(day)?|after \d+pm)\b/);
//     return m ? (m[0].replace(/\s+/g, " ").trim()) : "Wants to revisit this weekend";
//   }
//   // if followups indicate scheduling
//   if (agentParsed.followups && agentParsed.followups.some(f => /view|schedule|confirm|send a calendar/i.test(f))) {
//     return "Scheduling requested";
//   }
//   return "No immediate momentum";
// }

// function computeConfidence({ status, primary, factors, momentum, agentParsed }) {
//   let score = 0;
//   if (status && status !== "Cold buyer") score += 1;
//   if (primary && primary !== "Decision clarity") score += 1;
//   if (factors && factors.length) score += 1;
//   if (momentum && momentum !== "No immediate momentum") score += 1;
//   // agentParsed presence
//   if (agentParsed && (agentParsed.action_items || agentParsed.client_questions)) score += 1;

//   if (score >= 4) return "high";
//   if (score >= 2) return "medium";
//   return "low";
// }











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
    // PASS 1 DISABLED — send raw email directly to PASS 2
    const preprocessed = { raw_email: cleanMessage };

    // PASS 2 — Main assistant (SYSTEM_PROMPT)
    const pass2Messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(preprocessed) }
    ];
    logMessagesDiagnostics("PASS 2 — inbound-email outbound to groq-proxy", pass2Messages);

    const pass2Res = await fetch(`${baseUrl}/api/hf-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: pass2Messages })
    });
    
    const pass2Completion = await pass2Res.json();

    // --- EXTRACT MODEL OUTPUT ---
    const agent = JSON.parse(pass2Completion.raw);

    // --- SAFE FALLBACKS ---
    const actionItems = agent.action_items || [];
    const clientQuestions = agent.client_questions || [];
    const rapportQuestions = agent.rapport_questions || [];
    const followUps = agent.followups || agent.followup_items || [];
    const coachNotes = agent.coach_notes || [];
    const draftReply = agent.draft_reply || agent.reply || "";
    const questionsForClient = agent.client_questions || agent.questions_for_client || [];
    const questionsFromClient = extractQuestionsFromClient(cleanMessage);

    // --- BUILD CLIENT SNAPSHOT (NEW) ---
    // const clientSnapshot = buildClientSnapshot(agent, cleanMessage);

    const clientSnapshot = agent.client_snapshot || buildClientSnapshot(agent, cleanMessage);

    // --- EXTRACT CLIENT EMAIL FROM FORWARDED HEADER ---
    const fromLine = data['body-plain']?.split(/\r?\n/).find((line) =>
      /^From:\s*/i.test(line.trim())
    );

    const clientEmail =
      fromLine?.match(/<([^>]+)>/)?.[1] ||
      fromLine?.match(/From:\s*(\S+@\S+)/i)?.[1] ||
      '';

    // --- BUILD OUTBOUND EMAIL BODY (include snapshot at top) ---
    const emailBody = `
Client Snapshot:
Client Status: ${clientSnapshot.client_status}
Primary Concern: ${clientSnapshot.primary_concern}
Decision Factors: ${clientSnapshot.decision_factors}
Momentum Signal: ${clientSnapshot.momentum_signal}
Confidence: ${clientSnapshot.confidence}

Action Items:
${actionItems.map(i => "- " + i).join("\n")}

Questions FROM Client:
${questionsFromClient.map(q => "- " + q).join("\n")}

Questions FOR Client:
${questionsForClient.map(q => "- " + q).join("\n")}

Rapport Questions:
${rapportQuestions.map(q => "- " + q).join("\n")}

Follow-Ups:
${followUps.map(f => "- " + f).join("\n")}

Coach's Notes:
${coachNotes.map(n => "- " + n).join("\n")}

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

    // --- HTML EMAIL BODY ---

    const emailHtml = `
    <div style="background:#f7f7f7; padding:24px; font-family:Arial, sans-serif;">
    
      <!-- Header -->
      <div style="text-align:left; font-size:18px; font-weight:600; color:#111827; margin-bottom:24px;">
        Realtor Assistant — Client Summary
      </div>
    
      <!-- Snapshot Dashboard -->
      <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:20px; margin-bottom:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="font-size:16px; font-weight:600; margin-bottom:16px; color:#111827;">Client Snapshot</div>
    
        <table style="width:100%; border-collapse:collapse; font-size:14px; color:#374151;">
          <tr>
            <td style="padding:8px 0; font-weight:600; width:35%;">Status</td>
            <td style="padding:8px 0;">${escapeHtml(clientSnapshot.client_status)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:600;">Primary Concern</td>
            <td style="padding:8px 0;">${escapeHtml(clientSnapshot.primary_concern)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:600;">Momentum</td>
            <td style="padding:8px 0;">${escapeHtml(clientSnapshot.momentum_signal)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:600;">Decision Factors</td>
            <td style="padding:8px 0;">${escapeHtml(clientSnapshot.decision_factors)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; font-weight:600;">Confidence</td>
            <td style="padding:8px 0;">${escapeHtml(clientSnapshot.confidence)}</td>
          </tr>
        </table>
      </div>
    
      <!-- Action Items (Primary Card) -->
      <div style="background:#f8fbff; border:1px solid #dbeafe; border-left:4px solid #2563eb; border-radius:8px; padding:20px; margin-bottom:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="font-size:16px; font-weight:600; margin-bottom:12px; color:#1e3a8a;">Action Items</div>
        <ul style="margin:0; padding-left:20px; line-height:1.6; font-size:14px; color:#374151;">
          ${actionItems.map(i => `<li>${escapeHtml(i)}</li>`).join("")}
        </ul>
      </div>
    
      <!-- Coach Insight (Personality Card) -->
      <div style="background:#f5faff; border:1px solid #dbeafe; border-radius:8px; padding:20px; margin-bottom:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="font-size:16px; font-weight:600; margin-bottom:12px; color:#1e3a8a;">Coach’s Insight</div>
        <ul style="margin:0; padding-left:20px; line-height:1.6; font-size:14px; color:#374151;">
          ${coachNotes.map(n => `<li>${escapeHtml(n)}</li>`).join("")}
        </ul>
      </div>
    
      <!-- Draft Reply (Deliverable Card) -->
      <div style="background:#fcfcfc; border:1px solid #e5e7eb; border-radius:8px; padding:24px; margin-bottom:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="font-size:16px; font-weight:600; margin-bottom:16px; color:#111827;">Draft Reply</div>
    
        <pre style="white-space:pre-wrap; font-size:14px; line-height:1.6; color:#374151; margin:0;">${escapeHtml(draftReply)}</pre>
    
        <!-- Stacked Buttons -->
        <div style="margin-top:20px;">
          <a href="${mailtoHref}"
             style="display:block; width:100%; text-align:center; padding:12px 16px; background:#2563eb; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; margin-bottom:12px;">
             Send to Client
          </a>
    
          <a href="#" onclick="navigator.clipboard.writeText('${draftReplyEscapedForJs}')"
             style="display:block; width:100%; text-align:center; padding:12px 16px; background:#6b7280; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px;">
             Copy Reply
          </a>
        </div>
      </div>
    
      <!-- Follow-Ups -->
      <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:20px; margin-bottom:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="font-size:16px; font-weight:600; margin-bottom:12px; color:#111827;">Follow-Ups</div>
        <ul style="margin:0; padding-left:20px; line-height:1.6; font-size:14px; color:#374151;">
          ${followUps.map(f => `<li>${escapeHtml(f)}</li>`).join("")}
        </ul>
      </div>
    
      <!-- Questions FROM Client -->
      <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:20px; margin-bottom:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="font-size:16px; font-weight:600; margin-bottom:12px; color:#111827;">Questions FROM Client</div>
        <ul style="margin:0; padding-left:20px; line-height:1.6; font-size:14px; color:#374151;">
          ${questionsFromClient.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
        </ul>
      </div>
    
      <!-- Questions FOR Client -->
      <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:20px; margin-bottom:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="font-size:16px; font-weight:600; margin-bottom:12px; color:#111827;">Questions FOR Client</div>
        <ul style="margin:0; padding-left:20px; line-height:1.6; font-size:14px; color:#374151;">
          ${questionsForClient.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
        </ul>
      </div>
    
      <!-- Rapport Questions -->
      <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:20px; margin-bottom:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="font-size:16px; font-weight:600; margin-bottom:12px; color:#111827;">Rapport Questions</div>
        <ul style="margin:0; padding-left:20px; line-height:1.6; font-size:14px; color:#374151;">
          ${rapportQuestions.map(q => `<li>${escapeHtml(q)}</li>`).join("")}
        </ul>
      </div>
    
    </div>
    `;
    


    
 

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

  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ");

  // Split on sentence boundaries
  const segments = normalized.split(/(?<=[.?!])\s+/);

  return segments
    .map(s => s.trim())
    .filter(s => s.endsWith("?"));
}

/* -------------------------
   Client Snapshot helpers
   ------------------------- */

function buildClientSnapshot(agentParsed, rawText) {
  const status = inferStatus(rawText, agentParsed);
  const primary = inferPrimaryConcern(agentParsed, rawText);
  const factors = inferDecisionFactors(agentParsed, rawText);
  const momentum = inferMomentumSignal(agentParsed, rawText);
  const confidence = computeConfidence({ status, primary, factors, momentum, agentParsed });

  return {
    client_status: status,
    primary_concern: primary,
    decision_factors: factors.join("; "),
    momentum_signal: momentum,
    confidence
  };
}

function inferStatus(text, agentParsed) {
  const t = (text || "").toLowerCase();
  if (/\b(ready to|moving forward|put in an offer|offer)\b/.test(t)) return "Hot buyer";
  if (/\b(revisit|going back|this weekend|interested|thinking|considering|comparing)\b/.test(t)) return "Warm buyer";
  if (/\b(just looking|browsing|not ready)\b/.test(t)) return "Cold buyer";
  // fallback: if agentParsed.followups or agentParsed.action_items indicate next steps, mark Warm
  if ((agentParsed.followups && agentParsed.followups.length) || (agentParsed.action_items && agentParsed.action_items.length)) return "Warm buyer";
  return "Warm buyer";
}

function inferPrimaryConcern(agentParsed, text) {
  // Look for explicit blocking language in client questions or agent fields
  const cq = (agentParsed.client_questions || []).join(" ").toLowerCase();
  const combined = (cq + " " + (text || "")).toLowerCase();

  if (/\b(fees|maintenance fee|monthly fee|maintenance fees|what they include)\b/.test(combined)) return "Ownership costs";
  if (/\b(deck|soft|deck felt|deck condition|deck repair)\b/.test(combined)) return "Property condition";
  if (/\b(kitchen|reno|renovation|when it was done)\b/.test(combined)) return "Property condition";
  if (/\b(hvac|servicing|service date)\b/.test(combined)) return "Property condition";
  // If client explicitly asks for opinion or says "torn", primary concern is confidence
  if (/\b(torn|not sure|unsure|need.*confidence|confidence)\b/.test(combined)) return "Needs confidence before deciding";
  // fallback: pick first client question summary or generic
  const firstQ = (agentParsed.client_questions && agentParsed.client_questions[0]) || "";
  return firstQ ? firstQ.slice(0, 80) : "Decision clarity";
}

function inferDecisionFactors(agentParsed, text) {
  const factors = new Set();
  const combined = ((agentParsed.client_questions || []).join(" ") + " " + (agentParsed.action_items || []).join(" ") + " " + (text || "")).toLowerCase();

  if (/\b(kitchen|reno|renovation|condition)\b/.test(combined)) factors.add("Property condition");
  if (/\b(deck|deck condition|deck repair|deck felt)\b/.test(combined)) factors.add("Property condition");
  if (/\b(fee|fees|maintenance|monthly maintenance|ownership cost|maintenance fee)\b/.test(combined)) factors.add("Ownership costs");
  if (/\b(hvac|heating|air conditioning|servicing)\b/.test(combined)) factors.add("Systems / Maintenance");
  if (/\b(layout|space|living room|bedroom|kitchen layout)\b/.test(combined)) factors.add("Layout / Function");
  if (/\b(lifestyle|fit|suit my lifestyle|suit my)\b/.test(combined)) factors.add("Lifestyle fit");

  // If none found, try to infer from coach notes
  if (!factors.size && agentParsed.coach_notes && agentParsed.coach_notes.length) {
    const cn = agentParsed.coach_notes.join(" ").toLowerCase();
    if (/\b(lifestyle|priority|priorities)\b/.test(cn)) factors.add("Lifestyle fit");
    if (/\b(condition|repair|inspection)\b/.test(cn)) factors.add("Property condition");
  }

  // Limit to 3
  return Array.from(factors).slice(0, 3);
}

function inferMomentumSignal(agentParsed, text) {
  const t = (text || "").toLowerCase();
  if (/\b(this weekend|weekend|sat(urday)?|sun(day)?|available|free)\b/.test(t)) {
    // try to capture the exact phrase if present
    const m = t.match(/\b(this weekend|weekend|sat(urday)? after \d+|sat(urday)?|sun(day)? morning|sun(day)?|after \d+pm)\b/);
    return m ? (m[0].replace(/\s+/g, " ").trim()) : "Wants to revisit this weekend";
  }
  // if followups indicate scheduling
  if (agentParsed.followups && agentParsed.followups.some(f => /view|schedule|confirm|send a calendar/i.test(f))) {
    return "Scheduling requested";
  }
  return "No immediate momentum";
}

function computeConfidence({ status, primary, factors, momentum, agentParsed }) {
  let score = 0;
  if (status && status !== "Cold buyer") score += 1;
  if (primary && primary !== "Decision clarity") score += 1;
  if (factors && factors.length) score += 1;
  if (momentum && momentum !== "No immediate momentum") score += 1;
  // agentParsed presence
  if (agentParsed && (agentParsed.action_items || agentParsed.client_questions)) score += 1;

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

