/* Regenerate A Quiet Almanac's ten documentation screenshots.
 *
 * They are reproduced from the app's own default garden and the same viewport
 * sizes as the originals, so the alt text and figcaptions in the README and the
 * project page stay accurate. Run against a static server on the almanac repo:
 *
 *   python -m http.server 8099   (from the gardensync-almanac checkout)
 *   node tools/shoot-almanac.js  <out-dir>
 */
const { chromium } = require('playwright');
const path = require('path');

const OUT = process.argv[2];
const URL = 'http://127.0.0.1:8099/';
if (!OUT) { console.error('usage: node shoot-almanac.js <out-dir>'); process.exit(1); }

/* Freeze everything that moves so repeat runs are byte-comparable. */
const STILL = `
  *,*::before,*::after { animation: none !important; transition: none !important; }
  .grain { opacity: .28 !important; }
`;

/* The app boots from localStorage; clear it so every run starts from the
   default plan, then re-run boot() so the garden is the documented one. */
async function reset(page) {
  await page.evaluate(() => {
    localStorage.removeItem('gardensync-almanac-v1');
    state.beds = TEMPLATES['easy-start']();
    state.harvests = []; state.sel = null; state.armed = null;
    state.viewDoy = DOY(6, 26);           // Jul 26 — the date the captions quote
    state.pinHint = false;
    renderRibbon(); renderDrawer(); renderBeds(); renderAlmanac(); renderPlantingNote();
    /* the first-run welcome toast sits over the beds; it is not part of the
       view these captures are documenting */
    const w = document.getElementById('whisper');
    w.hidden = true;
    window.whisper = () => {};
  });
  await page.waitForTimeout(150);
}

(async () => {
  const browser = await chromium.launch();
  const shot = async (name, w, h, prep, opts = {}) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: STILL });
    await reset(page);
    if (prep) await prep(page);
    await page.waitForTimeout(250);
    const file = path.join(OUT, name);
    if (opts.selector) await page.locator(opts.selector).screenshot({ path: file });
    else if (opts.clip) await page.screenshot({ path: file, clip: opts.clip });
    else await page.screenshot({ path: file });
    console.log('  wrote', name, `${w}x${h}`);
    await page.close();
  };

  // 1 & 2 — the garden as it opens
  await shot('almanac-hero.png', 1440, 900);
  await shot('almanac-garden.png', 1600, 1000);

  // 3 — April: sprouts and dashed plans, with the Kale page open
  await shot('almanac-scrub.png', 1600, 1000, async p => {
    await p.evaluate(() => {
      state.viewDoy = DOY(3, 16);
      const bed = state.beds[0];
      state.sel = { bedId: bed.id, uid: bed.plants[0].uid };
      renderRibbon(); renderBeds(); renderAlmanac();
    });
  });

  // 4 — October: the same beds, spent
  await shot('almanac-october.png', 1600, 1000, async p => {
    await p.evaluate(() => {
      state.viewDoy = DOY(9, 16);
      renderRibbon(); renderBeds(); renderAlmanac();
    });
  });

  // 5 — holding a tomato packet: friends ringed, foes dotted
  await shot('almanac-halos.png', 1600, 1000, async p => {
    await p.evaluate(() => { armPacket('tomato'); });
  });

  // 6 — the plant page for Kale
  await shot('almanac-plant.png', 1600, 1000, async p => {
    await p.evaluate(() => {
      const bed = state.beds[0];
      state.sel = { bedId: bed.id, uid: bed.plants[0].uid };
      renderBeds(); renderAlmanac();
    });
  });

  // 7 — the potting shed row
  await shot('almanac-shed.png', 1600, 1000, async p => {
    await p.evaluate(() => document.querySelector('.potting-shed').scrollIntoView({ block: 'center' }));
  }, { selector: '.potting-shed' });

  // 8 — the printable year
  await shot('almanac-calendar.png', 1600, 1000, async p => {
    await p.evaluate(() => openCalendar());
  });

  // 9 — Ask the almanac, answering offline
  await shot('almanac-ask.png', 1600, 1000, async p => {
    await p.evaluate(async () => {
      document.getElementById('ask-toggle').click();
      document.getElementById('ask-input').value = 'when should I plant garlic?';
      document.getElementById('ask-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await p.waitForTimeout(5000);      // let the proxy probe fail over to localAnswer
  }, { selector: '.ask-wrap' });

  // 10 — the manual
  await shot('almanac-help.png', 1600, 1000, async p => {
    await p.evaluate(() => { document.getElementById('help-overlay').hidden = false; });
  }, { selector: '#help-overlay .overlay-page' });

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
