// src/validateAgentOutput.js

//
// FOLLOWUP ITEMS
// Ban analysis verbs in wrong formats. "Discuss … with the client." is required and allowed.
//
const FOLLOWUP_BANNED =
  /(^|\s)(analyz|compar|evaluat|determin|decid|assess|weigh)\w*/i;

const FOLLOWUP_ALLOWED =
  /^Discuss .+ with the client\.$/i;

const FOLLOWUP_UNCERTAINTY =
  /^Discuss the client's uncertainty with them\.$/i;

// Client questions about property facts or scheduling should not generate followups.
const NON_FOLLOWUP_QUESTION =
  /\b(fee|fees|repair|leak|ventilat|maintenance|amount|smell|damp|find out|know if|system|tenant|offer|rule|noise|gutter|garage)\b/i;

const SCHEDULING_QUESTION =
  /\b(talk sometime|schedule a|viewing|tomorrow|morning|afternoon|when can we|what time)\b/i;

//
// RAPPORT QUESTIONS
//
const RAPPORT_BANNED =
  /(property\s+search|property|search|risk|reward|resale|roi|renovation|invest|cash flow|concern)/i;

//
// QUESTIONS FOR CLIENT
//
const CLIENT_Q_BANNED =
  /\b(budget|priorit|goal|risk tolerance|timeline|strategy)\b/i;

//
// ACTION ITEMS
//
const ACTION_VAGUE_START =
  /^\s*(research|investigate|look into|review|schedule)\b/i;

//
// REPLY OPENERS
//
const REPLY_BANNED_OPENERS = [
  /^(hi|hey)\s+\w+[, ]*\s*(thanks for reaching out|i'd be happy to help|i'm happy to help|i've taken note|i understand you|i've taken a close look)/i,
];

function isAllowedFollowupItem(item) {
  const trimmed = (item || "").trim();
  if (!trimmed) return false;
  if (FOLLOWUP_UNCERTAINTY.test(trimmed)) return true;
  if (FOLLOWUP_ALLOWED.test(trimmed)) return true;
  return !FOLLOWUP_BANNED.test(trimmed);
}

function needsFollowupFromClientQuestion(question) {
  const q = question || "";
  if (NON_FOLLOWUP_QUESTION.test(q)) return false;
  if (SCHEDULING_QUESTION.test(q)) return false;
  return true;
}

function followupItemForQuestion(question) {
  return `Discuss ${question.trim()} with the client.`;
}

function supplementFollowupItems(cleaned) {
  const items = [...(cleaned.followup_items || [])];
  const existing = new Set(items.map((s) => s.toLowerCase()));

  for (const question of cleaned.questions_from_client || []) {
    if (!needsFollowupFromClientQuestion(question)) continue;
    const entry = followupItemForQuestion(question);
    if (!existing.has(entry.toLowerCase())) {
      items.push(entry);
      existing.add(entry.toLowerCase());
    }
  }

  cleaned.followup_items = items;
}

export function validateAgentOutput(parsed) {
  const cleaned = { ...parsed };

  //
  // FOLLOWUP ITEMS
  //
  cleaned.followup_items = (cleaned.followup_items || [])
    .filter((item) => isAllowedFollowupItem(item));

  supplementFollowupItems(cleaned);

  //
  // RAPPORT QUESTIONS
  //
  cleaned.rapport_questions = (cleaned.rapport_questions || [])
    .filter((q) => !RAPPORT_BANNED.test(q))
    .slice(0, 1);

  //
  // QUESTIONS FOR CLIENT
  //
  cleaned.questions_for_client = (cleaned.questions_for_client || [])
    .filter((q) => !CLIENT_Q_BANNED.test(q));

  //
  // ACTION ITEMS
  //
  const flaggedActionItems = (cleaned.action_items || [])
    .filter((item) => ACTION_VAGUE_START.test(item));

  cleaned.action_items = (cleaned.action_items || [])
    .filter((item) => !ACTION_VAGUE_START.test(item));

  //
  // REPLY OPENER
  //
  const replyFlagged = REPLY_BANNED_OPENERS.some((rx) =>
    rx.test((cleaned.reply || "").slice(0, 200))
  );

  return {
    cleaned,
    flags: {
      flaggedActionItems,
      replyFlagged,
    },
  };
}
