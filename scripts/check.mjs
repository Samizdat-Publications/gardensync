// `npm run check`: the one command that says whether the app is releasable.
// Prints ALL GREEN or FAILED. Pass --quick to run end-to-end tests in Chromium only.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const quick = process.argv.includes('--quick');
const isWin = process.platform === 'win32';
// Playwright's Firefox build will not start on Stewart's Windows machine (a side-by-side runtime
// error), so locally Firefox is left to CI, which runs all three browsers on Linux.
const e2eBrowsers = quick ? 'chromium' : process.env.CI ? 'chromium,firefox,webkit' : 'chromium,webkit';

// Gzipped JavaScript budgets, in KB. The entry chunk is what a first visit must download.
const BUDGET_ENTRY_KB = 150;
const BUDGET_TOTAL_KB = 260;

function run(cmd, args, env = {}) {
  // On Windows npx is a .cmd file, so it needs a shell; pass one command string to avoid DEP0190.
  const res = spawnSync(isWin ? [cmd, ...args].join(' ') : cmd, isWin ? [] : args, {
    shell: isWin,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0', ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: res.status === 0, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

function budget() {
  const dir = 'dist/assets';
  let total = 0;
  let entry = 0;
  const lines = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.js')) continue;
    const kb = gzipSync(readFileSync(join(dir, name))).length / 1024;
    total += kb;
    if (name.startsWith('index-')) entry += kb;
    lines.push(`${name}: ${kb.toFixed(1)} KB gz (${(statSync(join(dir, name)).size / 1024).toFixed(1)} KB raw)`);
  }
  lines.push(`entry ${entry.toFixed(1)} / ${BUDGET_ENTRY_KB} KB, total ${total.toFixed(1)} / ${BUDGET_TOTAL_KB} KB`);
  return { ok: entry <= BUDGET_ENTRY_KB && total <= BUDGET_TOTAL_KB, out: lines.join('\n') };
}

const steps = [
  ['typecheck', () => run('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'])],
  ['unit (America/New_York)', () => run('npx', ['vitest', 'run'], { TZ: 'America/New_York' })],
  ['unit (Australia/Melbourne)', () => run('npx', ['vitest', 'run'], { TZ: 'Australia/Melbourne' })],
  ['build', () => run('npx', ['vite', 'build'])],
  ['bundle budget', budget],
  [
    `e2e (${e2eBrowsers.replaceAll(',', ', ')}${process.env.CI || quick ? '' : '; firefox runs in CI'})`,
    () => run('npx', ['playwright', 'test'], { E2E_BROWSERS: e2eBrowsers }),
  ],
];

let failed = null;
for (const [name, fn] of steps) {
  const t0 = Date.now();
  const res = fn();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${res.ok ? 'PASS' : 'FAIL'}  ${name}  (${secs}s)`);
  if (name === 'bundle budget') console.log(res.out.split('\n').map((l) => `      ${l}`).join('\n'));
  if (!res.ok) {
    failed = name;
    const tail = res.out.trim().split('\n').slice(-80).join('\n');
    console.log(`\n----- ${name} output (last 80 lines) -----\n${tail}\n`);
    break;
  }
}

console.log(failed ? `\nFAILED at: ${failed}` : '\nALL GREEN');
process.exit(failed ? 1 : 0);
