/**
 * Deterministic email extraction used by the validator pipeline.
 * Mirrors the wrapper-prompt fields without LLM interpretation.
 */

const PROPERTY_PATTERN =
  /\b\d+\s+[A-Z][A-Za-z]+(?:\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Lane|Ln|Way|Crescent|Cres|Ridge|Bank))?\b/g;

const QUESTION_STARTERS =
  /\b(could you|can you|do you know|is there|should we|what do you think|would you|when you get|if you can|if possible)\b/i;

const CONCERN_SIGNALS =
  /\b(not sure|worried|concerned|nervous|confused|overwhelm|overthinking|keep thinking|unsure|hesitat|anxious)\b/i;

const SCHEDULING_SIGNALS =
  /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}|\d{1,2}:\d{2}\s*(am|pm)?|after \d|before \d|this week|next week|morning|afternoon|evening)\b/i;

const ACTION_REQUEST_PATTERN =
  /\b(could you|can you|when you get (a )?(moment|chance)|if you can|if possible|would you|please (book|schedule|confirm|check|find out|reach out|ask))\b/i;

const NARRATIVE_EMOTIONAL_PATTERN =
  /\b(sorry|chaos|disaster|blur|spinning|patient|thinking about|keep thinking|worried|nervous|confused|overwhelm|tired|not sure|maybe|honestly|anyway|appreciate)\b/i;

/**
 * @typedef {Object} ExtractionResult
 * @property {string} raw_email
 * @property {string[]} properties
 * @property {string[]} questions_from_client
 * @property {string[]} concerns
 * @property {string[]} scheduling
 * @property {string[]} action_requests
 * @property {string} intent
 */

function normalizeWhitespace(text) {
  return (text || "").replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

function splitSegments(text) {
  return text
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractProperties(text) {
  const matches = text.match(PROPERTY_PATTERN) || [];
  const normalized = matches.map((m) => m.replace(/\s+/g, " ").trim());
  return [...new Set(normalized)];
}

function extractQuestions(text) {
  const segments = splitSegments(text);
  const questions = [];

  for (const segment of segments) {
    if (segment.endsWith("?")) {
      questions.push(segment);
      continue;
    }
    if (QUESTION_STARTERS.test(segment)) {
      const questionPart = segment.match(/(?:could you|can you|do you know|is there|should we|what do you think|would you|when you get|if you can|if possible)[^.?!]*[.?!]?/i);
      if (questionPart) {
        questions.push(questionPart[0].trim());
      }
    }
  }

  return [...new Set(questions)];
}

function extractConcerns(text) {
  const segments = splitSegments(text);
  return [
    ...new Set(
      segments.filter((segment) => CONCERN_SIGNALS.test(segment))
    ),
  ];
}

function extractScheduling(text) {
  const segments = splitSegments(text);
  return [
    ...new Set(
      segments.filter((segment) => SCHEDULING_SIGNALS.test(segment))
    ),
  ];
}

function extractActionRequestDetails(text) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const requests = [];

  for (const paragraph of paragraphs) {
    const sentences = splitSegments(paragraph);
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (!ACTION_REQUEST_PATTERN.test(sentence)) continue;

      const priorText = sentences.slice(0, i).join(" ");
      requests.push({
        sentence,
        buried:
          i > 0 &&
          (NARRATIVE_EMOTIONAL_PATTERN.test(priorText) || priorText.length > 80),
      });
    }
  }

  return requests;
}

function extractIntent(text) {
  const segments = splitSegments(text);
  const actionSegment = segments.find((s) => ACTION_REQUEST_PATTERN.test(s));
  if (actionSegment) return actionSegment;
  const concernSegment = segments.find((s) => CONCERN_SIGNALS.test(s));
  if (concernSegment) return concernSegment;
  return segments[0] || "";
}

/**
 * @param {string} email
 * @returns {ExtractionResult}
 */
export function extractEmail(email) {
  const raw_email = normalizeWhitespace(email);
  const actionRequests = extractActionRequestDetails(raw_email);

  return {
    raw_email,
    properties: extractProperties(raw_email),
    questions_from_client: extractQuestions(raw_email),
    concerns: extractConcerns(raw_email),
    scheduling: extractScheduling(raw_email),
    action_requests: actionRequests.map((r) => r.sentence),
    intent: extractIntent(raw_email),
  };
}

export function hasBuriedActionItems(extraction) {
  const details = extractActionRequestDetails(extraction.raw_email || "");
  return details.some((r) => r.buried);
}
