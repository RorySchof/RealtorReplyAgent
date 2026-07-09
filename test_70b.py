#!/usr/bin/env python3

import json
import os
import subprocess
import sys

BASE_URL = os.environ.get(
    "EVAL_BASE_URL", "https://realtor-reply-agent.vercel.app"
)
ROOT = os.path.dirname(os.path.abspath(__file__))


def read_email():
    if len(sys.argv) > 1:
        return sys.argv[1]
    with open(os.path.join(ROOT, "prompts/test-email.txt"), encoding="utf-8") as f:
        return f.read()


NODE_RUNNER = r"""
import handler from "./api/inbound-email.js";

const email = JSON.parse(process.env.EVAL_EMAIL);
const baseUrl = process.env.EVAL_BASE_URL;

process.env.NEXT_PUBLIC_BASE_URL = baseUrl;

let outboundText = "";
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, init) => {
  if (String(url).includes("api.mailgun.net")) {
    outboundText = new URLSearchParams(init.body).get("text") || "";
    return { ok: true, text: async () => "Queued" };
  }
  return originalFetch(url, init);
};

function sectionItems(text, name, nextNames) {
  const start = text.indexOf(name + ":");
  if (start === -1) return [];
  let end = text.length;
  for (const next of nextNames) {
    const idx = text.indexOf(next + ":", start + name.length);
    if (idx !== -1 && idx < end) end = idx;
  }
  const block = text.slice(start + name.length + 1, end).trim();
  if (!block) return [];
  return block
    .split("\n")
    .map((line) => line.replace(/^- /, "").trim())
    .filter(Boolean);
}

function parseOutboundEmail(text) {
  const replyStart = text.indexOf("Draft Reply:");
  const replyEnd = text.indexOf("Send to Client:");
  const reply =
    replyStart === -1
      ? ""
      : text
          .slice(
            replyStart + "Draft Reply:".length,
            replyEnd === -1 ? text.length : replyEnd
          )
          .trim();

  return {
    action_items: sectionItems(text, "Action Items", [
      "Questions FROM Client",
      "Questions FOR Client",
      "Coach's Notes",
      "Follow-Ups",
      "Draft Reply",
    ]),
    questions_from_client: sectionItems(text, "Questions FROM Client", [
      "Questions FOR Client",
      "Coach's Notes",
      "Follow-Ups",
      "Draft Reply",
    ]),
    questions_for_client: sectionItems(text, "Questions FOR Client", [
      "Coach's Notes",
      "Follow-Ups",
      "Draft Reply",
    ]),
    coach_notes: sectionItems(text, "Coach's Notes", [
      "Follow-Ups",
      "Draft Reply",
    ]),
    followup_items: sectionItems(text, "Follow-Ups", [
      "Draft Reply",
    ]),
    reply,
  };
}

const body = new URLSearchParams({
  sender: "eval@test.local",
  subject: "Eval test",
  "body-plain": email,
}).toString();

const req = {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  on(event, cb) {
    if (event === "data") cb(Buffer.from(body));
    if (event === "end") cb();
  },
};

let statusCode = 500;
let responseBody = null;

const res = {
  status(code) {
    statusCode = code;
    return this;
  },
  json(payload) {
    responseBody = payload;
  },
};

await handler(req, res);

if (statusCode !== 200) {
  console.error("inbound-email failed:", statusCode, responseBody);
  process.exit(1);
}

if (!outboundText) {
  console.error("No outbound email captured from inbound-email handler");
  process.exit(1);
}

console.log(JSON.stringify(parseOutboundEmail(outboundText), null, 2));
"""


def main():
    email = read_email()
    env = {
        **os.environ,
        "EVAL_EMAIL": json.dumps(email),
        "EVAL_BASE_URL": BASE_URL,
    }

    result = subprocess.run(
        ["node", "--input-type=module", "-e", NODE_RUNNER],
        cwd=ROOT,
        capture_output=True,
        text=True,
        env=env,
    )

    if result.returncode != 0:
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        if result.stdout:
            print(result.stdout, file=sys.stderr)
        sys.exit(result.returncode)

    print(result.stdout.rstrip())


if __name__ == "__main__":
    main()
