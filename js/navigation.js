/* GardenSync — Navigation & Tab Switching */

// ---- NAVIGATION ----
function _doSwitchTab(tabName) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`.nav-btn[data-tab="${tabName}"]`).forEach(b => b.classList.add('active'));
    document.querySelectorAll(`.mobile-nav-btn[data-tab="${tabName}"]`).forEach(b => b.classList.add('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active', 'page-out', 'page-in'));
    const next = document.getElementById(`tab-${tabName}`);
    if (next) next.classList.add('active');
    if (tabName === 'schedule') updateSchedule();
    if (tabName === 'plantlog') renderPlantingLog('all');
    if (tabName === 'harvest') renderHarvestLog();
    if (tabName === 'volunteers') renderVolunteers();
    if (tabName === 'climate') { drawRainfallChart(); drawTempChart(); }
    // Close mobile panels when switching tabs
    closeMobilePanels();
    // Show/hide mobile bottom bar (only on planner tab)
    updateMobileBottomBar(tabName);
    return next;
}

function switchTab(tabName) {
    // Stage 2g — page-turn 3D transition. When the tweak is off, behave
    // exactly as before (instant swap). When on, fade the outgoing tab
    // first, then swap and fade the incoming tab in.
    if (!(state && state.tweaks && state.tweaks.pageTurn)) {
        _doSwitchTab(tabName);
        return;
    }
    const current = document.querySelector('.tab-content.active');
    if (!current || current.id === `tab-${tabName}`) {
        _doSwitchTab(tabName);
        return;
    }
    current.classList.add('page-out');
    setTimeout(() => {
        current.classList.remove('page-out');
        const next = _doSwitchTab(tabName);
        if (next) {
            next.classList.add('page-in');
            setTimeout(() => next.classList.remove('page-in'), 360);
        }
    }, 280);
}

function initNavigation() {
    // Desktop nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Mobile hamburger
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileNav = document.getElementById('mobile-nav');

    menuBtn.addEventListener('click', () => {
        menuBtn.classList.toggle('open');
        mobileNav.classList.toggle('hidden');
    });

    // Mobile nav buttons
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
            mobileNav.classList.add('hidden');
            menuBtn.classList.remove('open');
        });
    });

    // ---- MOBILE PANEL TOGGLES ----
    const paletteBtn = document.getElementById('mobile-toggle-palette');
    const detailsBtn = document.getElementById('mobile-toggle-details');
    const palette = document.querySelector('.plant-palette');
    const details = document.querySelector('.bed-details');

    if (paletteBtn && palette) {
        paletteBtn.addEventListener('click', () => {
            const isOpen = palette.classList.contains('mobile-open');
            closeMobilePanels();
            if (!isOpen) {
                palette.classList.add('mobile-open');
                paletteBtn.classList.add('active');
                showMobileBackdrop();
            }
        });
    }

    if (detailsBtn && details) {
        detailsBtn.addEventListener('click', () => {
            const isOpen = details.classList.contains('mobile-open');
            closeMobilePanels();
            if (!isOpen) {
                details.classList.add('mobile-open');
                detailsBtn.classList.add('active');
                showMobileBackdrop();
            }
        });
    }

    // ---- COLLAPSIBLE TODAY DASHBOARD (mobile) ----
    initMobileDashboardCollapse();
}

// ---- MOBILE BOTTOM BAR VISIBILITY ----
function updateMobileBottomBar(tabName) {
    const bar = document.getElementById('mobile-bottom-bar');
    if (!bar) return;
    // Only show bottom bar on the planner tab
    if (tabName === 'planner') {
        bar.style.display = '';
    } else {
        bar.style.display = 'none';
    }
}

// ---- COLLAPSIBLE TODAY DASHBOARD ----
function initMobileDashboardCollapse() {
    const dashboard = document.getElementById('today-dashboard');
    if (!dashboard) return;
    const header = dashboard.querySelector('.today-header');
    if (!header) return;

    // Start collapsed on mobile
    if (window.innerWidth <= 900) {
        dashboard.classList.add('mobile-collapsed');
    }

    header.addEventListener('click', (e) => {
        // Only toggle on mobile
        if (window.innerWidth > 900) return;
        dashboard.classList.toggle('mobile-collapsed');
    });
}

// ---- MOBILE PANEL HELPERS ----
function closeMobilePanels() {
    document.querySelector('.plant-palette')?.classList.remove('mobile-open');
    document.querySelector('.bed-details')?.classList.remove('mobile-open');
    document.getElementById('mobile-toggle-palette')?.classList.remove('active');
    document.getElementById('mobile-toggle-details')?.classList.remove('active');
    removeMobileBackdrop();
}

function showMobileBackdrop() {
    removeMobileBackdrop();
    const backdrop = document.createElement('div');
    backdrop.className = 'mobile-panel-backdrop';
    backdrop.addEventListener('click', closeMobilePanels);
    document.body.appendChild(backdrop);
}

function removeMobileBackdrop() {
    document.querySelectorAll('.mobile-panel-backdrop').forEach(el => el.remove());
}
