import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = readFileSync(join(__dirname, "../prompts/system-prompt.txt"), "utf8");

export default function handler(req, res) {
  res.status(200).send(SYSTEM_PROMPT);
}
