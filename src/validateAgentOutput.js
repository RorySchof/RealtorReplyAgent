// src/validateAgentOutput.js

//
// FOLLOWUP ITEMS
// Catch "Discuss", "Analyze", and all analysis verbs even with punctuation,
// capitalization, or leading whitespace.
//
const FOLLOWUP_BANNED =
  /(^|\s)(discuss|analyz|compar|evaluat|determin|decid|assess|weigh)\w*/i;

//
// RAPPORT QUESTIONS
// Catch "property search" as a phrase, plus "property" and "search" individually.
// Also catch strategy/concern terms.
//
const RAPPORT_BANNED =
  /(property\s+search|property|search|risk|reward|resale|roi|renovation|invest|cash flow|concern)/i;

//
// CLIENT QUESTIONS
// Same as before — these were already correct.
//
const CLIENT_Q_BANNED =
  /\b(budget|priorit|goal|risk tolerance|timeline|strategy)\b/i;

//
// ACTION ITEMS
// Catch vague verbs even with leading whitespace.
//
const ACTION_VAGUE_START =
  /^\s*(research|investigate|look into|review|schedule)\b/i;

//
// REPLY OPENERS
// Loosen spacing rules, allow comma OR space, allow multiple spaces,
// allow variants like "Hi Evan , I've taken a close look".
//
const REPLY_BANNED_OPENERS = [
  /^(hi|hey)\s+\w+[, ]*\s*(thanks for reaching out|i'd be happy to help|i'm happy to help|i've taken note|i understand you|i've taken a close look)/i,
];

export function validateAgentOutput(parsed) {
  const cleaned = { ...parsed };

  //
  // FOLLOWUP ITEMS
  //
  cleaned.followup_items = (cleaned.followup_items || [])
    .filter(item => !FOLLOWUP_BANNED.test(item));

  //
  // RAPPORT QUESTIONS
  //
  cleaned.rapport_questions = (cleaned.rapport_questions || [])
    .filter(q => !RAPPORT_BANNED.test(q))
    .slice(0, 1);

  //
  // CLIENT QUESTIONS
  //
  cleaned.client_questions = (cleaned.client_questions || [])
    .filter(q => !CLIENT_Q_BANNED.test(q));

  //
  // ACTION ITEMS
  //
  const flaggedActionItems = (cleaned.action_items || [])
    .filter(item => ACTION_VAGUE_START.test(item));

  cleaned.action_items = (cleaned.action_items || [])
    .filter(item => !ACTION_VAGUE_START.test(item));

  //
  // REPLY OPENER
  //
  const replyFlagged = REPLY_BANNED_OPENERS.some(rx =>
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
