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
    /\bookridge\b/i,
    /\bwillowbank\b/i,
    /\brisk\b/i,
    /\breward\b/i,
    /\broi\b/i,
    /\brenovation\b/i,
    /\bfinancing\b/i,
    /\binvestment\b/i,
    /\bcash flow\b/i,
    /\btradeoff\b/i,
    /\bcompare\b/i,
    /\bwhich one\b/i,
    /\bbetter fit\b/i,
    /\blong.term\b/i,
  ];
  
  // --- REPLY: banned opener fragments (checked against first 100 chars) ---
  const REPLY_BANNED_OPENERS = [
    /^i['']d (like to|be happy to|love to)/i,
    /^i['']ve (taken note|reviewed|read)/i,
    /^thanks for (reaching out|your message|the email|getting in touch)/i,
    /^great to hear from you/i,
    /^i understand you have/i,
    /^i appreciate you sharing/i,
    /^i wanted to follow up on your concerns/i,
    /^just following up/i,
  ];
  
  // --- FOLLOWUP: banned verbs ---
  const FOLLOWUP_BANNED_VERBS = /\b(analyz|compar|evaluat|determin|decid|assess|weigh|recommend|advis|review|research|identify|figure out|resolve|work out|establish)\w*\b/i;
  
  // --- ACTION ITEMS: duplicate detection ---
  function deduplicateActionItems(items) {
    const seen = new Set();
    return items.filter(item => {
      // Normalize: lowercase, strip punctuation, collapse whitespace
      const key = item.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
      if (seen.has(key)) return false;
      // Also check for near-duplicates: same first 60 chars
      const shortKey = key.slice(0, 60);
      for (const s of seen) {
        if (s.slice(0, 60) === shortKey) return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  // --- RAPPORT: echo-check against client's own questions ---
  function extractClientQuestions(emailText) {
    const normalized = emailText.replace(/\r\n/g, "\n").replace(/\s+/g, " ");
    const segments = normalized.split(/(?<=[.?!])\s+/);
    return segments
      .map(s => s.trim().toLowerCase())
      .filter(s => s.endsWith("?"));
  }
  
  function rapportEchoesClient(question, clientQuestions) {
    const q = question.toLowerCase();
    // Check key emotional words that appear in client's questions
    const clientWords = new Set(
      clientQuestions.flatMap(cq => cq.split(/\s+/).filter(w => w.length > 4))
    );
    const questionWords = q.split(/\s+/).filter(w => w.length > 4);
    const overlap = questionWords.filter(w => clientWords.has(w));
    // If more than 2 significant words overlap, it's an echo
    return overlap.length >= 2;
  }
  
  function validateRapportQuestions(questions, emailText) {
    const clientQuestions = extractClientQuestions(emailText);
    return questions.filter(q => {
      if (RAPPORT_BANNED_TOPICS.some(rx => rx.test(q))) return false;
      if (rapportEchoesClient(q, clientQuestions)) return false;
      return true;
    });
  }
  
  // --- REPLY OPENER CHECK ---
  export function replyOpenerViolates(reply) {
    const opener = (reply || "").trim().slice(0, 120);
    return REPLY_BANNED_OPENERS.some(rx => rx.test(opener));
  }
  
  // --- MAIN VALIDATOR ---
  export function validateAgentOutput(agent, cleanMessage) {
    const flags = [];
    const cleaned = { ...agent };
  
    // 1. Deduplicate action_items
    const deduped = deduplicateActionItems(cleaned.action_items || []);
    if (deduped.length < (cleaned.action_items || []).length) {
      flags.push("action_items:duplicates_removed");
    }
    cleaned.action_items = deduped;
  
    // 2. Strip rapport_questions violations
    const cleanedRapport = validateRapportQuestions(cleaned.rapport_questions || [], cleanMessage);
    if (cleanedRapport.length < (cleaned.rapport_questions || []).length) {
      flags.push("rapport_questions:violations_stripped");
    }
    cleaned.rapport_questions = cleanedRapport;
  
    // 3. Strip followup_items with banned verbs
    const cleanedFollowups = (cleaned.followup_items || []).filter(item => {
      if (FOLLOWUP_BANNED_VERBS.test(item)) {
        flags.push(`followup_items:banned_verb_stripped — "${item}"`);
        return false;
      }
      return true;
    });
    cleaned.followup_items = cleanedFollowups;
  
    // 4. Flag reply opener for regeneration (don't strip — reply needs to be whole)
    const replyNeedsRegeneration = replyOpenerViolates(cleaned.reply || "");
    if (replyNeedsRegeneration) {
      flags.push("reply:opener_violation");
    }
  
    return { cleaned, flags, replyNeedsRegeneration };
  }