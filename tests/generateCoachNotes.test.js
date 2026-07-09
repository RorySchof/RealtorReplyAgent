import test from "node:test";
import assert from "node:assert/strict";
import { extractEmail } from "../src/extractEmail.js";
import { generateCoachNotes } from "../src/generateCoachNotes.js";
import { validateAgentOutput } from "../api/validate-agent-output.js";

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

test("emotional detection — overwhelm and anxiety", () => {
  const email =
    "Hi Rory,\n\nSorry for the late message — today has been a bit of a disaster. I'm more confused now than before. I keep thinking about the basement at 22 Willowbank.";
  const extraction = extractEmail(email);
  const notes = generateCoachNotes(email, extraction);

  assert.ok(notes.includes(NOTE_OVERWHELM));
  assert.ok(notes.includes(NOTE_ANXIETY));
});

test("repeated concerns", () => {
  const email =
    "Rory,\n\nThe roof at 48 Juniper Ridge is still on my mind. The inspector said it was serviceable, but that feels vague. When you get a moment, can you confirm the actual roof age?\n\nAlso, could you check with the seller whether they've replaced any sections recently?";
  const extraction = extractEmail(email);
  const notes = generateCoachNotes(email, extraction);

  assert.ok(notes.includes(NOTE_REPEATED_CONCERN));
});

test("multi-property detection", () => {
  const email =
    "Rory,\n\nWe've been bouncing between a few places — 48 Juniper Ridge, 22 Willowbank, and that townhouse on Cedar.\n\nCan you check whether 48 Juniper Ridge ever had roof repairs?";
  const extraction = extractEmail(email);
  const notes = generateCoachNotes(email, extraction);

  assert.ok(notes.includes(NOTE_MULTI_PROPERTY));
});

test("buried action items", () => {
  const email =
    "Hi Rory,\n\nWe really liked the place at 19 Larchwood, but I keep thinking about the furnace. It looked newer, but the seller didn't mention anything in the disclosure. I'm not sure if I'm overthinking it.\n\nWhen you get a chance, could you find out the actual install date?";
  const extraction = extractEmail(email);
  const notes = generateCoachNotes(email, extraction);

  assert.ok(notes.includes(NOTE_BURIED_ACTION));
});

test("indecision", () => {
  const email =
    "Rory,\n\nI keep going back and forth on 9 Carlaw. Part of me thinks it's the safest option, but part of me thinks I'm settling. Maybe I'm just tired.";
  const extraction = extractEmail(email);
  const notes = generateCoachNotes(email, extraction);

  assert.ok(notes.includes(NOTE_INDECISION));
});

test("inspection confusion", () => {
  const email =
    "Hi Rory,\n\nThe electrical part confused me. The wording felt vague. Could you reach out to the inspector and ask what \"further evaluation recommended\" actually means? I'm not sure what that means.";
  const extraction = extractEmail(email);
  const notes = generateCoachNotes(email, extraction);

  assert.ok(notes.includes(NOTE_INSPECTION_CONFUSION));
});

test("validateAgentOutput assigns coach_notes and removes rapport_questions", () => {
  const email = "Hi Rory,\n\nI'm confused and worried about 22 Willowbank.";
  const extraction = extractEmail(email);
  const { cleaned } = validateAgentOutput(
    {
      action_items: [],
      client_questions: [],
      rapport_questions: ["How are you feeling about everything?"],
      followup_items: [],
      reply: "22 Willowbank's disclosure is on file.",
    },
    email,
    extraction
  );

  assert.ok(Array.isArray(cleaned.coach_notes));
  assert.ok(cleaned.coach_notes.length > 0);
  assert.equal(cleaned.rapport_questions, undefined);
});
