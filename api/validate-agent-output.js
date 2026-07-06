// validate-agent-output.js

// Runs after groq-proxy returns parsed JSON, before fields are assigned in inbound-email.js.
// Strips rule violations deterministically. Flags reply opener for narrow regeneration.

// --- RAPPORT: banned topic fragments ---
const RAPPORT_BANNED_TOPICS = [
  /\bproperties\b/i,
  /\boptions\b/i,
  /\bcondo\b/i,
  /\bjuniper\b/i,
  /\bmaplewood\b/i,
  /\bdanforth\b/i,
  /\bcarlaw\b/i,
  /\bkingston\b/i,
  /\brookridge\b/i,
  /\bwillowbank\b/i,
  /\brisk\b/i,
  /\breward\b/i,
  /\broi\b/i,
  /\brenovation\b/i,
  /\brepair(s)?\b/i,
  /\bcondition\b/i,
  /\bfinancing\b/i,
  /\baffordab/i,
  /\bbudget\b/i,
  /\binvestment\b/i,
  /\bcash flow\b/i,
  /\btradeoff\b/i,
  /\bcompar(e|ing|ison)\b/i,
  /\bwhich one\b/i,
  /\bprefer(ence|s)?\b/i,
  /\bbetter fit\b/i,
  /\bdecid(e|ing|ion)\b/i,
  /\blong.term\b/i,
  /\bconcerned\b/i,
  /\bworried\b/i,
  /\bunsure\b/i,
  /\btorn\b/i,
];

// --- REPLY: banned opener fragments (checked against first 120 chars) ---
const REPLY_BANNED_OPENERS = [
  /^hi[, ]+i understand/i,
  /^i understand\b/i,
  /^i wanted to (follow up|confirm|check|reach out)/i,
  /^i['']d like to(\s+confirm)?/i,
  /^i['']d (like to|be happy to|love to)/i,
  /^i['']ve (taken note|reviewed|read)/i,
  /^thanks for (reaching out|your message|the email|getting in touch)/i,
  /^great to hear from you/i,
  /^i understand you have/i,
  /^i appreciate you sharing/i,
  /^i wanted to follow up/i,
  /^just following up/i,
];

// --- FOLLOWUP: banned verbs (single expanded regex) ---
const FOLLOWUP_BANNED_VERBS =
  /\b(analyz|analysis|compar|comparing|comparison|evaluat|evaluation|determin|decid|decision|assess|assessment|recommend|recommendation|weigh|weighing|figure out|work out|establish|advis|research|identify|resolve)\w*\b|review options|discuss which is better/i;

// --- REPLY: leakage patterns (sentence-level strip) ---
const REPLY_LEAKAGE_PATTERNS = [
  /\bcompar(e|ing|ison)\b/i,
  /\bprefer(ence|s)?\b/i,
  /\brecommend/i,
  /\broi\b/i,
  /\binvestment\b/i,
  /\bcash flow\b/i,
  /\brenovation\b/i,
  /\brepair(s)?\b/i,
  /\bcondition\b/i,
  /\bfinanc/i,
  /\baffordab/i,
  /\bbudget\b/i,
  /\boptions\b/i,
  /\bproperties\b/i,
  /\bwhich (one|property|is better)\b/i,
  /\bconcerned\b/i,
  /\bworried\b/i,
  /\bunsure\b/i,
  /\btorn\b/i,
  /\bdecid(e|ing|ion)\b/i,
  /\bbetter fit\b/i,
];

// --- ACTION ITEMS: verb classes for semantic dedupe ---
const ACTION_VERB_CLASSES = [
  { cls: "contact", rx: /\b(contact|call|email|reach out|get in touch)\b/i },
  { cls: "get", rx: /\b(get|obtain|acquire|fetch)\b/i },
  { cls: "confirm", rx: /\b(confirm|verify|check|clarify)\b/i },
  { cls: "request", rx: /\b(request|ask for|inquire about)\b/i },
];

const ACTION_ADDRESS_PATTERNS = [
  /\b\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|way|crescent|cres)\b/gi,
  /\b(?:juniper|maplewood|danforth|carlaw|kingston|brookridge|willowbank)\b/gi,
];

const ACTION_TARGET_PATTERNS = [
  /\binspection report\b/i,
  /\bhome inspection\b/i,
  /\binspection\b/i,
  /\bfurnace age\b/i,
  /\bfurnace\b/i,
  /\broof age\b/i,
  /\broof\b/i,
  /\bstatus certificate\b/i,
  /\bcondo (fee|fees)\b/i,
  /\bproperty tax(es)?\b/i,
  /\bdisclosure\b/i,
  /\boffer\b/i,
  /\bshowing\b/i,
];

function splitIntoSentences(text) {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function stripReplyLeakage(reply) {
  const sentences = splitIntoSentences(reply);
  const kept = sentences.filter(
    (s) => !REPLY_LEAKAGE_PATTERNS.some((rx) => rx.test(s))
  );
  return kept.join(" ").trim();
}

function extractVerbRoot(item) {
  const lower = item.toLowerCase();
  for (const { cls, rx } of ACTION_VERB_CLASSES) {
    if (rx.test(lower)) return cls;
  }
  return "other";
}

function extractPropertyAddressTokens(item) {
  const lower = item.toLowerCase();
  const tokens = [];
  for (const rx of ACTION_ADDRESS_PATTERNS) {
    const matches = lower.match(rx);
    if (matches) {
      for (const m of matches) {
        tokens.push(m.replace(/\s+/g, " ").trim());
      }
    }
  }
  return [...new Set(tokens)].sort();
}

function extractTargetNounPhrase(item) {
  const lower = item.toLowerCase();
  for (const rx of ACTION_TARGET_PATTERNS) {
    const m = lower.match(rx);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return "";
}

function buildSemanticDedupeKey(item) {
  const verbRoot = extractVerbRoot(item);
  const addressTokens = extractPropertyAddressTokens(item).join("|");
  const target = extractTargetNounPhrase(item);
  return `${verbRoot}::${addressTokens}::${target}`;
}

function deduplicateActionItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const semanticKey = buildSemanticDedupeKey(item);
    if (semanticKey !== "other::::") {
      if (seen.has(semanticKey)) return false;
      seen.add(semanticKey);
      return true;
    }
    const key = item
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (seen.has(key)) return false;
    const shortKey = key.slice(0, 60);
    for (const s of seen) {
      if (s.slice(0, 60) === shortKey) return false;
    }
    seen.add(key);
    return true;
  });
}

function extractClientSignificantWords(emailText) {
  const normalized = (emailText || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return new Set(
    normalized
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z]/g, ""))
      .filter((w) => w.length > 4)
  );
}

function extractClientQuestions(emailText) {
  const normalized = emailText.replace(/\r\n/g, "\n").replace(/\s+/g, " ");
  const segments = normalized.split(/(?<=[.?!])\s+/);
  return segments
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.endsWith("?"));
}

function rapportEchoesClient(question, emailText) {
  const q = question.toLowerCase();
  const clientWords = extractClientSignificantWords(emailText);
  const questionWords = q
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z]/g, ""))
    .filter((w) => w.length > 4);
  const overlap = questionWords.filter((w) => clientWords.has(w));
  if (overlap.length >= 2) return true;

  const clientQuestions = extractClientQuestions(emailText);
  const clientQuestionWords = new Set(
    clientQuestions.flatMap((cq) =>
      cq.split(/\s+/).filter((w) => w.length > 4)
    )
  );
  const cqOverlap = questionWords.filter((w) => clientQuestionWords.has(w));
  return cqOverlap.length >= 2;
}

function validateRapportQuestions(questions, emailText) {
  return questions.filter((q) => {
    if (RAPPORT_BANNED_TOPICS.some((rx) => rx.test(q))) return false;
    if (rapportEchoesClient(q, emailText)) return false;
    return true;
  });
}

export function replyOpenerViolates(reply) {
  const opener = (reply || "").trim().slice(0, 120);
  return REPLY_BANNED_OPENERS.some((rx) => rx.test(opener));
}

export function validateAgentOutput(agent, cleanMessage) {
  const flags = [];
  const cleaned = { ...agent };

  const deduped = deduplicateActionItems(cleaned.action_items || []);
  if (deduped.length < (cleaned.action_items || []).length) {
    flags.push("action_items:duplicates_removed");
  }
  cleaned.action_items = deduped;

  const cleanedRapport = validateRapportQuestions(
    cleaned.rapport_questions || [],
    cleanMessage
  );
  if (cleanedRapport.length < (cleaned.rapport_questions || []).length) {
    flags.push("rapport_questions:violations_stripped");
  }
  cleaned.rapport_questions = cleanedRapport;

  const cleanedFollowups = (cleaned.followup_items || []).filter((item) => {
    if (FOLLOWUP_BANNED_VERBS.test(item)) {
      flags.push(`followup_items:banned_verb_stripped — "${item}"`);
      return false;
    }
    return true;
  });
  cleaned.followup_items = cleanedFollowups;

  const strippedReply = stripReplyLeakage(cleaned.reply || "");
  if (strippedReply !== (cleaned.reply || "").trim()) {
    flags.push("reply:leakage_stripped");
  }
  cleaned.reply = strippedReply;

  const replyNeedsRegeneration = replyOpenerViolates(cleaned.reply || "");
  if (replyNeedsRegeneration) {
    flags.push("reply:opener_violation");
  }

  return { cleaned, flags, replyNeedsRegeneration };
}
