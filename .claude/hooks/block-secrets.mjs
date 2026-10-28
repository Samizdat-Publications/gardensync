// PreToolUse hook for Edit and Write: blocks edits to .env files and any edit whose text contains
// something that looks like a real credential. Exit code 2 blocks the tool call; stderr is the reason.
// Variable names such as apiKey are fine; only real key formats are caught.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const SECRET_PATTERNS = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, 'an Anthropic API key'],
  [/AIza[0-9A-Za-z_-]{35}/, 'a Google API key'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, 'a GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key'],
  [/-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/, 'a private key'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'a signed token (JWT)'],
];

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}
const t = input?.tool_input ?? {};
const file = basename(String(t.file_path ?? ''));

if (/^\.env(\..+)?$/.test(file) && !/\.example$/.test(file)) {
  process.stderr.write(`Blocked: ${file} holds secrets. Edit it yourself outside Claude Code.\n`);
  process.exit(2);
}

const text = [t.content, t.new_string, ...(Array.isArray(t.edits) ? t.edits.map((e) => e?.new_string) : [])]
  .filter((s) => typeof s === 'string')
  .join('\n');
for (const [re, what] of SECRET_PATTERNS) {
  if (re.test(text)) {
    process.stderr.write(`Blocked: this edit to ${file} contains what looks like ${what}. Keep secrets out of the repo.\n`);
    process.exit(2);
  }
}
process.exit(0);
