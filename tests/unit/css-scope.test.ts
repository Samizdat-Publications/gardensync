import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Screens load their stylesheets lazily and keep them, so a class styled by two components leaks
// from one into the other once both have been visited (the planner's season strip once wiped the
// calendar's bars). Each component's selectors must start with classes it owns, scoped if shared.
const ALLOWED = new Set([
  // The calendar's print styles hide the app chrome on purpose.
  'skip-link',
  'app-header',
  'bottom-nav',
]);

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? cssFiles(p) : p.endsWith('.css') ? [p] : [];
  });
}

/** Classes that open a selector at the top of a rule (".seg {" but not ".cal-track .seg {"). */
function leadingClasses(path: string): Set<string> {
  const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Set<string>();
  for (const [, sel] of css.matchAll(/([^{}]+)\{/g)) {
    if (sel!.trim().startsWith('@')) continue;
    for (const part of sel!.split(',')) {
      const m = /^\.([A-Za-z0-9_-]+)/.exec(part.trim());
      if (m) out.add(m[1]!);
    }
  }
  return out;
}

describe('component stylesheets do not style the same class', () => {
  const files = cssFiles('src/ui').filter((f) => !/[\\/]styles[\\/]/.test(f));
  const defs = new Map(files.map((f) => [f, leadingClasses(f)]));
  it('has no class shared between two component stylesheets', () => {
    const clashes: string[] = [];
    for (const [a, ca] of defs) {
      for (const [b, cb] of defs) {
        if (a >= b) continue;
        for (const c of ca) if (cb.has(c) && !ALLOWED.has(c)) clashes.push(`${c}: ${a} and ${b}`);
      }
    }
    expect(clashes).toEqual([]);
  });
});
