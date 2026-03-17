/* GardenSync — Bed Templates Init & Highlight */

function initBedTemplates() {
    const btn = document.getElementById('btn-bed-template');
    if (!btn) return;

    btn.addEventListener('click', () => {
        // Close existing dropdown if open
        const existing = document.querySelector('.template-dropdown');
        if (existing) { existing.remove(); return; }

        const dropdown = document.createElement('div');
        dropdown.className = 'template-dropdown';
        dropdown.innerHTML = `<div class="template-dropdown-title">BED TEMPLATES</div>` +
            BED_TEMPLATES.map((t, i) => `
                <div class="template-option" data-idx="${i}">
                    <span class="template-name">${t.name}</span>
                    <span class="template-desc">${t.desc}</span>
                </div>
            `).join('');

        // Position relative to button
        btn.style.position = 'relative';
        btn.parentElement.style.position = 'relative';
        btn.parentElement.appendChild(dropdown);

        // Handle clicks
        dropdown.addEventListener('click', (e) => {
            const opt = e.target.closest('.template-option');
            if (!opt) return;
            const idx = parseInt(opt.dataset.idx);
            const template = BED_TEMPLATES[idx];
            const container = getSelectedContainer();
            if (!container) return;
            const containerId = container.id;
            const bedHasPlants = container.plants.length > 0;

            const applyIt = () => {
                applyBedTemplate(containerId, template);
                container.name = template.name;
                saveState();
                const bedEl = document.querySelector(`.garden-bed[data-container-id="${containerId}"]`);
                if (bedEl) {
                    const lbl = bedEl.querySelector('.bed-label');
                    if (lbl) lbl.textContent = template.name;
                }
                updateContainerSelector();
                showToast(`${template.name} template applied to ${container.name}`);
                dropdown.remove();
            };

            if (bedHasPlants) {
                showConfirm('APPLY TEMPLATE', `Replace all plants in ${container.name} with "${template.name}" template?`, applyIt);
            } else {
                applyIt();
            }
        });

        // Close on outside click
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!dropdown.contains(e.target) && e.target !== btn) {
                    dropdown.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 10);
    });
}

function highlightActiveContainer(containerId) {
    document.querySelectorAll('.garden-bed').forEach(bed => {
        bed.classList.remove('active-highlight');
    });
    // Support both containerId string and legacy bedIndex number
    let container;
    if (typeof containerId === 'number') {
        container = state.containers[containerId];
    } else {
        container = getContainer(containerId);
    }
    if (!container) return;
    const bedEl = document.querySelector(`.garden-bed[data-container-id="${container.id}"]`);
    if (bedEl) {
        bedEl.classList.add('active-highlight');
        // Pan canvas to center the container in the viewport
        const viewport = document.getElementById('garden-viewport');
        if (viewport) {
            const vpW = viewport.clientWidth;
            const vpH = viewport.clientHeight;
            const dims = getContainerPixelDims(container);
            const needsBoost = dims.width < 100 || dims.height < 100;
            const bf = needsBoost ? 2 : 1;
            const w = Math.max(70, dims.width * bf);
            const h = Math.max(70, dims.height * bf);
            const cx = (container.canvasX || 0) + w / 2;
            const cy = (container.canvasY || 0) + h / 2;
            state.canvasOffsetX = vpW / 2 - cx * state.canvasZoom;
            state.canvasOffsetY = vpH / 2 - cy * state.canvasZoom;
            applyCanvasTransform();
        }
        setTimeout(() => bedEl.classList.remove('active-highlight'), 800);
    }
}
// Legacy alias
function highlightActiveBed(bedIndex) { highlightActiveContainer(bedIndex); }

