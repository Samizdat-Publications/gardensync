/* GardenSync — Tweaks Panel
   Runtime toggles for optional visual effects. State is persisted to
   localStorage under `gardensync.tweaks.<key>`. Each tweak mirrors onto
   <body> as `tweak-<key>-on` so CSS-only effects can respond globally. */

const TWEAK_META = [
    { key: 'bloom',            title: 'BLOOM',            desc: 'Radial emerald burst at plant drop point.' },
    { key: 'living',           title: 'LIVING',           desc: 'Idle sway on every placed plant; wind gust sweeps each bed.' },
    { key: 'timeline',         title: 'TIMELINE',         desc: 'Plants grow seed through harvest as the season scrubs.' },
    { key: 'companion',        title: 'COMPANION',        desc: 'Hover Plant Library entry to highlight friends/foes on grid.' },
    { key: 'companionAlways',  title: 'COMPANION ALWAYS', desc: 'Persistent dashed network between nearby placed plants.' },
    { key: 'heatmap',          title: 'HEATMAP',          desc: 'Per-bed moisture pools + sun arc overlay (diagnostic).' },
    { key: 'harvestBurst',     title: 'HARVEST BURST',    desc: 'Click a ripe plant to yoink it; confetti + harvest log entry.' },
    { key: 'tickerStats',      title: 'TICKER STATS',     desc: 'Right-rail stat numbers roll like slot-machine digits.' },
    { key: 'pageTurn',         title: 'PAGE TURN',        desc: '3D skew/rotate transition when switching top-nav tabs.' },
];

const TWEAK_KEYS = TWEAK_META.map(t => t.key);

function tweaksSafeToast(msg) {
    if (typeof showToast === 'function') showToast(msg);
}

function applyLivingClass(containerId) {
    const root = containerId
        ? document.querySelectorAll('.garden-bed[data-container-id="' + containerId + '"] .placed-plant')
        : document.querySelectorAll('.placed-plant');
    const living = !!(state.tweaks && state.tweaks.living);
    root.forEach(el => {
        if (living) {
            el.classList.add('living');
            if (!el.style.getPropertyValue('--sway-dur')) {
                const x = parseFloat(el.style.left) || 0;
                const y = parseFloat(el.style.top) || 0;
                const dur = (3.5 + ((x + y) % 80) / 80 * 1.5).toFixed(2);
                const delay = (((x * 13 + y * 7) % 100) / 100 * 2).toFixed(2);
                el.style.setProperty('--sway-dur', dur + 's');
                el.style.setProperty('--sway-delay', delay + 's');
            }
        } else {
            el.classList.remove('living');
        }
    });
}

function triggerBloom(x, y, bedEl) {
    if (!bedEl) return;
    if (!(state.tweaks && state.tweaks.bloom)) return;
    const b = document.createElement('div');
    b.className = 'bloom-burst';
    b.style.left = x + 'px';
    b.style.top = y + 'px';
    bedEl.appendChild(b);
    setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 600);
}

function applyTweakBodyClasses() {
    TWEAK_KEYS.forEach(k => {
        document.body.classList.toggle('tweak-' + k + '-on', !!(state.tweaks && state.tweaks[k]));
    });
}

function setTweak(key, on) {
    if (TWEAK_KEYS.indexOf(key) === -1) return;
    state.tweaks[key] = !!on;
    try { localStorage.setItem('gardensync.tweaks.' + key, on ? 'true' : 'false'); } catch (e) {}
    document.body.classList.toggle('tweak-' + key + '-on', !!on);

    const row = document.querySelector('.tweak-row[data-key="' + key + '"]');
    if (row) {
        row.classList.toggle('on', !!on);
        const sw = row.querySelector('.tweak-switch');
        if (sw) sw.classList.toggle('on', !!on);
    }

    if (key === 'companionAlways') {
        if (typeof redrawAllCompanionNetworks === 'function') redrawAllCompanionNetworks();
    }
    if (key === 'living') applyLivingClass();

    // TODO: wire timeline, heatmap, harvestBurst (stage), tickerStats, pageTurn
    // once those subsystems land. For now they only flip body classes + persist.

    tweaksSafeToast(key.toUpperCase() + ': ' + (on ? 'ON' : 'OFF'));
}

function applyPreset(name) {
    let cfg;
    if (name === 'MINIMAL') {
        cfg = { bloom: false, living: false, timeline: false, companion: false, companionAlways: false, heatmap: false, harvestBurst: false, tickerStats: false, pageTurn: false };
    } else if (name === 'SUBTLE') {
        cfg = { bloom: true, living: true, timeline: false, companion: true, companionAlways: true, heatmap: false, harvestBurst: true, tickerStats: false, pageTurn: false };
    } else {
        cfg = { bloom: true, living: true, timeline: true, companion: true, companionAlways: true, heatmap: true, harvestBurst: true, tickerStats: true, pageTurn: true };
    }
    TWEAK_KEYS.forEach(k => setTweak(k, cfg[k]));
    tweaksSafeToast('PRESET: ' + name);
}

function _makeEl(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
}

function buildTweaksPanel() {
    if (document.getElementById('tweaks-panel')) return;

    const panel = _makeEl('div', 'tweaks-panel hidden');
    panel.id = 'tweaks-panel';

    const header = _makeEl('div', 'tweaks-header');
    header.appendChild(_makeEl('span', null, 'TWEAKS'));
    const closeBtn = _makeEl('button', 'tweaks-close', '\u00D7');
    closeBtn.setAttribute('aria-label', 'Close tweaks');
    header.appendChild(closeBtn);
    panel.appendChild(header);

    panel.appendChild(_makeEl('div', 'tweaks-sub', 'Fine-tune motion + effects. Saved locally.'));

    const presets = _makeEl('div', 'tweaks-presets');
    ['MINIMAL', 'SUBTLE', 'MAX'].forEach(p => {
        const btn = _makeEl('button', 'tweak-preset', p);
        btn.setAttribute('data-preset', p);
        btn.addEventListener('click', e => {
            e.stopPropagation();
            applyPreset(p);
        });
        presets.appendChild(btn);
    });
    panel.appendChild(presets);

    const list = _makeEl('div', 'tweaks-list');
    TWEAK_META.forEach(t => {
        const on = !!(state.tweaks && state.tweaks[t.key]);
        const row = _makeEl('div', 'tweak-row' + (on ? ' on' : ''));
        row.setAttribute('data-key', t.key);

        const main = _makeEl('div', 'tweak-main');
        main.appendChild(_makeEl('span', 'tweak-title', t.title));
        const sw = _makeEl('button', 'tweak-switch' + (on ? ' on' : ''));
        sw.setAttribute('aria-label', 'Toggle ' + t.title);
        sw.appendChild(_makeEl('span', 'knob'));
        main.appendChild(sw);
        row.appendChild(main);

        row.appendChild(_makeEl('div', 'tweak-desc', t.desc));

        row.addEventListener('click', e => {
            setTweak(t.key, !(state.tweaks && state.tweaks[t.key]));
            e.stopPropagation();
        });
        list.appendChild(row);
    });
    panel.appendChild(list);

    closeBtn.addEventListener('click', e => {
        e.stopPropagation();
        closeTweaksPanel();
    });

    document.body.appendChild(panel);
}

function openTweaksPanel() {
    buildTweaksPanel();
    const panel = document.getElementById('tweaks-panel');
    const gear = document.getElementById('tweaks-gear');
    if (panel) panel.classList.remove('hidden');
    if (gear)  gear.classList.add('hidden');
}

function closeTweaksPanel() {
    const panel = document.getElementById('tweaks-panel');
    const gear = document.getElementById('tweaks-gear');
    if (panel) panel.classList.add('hidden');
    if (gear)  gear.classList.remove('hidden');
}

function initTweaks() {
    if (!document.getElementById('tweaks-gear')) {
        const gear = _makeEl('button', 'tweaks-gear', '\u2699');
        gear.id = 'tweaks-gear';
        gear.setAttribute('aria-label', 'Open tweaks panel');
        gear.addEventListener('click', openTweaksPanel);
        document.body.appendChild(gear);
    }
    applyTweakBodyClasses();
    applyLivingClass();
}

window.initTweaks = initTweaks;
window.setTweak = setTweak;
window.applyPreset = applyPreset;
window.applyLivingClass = applyLivingClass;
window.triggerBloom = triggerBloom;
window.openTweaksPanel = openTweaksPanel;
window.closeTweaksPanel = closeTweaksPanel;
