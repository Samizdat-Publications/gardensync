/* GardenSync — Initialization Orchestrator */

// ---- INITIALIZATION ----
document.addEventListener('DOMContentLoaded', () => {
    const inits = [
        ['Navigation', initNavigation],
        ['CustomSeeds', initCustomSeeds],
        ['PlantPalette', initPlantPalette],
        ['GardenContainers', initGardenBeds],
        ['CanvasPan', initCanvasPan],
        ['SidebarResize', initSidebarResize],
        ['PaletteResize', initPaletteResize],
        ['SectionResize', initSectionResize],
        ['CanvasZoom', initCanvasZoom],
        ['ContainerShelf', initContainerShelf],
        ['ContainerSelector', initContainerSelector],
        ['QuickAdd', initQuickAdd],
        ['BedTemplates', initBedTemplates],
        ['ThemeToggle', initThemeToggle],
        ['ToolbarButtons', initToolbarButtons],
        ['Volunteers', initVolunteers],
        ['ClimateCharts', initClimateCharts],
        ['RainfallDeficit', initRainfallDeficitCalc],
        ['Visualizer', initVisualizer],
        ['BedJournal', initBedJournal],
        ['HarvestLog', initHarvestLog],
        ['HarvestGoals', initHarvestGoals],
        ['DataExportImport', initDataExportImport],
        ['BackupSystem', initBackupSystem],
        ['SupabaseSync', initSupabaseSync],
        ['KeyboardShortcuts', initKeyboardShortcuts],
        ['LoadSavedState', loadSavedState],
        ['ShareURL', initShareURL],
        ['Weather', initWeather],
        ['TasksToggle', initTasksToggle],
        ['TodayDashboard', updateTodayDashboard],
        ['GardenBuddy', initGardenBuddy],
    ];
    for (const [name, fn] of inits) {
        try { fn(); }
        catch (e) { console.error(`[GardenSync] init ${name} FAILED:`, e); }
    }
    // Flush any debounced saves before page unload
    window.addEventListener('beforeunload', () => {
        if (typeof flushSave === 'function') flushSave();
        if (typeof flushSync === 'function') flushSync();
    });
    // Also flush on tab hide (more reliable on mobile)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            if (typeof flushSave === 'function') flushSave();
            if (typeof flushSync === 'function') flushSync();
        }
    });

    console.log('[GardenSync] All init complete');
});

