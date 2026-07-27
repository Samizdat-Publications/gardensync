/* Regenerate the planner's documentation screenshots.
 *
 * Each capture reproduces a documented view from a known demo garden at the
 * same viewport as the original, so the alt text in README.md and
 * docs/index.html stays accurate. Run against a static server on this repo:
 *
 *   python proxy.py                (or: python -m http.server 8080)
 *   node tools/shoot-planner.js <out-dir>
 */
const { chromium } = require('playwright');
const path = require('path');

const OUT = process.argv[2];
const URL = 'http://127.0.0.1:8080/';
if (!OUT) { console.error('usage: node shoot-planner.js <out-dir>'); process.exit(1); }

const STILL = `
  *,*::before,*::after { animation: none !important; transition: none !important; }
  .ticker-content { animation: none !important; transform: none !important; }
  /* transient toasts are not part of the views these captures document */
  .toast-notification { display: none !important; }
`;

(async () => {
  const browser = await chromium.launch();

  const shot = async (name, w, h, prep, opts = {}) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on('dialog', d => d.accept());
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: STILL });
    await page.waitForTimeout(700);            // let init.js finish wiring
    if (prep) await prep(page);
    await page.waitForTimeout(450);
    const file = path.join(OUT, name);
    try {
      if (opts.selector) await page.locator(opts.selector).first().screenshot({ path: file });
      else await page.screenshot({ path: file });
      console.log('  wrote', name);
    } catch (e) {
      console.log('  FAILED', name, String(e).split('\n')[0]);
    }
    await page.close();
  };

  const demo = key => `(() => {
    const d = DEMO_REGISTRY.find(x => x.key === '${key}');
    applyDemoData(typeof d.source === 'function' ? d.source() : d.source, '');
    document.querySelectorAll('.confirm-modal-overlay').forEach(e => e.remove());
  })()`;

  const tab = name => `document.querySelector('.nav-btn[data-tab="${name}"]').click()`;

  // 1 — the planner as it opens
  await shot('planner-hero.png', 1440, 900);

  // 2 — four beds with companion threads drawn
  await shot('planner-beds.png', 1600, 1000, async p => {
    await p.evaluate(demo('classic'));
    await p.evaluate(`document.getElementById('btn-zoom-fit')?.click()`);
  });

  // 3-6 — the other workspaces, on a planted garden
  for (const [name, t] of [['planner-schedule.png','schedule'], ['planner-harvest.png','harvest'],
                           ['planner-volunteers.png','volunteers'], ['planner-climate.png','climate']]) {
    await shot(name, 1600, 1000, async p => {
      await p.evaluate(demo('classic'));
      await p.evaluate(tab(t));
    });
  }

  // 7 — Garden Buddy
  await shot('planner-buddy.png', 1600, 1000, async p => {
    await p.evaluate(demo('classic'));
    await p.evaluate(`document.getElementById('garden-buddy-fab').click()`);
  });

  // 8 — on a phone, panels become drawers
  await shot('planner-mobile.png', 390, 844, async p => {
    await p.evaluate(demo('classic'));
  });

  // 9 — the container showcase
  await shot('feat-containers.png', 1600, 1000, async p => {
    await p.evaluate(demo('showcase'));
    await p.evaluate(`document.getElementById('btn-zoom-fit')?.click()`);
  });

  // 10 — light theme, same garden
  await shot('feat-light-theme.png', 1600, 1000, async p => {
    await p.evaluate(demo('classic'));
    await p.evaluate(`document.getElementById('theme-toggle').click()`);
    await p.evaluate(`document.getElementById('btn-zoom-fit')?.click()`);
  });

  // 11 — companion threads, zoomed in on the salsa bed
  await shot('feat-companions.png', 1600, 1000, async p => {
    await p.evaluate(demo('salsa'));
    await p.evaluate(`(() => {
      for (let i = 0; i < 6; i++) document.getElementById('btn-zoom-in')?.click();
    })()`);
  }, { selector: '#garden-canvas-wrap, .garden-viewport, #garden-canvas' });

  // 12 — the plant library panel
  await shot('feat-library.png', 1600, 1000, null, { selector: '.plant-palette' });

  // 13 — live garden statistics
  await shot('feat-stats.png', 1600, 1000, async p => {
    await p.evaluate(demo('classic'));
    await p.evaluate(`document.getElementById('btn-stats-toggle').click()`);
  }, { selector: '.stats-dashboard' });

  // 14 — today's tasks
  await shot('feat-tasks.png', 1600, 1000, async p => {
    await p.evaluate(demo('classic'));
  }, { selector: '#today-dashboard' });

  // 15 — the demo picker
  await shot('feat-demos.png', 1600, 1000, async p => {
    await p.evaluate(`loadDemoData()`);
  }, { selector: '.confirm-modal' });

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
