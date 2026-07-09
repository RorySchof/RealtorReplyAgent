import { hasBuriedActionItems } from "./extractEmail.js";

const OVERWHELM_PHRASES = [
  /\bi['']?m confused\b/i,
  /\bi['']?m overwhelmed\b/i,
  /\bdisaster of a day\b/i,
  /\bmore confused\b/i,
];

const ANXIETY_PHRASES = [
  /\bi['']?m worried\b/i,
  /\bi keep thinking about\b/i,
  /\bi['']?m tired\b/i,
  /\bi don['']?t know\b/i,
];

const INDECISION_PHRASES = [
  /\bi keep going back and forth\b/i,
  /\bi['']?m not sure\b/i,
  /\bpart of me thinks\b/i,
  /\bmaybe i['']?m just tired\b/i,
];

const INSPECTION_CONFUSION_PHRASES = [
  /\bfurther evaluation recommended\b/i,
  /\bthe wording felt vague\b/i,
  /\bnot sure what that means\b/i,
  /\bwording felt vague\b/i,
  /\bfelt vague\b/i,
];

const CONCERN_TOPIC_PATTERN =
  /\b(roof|basement|furnace|deck|hvac|moisture|electrical|plumbing|inspection|shingles|water|panel|wiring)\b/gi;

const NOTE_OVERWHELM =
  "Client expresses overwhelm — keep reply structured and concise.";
const NOTE_ANXIETY =
  "Client shows anxiety — stick to factual, non‑reassuring language.";
const NOTE_REPEATED_CONCERN =
  "Client repeated the concern — emphasize clarity and next steps.";
const NOTE_MULTI_PROPERTY =
  "Client is juggling multiple properties — avoid comparisons and anchor reply to actionable items.";
const NOTE_BURIED_ACTION =
  "Action item buried in narrative — highlight it clearly in the reply.";
const NOTE_INDECISION =
  "Client is indecisive — anchor reply to concrete next steps.";
const NOTE_INSPECTION_CONFUSION =
  "Client is confused by inspection wording — explain without interpreting.";

function matchesAny(text, patterns) {
  return patterns.some((rx) => rx.test(text));
}

function normalizeConcernKey(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectRepeatedConcerns(email, extraction) {
  const concerns = extraction.concerns || [];
  const keys = concerns.map(normalizeConcernKey).filter(Boolean);
  const uniqueKeys = new Set(keys);
  if (keys.length > uniqueKeys.size) return true;

  const topicCounts = new Map();
  const matches = email.match(CONCERN_TOPIC_PATTERN) || [];
  for (const match of matches) {
    const topic = match.toLowerCase();
    topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    if (topicCounts.get(topic) > 1) return true;
  }

  const repeatedPhrasePattern =
    /\b(keep thinking about|still on my mind|worries me|stuck with me)\b/gi;
  const repeatedPhrases = email.match(repeatedPhrasePattern) || [];
  if (repeatedPhrases.length > 1) return true;

  return false;
}

function detectEmotionalSignals(email) {
  const notes = [];
  if (matchesAny(email, OVERWHELM_PHRASES)) {
    notes.push(NOTE_OVERWHELM);
  }
  if (matchesAny(email, ANXIETY_PHRASES)) {
    notes.push(NOTE_ANXIETY);
  }
  return notes;
}

/**
 * @param {string} email
 * @param {import("./extractEmail.js").ExtractionResult} extraction
 * @returns {string[]}
 */
export function generateCoachNotes(email, extraction) {
  const notes = [];
  const text = email || extraction?.raw_email || "";

  notes.push(...detectEmotionalSignals(text));

  if (detectRepeatedConcerns(text, extraction)) {
    notes.push(NOTE_REPEATED_CONCERN);
  }

  if ((extraction?.properties || []).length >= 2) {
    notes.push(NOTE_MULTI_PROPERTY);
  }

  if (hasBuriedActionItems(extraction)) {
    notes.push(NOTE_BURIED_ACTION);
  }

  if (matchesAny(text, INDECISION_PHRASES)) {
    notes.push(NOTE_INDECISION);
  }

  if (matchesAny(text, INSPECTION_CONFUSION_PHRASES)) {
    notes.push(NOTE_INSPECTION_CONFUSION);
  }

  return [...new Set(notes)];
}
