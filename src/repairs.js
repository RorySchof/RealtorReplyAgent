// // src/repairs.js

// import Groq from "groq-sdk";

// const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// /**
//  * Thin wrapper for calling your model.
//  * You can adjust the model name or temperature here if needed.
//  */
// async function callModel(prompt) {
//   const completion = await groq.chat.completions.create({
//     model: "llama-3.1-8b-instant",
//     messages: [
//       { role: "system", content: "Rewrite the text exactly as instructed. Output ONLY the rewritten text." },
//       { role: "user", content: prompt }
//     ],
//     temperature: 0.2,
//   });

//   return completion.choices[0].message.content;
// }

// /**
//  * Extracts the first concrete detail from the client's email.
//  * This helps rewrite the reply opener in a grounded way.
//  */
// export function extractFirstConcreteDetail(email) {
//   if (!email) return "the property you mentioned";

//   // Look for addresses or property types
//   const addressMatch = email.match(/\b\d{1,4}\s+[A-Za-z][A-Za-z\s]+\b/);
//   if (addressMatch) return addressMatch[0];

//   const propertyMatch = email.match(/\b(duplex|triplex|semi|condo|townhome|unit|apartment)\b/i);
//   if (propertyMatch) return propertyMatch[0];

//   // Fallback
//   return "the property you mentioned";
// }

// /**
//  * Rewrite vague action items so they begin with a specific external contact.
//  */
// export async function rewriteActionItems(items) {
//   const prompt = `
// Rewrite each of the following action items so that they begin with a specific external contact
// (e.g., "Contact the listing agent...", "Ask a structural engineer...", "Get a written quote from a contractor...")
// and do NOT use vague verbs like "research," "investigate," "look into," or "review."

// Keep the meaning identical.
// Return ONLY a JSON array of rewritten strings.

// Items:
// ${items.map(i => `- ${i}`).join("\n")}
// `;

//   const result = await callModel(prompt);

//   try {
//     return JSON.parse(result);
//   } catch (err) {
//     console.error("[repairs.js] Failed to parse rewritten action items:", err);
//     return items; // fallback: return originals
//   }
// }

// /**
//  * Rewrite ONLY the opening sentence of the reply.
//  */
// export async function rewriteReplyOpening(reply, originalEmail) {
//   const detail = extractFirstConcreteDetail(originalEmail);

//   const prompt = `
// Rewrite ONLY the opening sentence of the following reply so that it references this specific detail:
// "${detail}"

// Do NOT use generic pleasantries or meta-statements.
// Do NOT change any other sentences.
// Return ONLY the full rewritten reply.

// Reply:
// ${reply}
// `;

//   const result = await callModel(prompt);
//   return result.trim();
// }
