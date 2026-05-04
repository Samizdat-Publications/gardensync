/* GardenSync — Toolbar menus, drawer toggle, danger-zone confirm
   (/distill + /harden additions). All UI is built up here so the existing
   feature handlers in toolbar-buttons.js, data-io.js, etc. continue to
   work via their existing button IDs — those buttons just live inside
   the FILE menu now. */

// ---- Generic dropdown menu wiring ----
function _initMenu(wrapId, triggerId) {
    const wrap = document.getElementById(wrapId);
    const trigger = document.getElementById(triggerId);
    if (!wrap || !trigger) return;

    function open() {
        wrap.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        // Close other open menus
        document.querySelectorAll('.menu-wrap.open').forEach(w => {
            if (w !== wrap) {
                w.classList.remove('open');
                const t = w.querySelector('.menu-trigger');
                if (t) t.setAttribute('aria-expanded', 'false');
            }
        });
        // Outside-click + Esc to close
        setTimeout(() => {
            document.addEventListener('click', _onOutsideClick, true);
            document.addEventListener('keydown', _onEscClose, true);
        }, 0);
    }
    function close() {
        wrap.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', _onOutsideClick, true);
        document.removeEventListener('keydown', _onEscClose, true);
    }
    function _onOutsideClick(e) {
        if (!wrap.contains(e.target)) close();
    }
    function _onEscClose(e) {
        if (e.key === 'Escape') { close(); trigger.focus(); }
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (wrap.classList.contains('open')) close();
        else open();
    });

    // Each menu item closes the menu after activation. We bind on capture
    // so we close BEFORE the item's own handler fires (so e.g. the SAVE
    // toast doesn't appear while the menu is still open).
    wrap.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            // Defer close to next tick so the existing handler still sees
            // the click event flowing on its original target.
            setTimeout(close, 0);
        });
    });
}

// ---- Sidebar drawer toggle (used by both bed-details + plant-palette) ----
function _initDrawer({asideSelector, tabId, storageKey, defaultCollapsedAtWidth}) {
    const aside = document.querySelector(asideSelector);
    const tab = document.getElementById(tabId);
    if (!aside || !tab) return;

    const saved = localStorage.getItem(storageKey);
    let collapsed = saved === null ? (window.innerWidth < defaultCollapsedAtWidth) : saved === 'true';

    function apply() {
        aside.classList.toggle('drawer-collapsed', collapsed);
        tab.setAttribute('aria-expanded', String(!collapsed));
        try { localStorage.setItem(storageKey, String(collapsed)); } catch (e) {}
    }
    apply();

    tab.addEventListener('click', () => {
        collapsed = !collapsed;
        apply();
    });
}

function _initBedDetailsDrawer() {
    _initDrawer({
        asideSelector: '.bed-details',
        tabId: 'bed-details-drawer-tab',
        storageKey: 'gardensync.bedDetailsCollapsed',
        defaultCollapsedAtWidth: 1100
    });
}

function _initPlantPaletteDrawer() {
    _initDrawer({
        asideSelector: '.plant-palette',
        tabId: 'plant-palette-drawer-tab',
        storageKey: 'gardensync.paletteCollapsed',
        defaultCollapsedAtWidth: 900
    });
}

// ---- Danger-zone confirmation: typed "CLEAR" before nuking the garden ----
function _wireClearAllSafety() {
    const btn = document.getElementById('btn-clear-all');
    if (!btn) return;

    // Replace the existing handler with one that requires typed confirmation.
    // The old handler in toolbar-buttons.js used a plain confirm() — we now
    // own the click flow.
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _showClearAllConfirm();
    });
}

function _showClearAllConfirm() {
    if (document.getElementById('clear-all-confirm-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'clear-all-confirm-overlay';
    overlay.className = 'confirm-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';

    const heading = document.createElement('h3');
    heading.textContent = '⚠️ CLEAR ALL PLANTS';
    modal.appendChild(heading);

    const body = document.createElement('p');
    const totalPlants = state.containers.reduce((s, c) => s + c.plants.length, 0);
    body.textContent = `This will remove all ${totalPlants} plant${totalPlants !== 1 ? 's' : ''} from every bed. Containers stay; plants are gone. Type CLEAR to confirm.`;
    modal.appendChild(body);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'danger-confirm-input';
    input.placeholder = 'Type CLEAR';
    input.setAttribute('aria-label', 'Type CLEAR to confirm');
    input.autocomplete = 'off';
    modal.appendChild(input);

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    const yes = document.createElement('button');
    yes.className = 'tool-btn confirm-yes danger';
    yes.textContent = 'CLEAR ALL';
    yes.disabled = true;

    const no = document.createElement('button');
    no.className = 'tool-btn confirm-no';
    no.textContent = 'CANCEL';

    actions.appendChild(yes);
    actions.appendChild(no);
    modal.appendChild(actions);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 0);

    input.addEventListener('input', () => {
        yes.disabled = input.value.trim().toUpperCase() !== 'CLEAR';
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !yes.disabled) yes.click();
        if (e.key === 'Escape') overlay.remove();
    });

    yes.addEventListener('click', () => {
        if (typeof pushUndo === 'function') pushUndo();
        state.containers.forEach(c => { c.plants = []; });
        if (typeof renderAllContainers === 'function') renderAllContainers();
        if (typeof updateBedDetails === 'function') updateBedDetails();
        if (typeof updateStatsDashboard === 'function') updateStatsDashboard();
        if (typeof saveState === 'function') saveState();
        if (typeof showToast === 'function') showToast('All plants cleared. Undo with Ctrl+Z.');
        overlay.remove();
    });
    no.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ---- Init orchestrator (wired into init.js after toolbar buttons) ----
function initToolbarMenus() {
    _initMenu('file-menu', 'btn-file-menu');
    _initBedDetailsDrawer();
    _initPlantPaletteDrawer();
    _wireClearAllSafety();
}

window.initToolbarMenus = initToolbarMenus;
