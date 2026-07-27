/* GardenSync — AI Garden Visualizer (Gemini) */

function initVisualizer() {
    const keyInput = document.getElementById('gemini-key');
    if (state.geminiKey) keyInput.value = state.geminiKey;

    document.getElementById('btn-save-key').addEventListener('click', () => {
        state.geminiKey = keyInput.value.trim();
        localStorage.setItem('gardensync_gemini_key', state.geminiKey);
        showToast('API key saved!');
    });

    document.getElementById('btn-generate-viz').addEventListener('click', generateVisualization);
}

function generateVisualization() {
    const key = document.getElementById('gemini-key').value.trim() || state.geminiKey;
    if (!key) {
        showVizStatus('Please enter your Gemini API key first.', 'error');
        return;
    }
    state.geminiKey = key;
    localStorage.setItem('gardensync_gemini_key', key);

    const bedSelect = document.getElementById('viz-bed-select').value;

    // Gather plant data for prompt
    let plantDescription = '';
    if (bedSelect === 'all') {
        state.containers.forEach(container => {
            if (container.plants.length === 0) return;
            const counts = {};
            container.plants.forEach(p => { counts[p.plantId] = (counts[p.plantId] || 0) + 1; });
            const cType = CONTAINER_TYPES[container.type] || CONTAINER_TYPES['raised-bed'];
            const dimStr = cType.shape === 'circle'
                ? `${container.diameter || cType.defaultDiameter}' dia`
                : `${container.w || cType.defaultW}'x${container.h || cType.defaultH}'`;
            const plantList = Object.entries(counts).map(([pid, count]) => {
                const plant = PLANT_LIBRARY.find(pl => pl.id === pid);
                return plant ? `${count}x ${plant.name}` : `${count}x unknown`;
            }).join(', ');
            plantDescription += `${container.name} (${dimStr}): ${plantList}\n`;
        });
    } else {
        // bedSelect is a container id or index
        const container = getContainer(bedSelect) || state.containers[parseInt(bedSelect)];
        if (!container || container.plants.length === 0) {
            showVizStatus('Selected container is empty. Add plants first!', 'error');
            return;
        }
        const counts = {};
        container.plants.forEach(p => { counts[p.plantId] = (counts[p.plantId] || 0) + 1; });
        const cType = CONTAINER_TYPES[container.type] || CONTAINER_TYPES['raised-bed'];
        const dimStr = cType.shape === 'circle'
            ? `${container.diameter || cType.defaultDiameter}' dia`
            : `${container.w || cType.defaultW}'x${container.h || cType.defaultH}'`;
        const plantList = Object.entries(counts).map(([pid, count]) => {
            const plant = PLANT_LIBRARY.find(pl => pl.id === pid);
            return plant ? `${count}x ${plant.name}` : `${count}x unknown`;
        }).join(', ');
        plantDescription = `${container.name} (${dimStr}): ${plantList}`;
    }

    if (!plantDescription.trim()) {
        showVizStatus('No plants placed! Use the Bed Planner first.', 'error');
        return;
    }

    // Generate prompts for multiple angles
    const baseContext = `A community garden in Canton, Ohio. Raised garden beds made of weathered wood, various sizes. The garden is in a backyard space. The plants are healthy and at peak growing season (mid-summer). Natural sunlight, realistic gardening scene. Organic, lived-in feel with mulch paths between beds.`;

    const prompts = [
        {
            label: 'BIRD\'S EYE VIEW (Top-Down)',
            prompt: `Top-down aerial view looking straight down at a community garden. ${baseContext} The beds contain: ${plantDescription}. Show each plant species in its correct position and spacing. Detailed botanical accuracy. Photorealistic style. Rich earth tones and vibrant greens.`
        },
        {
            label: 'PERSPECTIVE VIEW (Garden Overview)',
            prompt: `Wide-angle perspective view of a community garden at eye level, standing at the path entrance looking across all four raised beds. ${baseContext} The beds contain: ${plantDescription}. Show the full layout with pathways between beds, a small shed or tool rack in background. Warm golden hour lighting. Photorealistic community garden photography style.`
        },
        {
            label: 'CLOSE-UP DETAIL',
            prompt: `Close-up detail shot of raised garden bed plants at a slight angle, showing the textures and details of the plants. ${baseContext} Focus on: ${plantDescription}. Show companion planting arrangements, mulched soil surface, wooden bed edges. Macro photography style with shallow depth of field. Morning dew on leaves.`
        },
        {
            label: 'GARDEN AT HARVEST TIME',
            prompt: `A community garden during peak harvest with ripe vegetables and flowers. ${baseContext} The beds contain: ${plantDescription}. Show ripe tomatoes, full bean plants, blooming flowers, ready-to-pick produce. A woven basket sits at the edge of a bed partially filled with fresh vegetables. Warm afternoon light. Inviting and abundant. the community garden mutual aid spirit.`
        }
    ];

    // Show prompts
    const promptList = document.getElementById('viz-prompt-list');
    promptList.innerHTML = prompts.map(p => `
        <div class="viz-prompt-item">
            <span class="viz-prompt-label">${p.label}</span>
            ${p.prompt}
        </div>
    `).join('');
    document.getElementById('viz-prompts').classList.remove('hidden');

    showVizStatus('Generating images with Gemini... This may take a moment per image.', 'loading');

    // Generate all images
    generateAllImages(prompts, key);
}

async function generateAllImages(prompts, apiKey) {
    const gallery = document.getElementById('viz-images');
    gallery.innerHTML = '';
    document.getElementById('viz-gallery').classList.remove('hidden');

    let successCount = 0;

    for (const promptData of prompts) {
        const card = document.createElement('div');
        card.className = 'viz-image-card';
        card.innerHTML = `
            <div style="height:250px;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);color:var(--text-muted);font-family:var(--font-mono);font-size:0.75rem;">
                Generating ${promptData.label}...
            </div>
            <div class="viz-image-label">${promptData.label}</div>
        `;
        gallery.appendChild(card);

        try {
            const model = document.getElementById('viz-model-select').value;
            // Try proxy first (if running proxy.py), fall back to direct API
            const proxyUrl = `/api/gemini/v1beta/models/${model}:generateContent`;
            const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

            let response;
            const requestBody = JSON.stringify({
                contents: [{
                    parts: [{
                        text: promptData.prompt
                    }]
                }],
                generationConfig: {
                    responseModalities: ["TEXT", "IMAGE"]
                }
            });

            try {
                // Try proxy first
                response = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey
                    },
                    body: requestBody
                });
            } catch (proxyErr) {
                // Proxy not available, try direct (may fail due to CORS)
                response = await fetch(directUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey
                    },
                    body: requestBody
                });
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API error: ${response.status}`);
            }

            const data = await response.json();

            // Extract image from response
            let imageFound = false;
            if (data.candidates && data.candidates[0]?.content?.parts) {
                for (const part of data.candidates[0].content.parts) {
                    if (part.inlineData) {
                        const imgSrc = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        card.innerHTML = `
                            <img src="${imgSrc}" alt="${promptData.label}" loading="lazy" class="viz-enlargeable" title="Click to enlarge">
                            <div class="viz-image-label">${promptData.label}</div>
                        `;
                        card.querySelector('.viz-enlargeable').addEventListener('click', () => openImageLightbox(imgSrc, promptData.label));
                        imageFound = true;
                        successCount++;
                        break;
                    }
                }
            }

            if (!imageFound) {
                // Show text response if no image
                const textParts = data.candidates?.[0]?.content?.parts?.filter(p => p.text) || [];
                const textContent = textParts.map(p => p.text).join('\n');
                card.innerHTML = `
                    <div style="padding:1rem;color:var(--text-secondary);font-size:0.8rem;max-height:250px;overflow-y:auto;">
                        <p style="color:var(--amber);font-family:var(--font-mono);font-size:0.7rem;margin-bottom:0.5rem;">IMAGE NOT RETURNED - TEXT RESPONSE:</p>
                        <p>${textContent || 'No content returned'}</p>
                    </div>
                    <div class="viz-image-label">${promptData.label}</div>
                `;
            }

        } catch (err) {
            card.innerHTML = `
                <div style="padding:1rem;color:var(--red-accent);font-family:var(--font-mono);font-size:0.75rem;">
                    ERROR: ${err.message}
                </div>
                <div class="viz-image-label">${promptData.label} (FAILED)</div>
            `;
        }
    }

    if (successCount === prompts.length) {
        showVizStatus(`All ${successCount} images generated successfully!`, 'success');
    } else if (successCount > 0) {
        showVizStatus(`${successCount}/${prompts.length} images generated. Some may have failed.`, 'loading');
    } else {
        showVizStatus('Image generation failed. Check your API key and model selection. Ensure your API key has access to the selected model. Try gemini-2.5-flash-image if unsure.', 'error');
    }
}

function openImageLightbox(src, label) {
    // Remove existing lightbox if any
    document.getElementById('viz-lightbox')?.remove();
    const lb = document.createElement('div');
    lb.id = 'viz-lightbox';
    lb.className = 'viz-lightbox';
    lb.innerHTML = `
        <div class="viz-lightbox-backdrop"></div>
        <div class="viz-lightbox-content">
            <button class="viz-lightbox-close" title="Close">\u2715</button>
            <img src="${src}" alt="${label}">
            <div class="viz-lightbox-label">${label}</div>
        </div>
    `;
    document.body.appendChild(lb);
    lb.querySelector('.viz-lightbox-backdrop').addEventListener('click', () => lb.remove());
    lb.querySelector('.viz-lightbox-close').addEventListener('click', () => lb.remove());
    document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', esc); }
    });
}

function showVizStatus(msg, type) {
    const el = document.getElementById('viz-status');
    el.textContent = msg;
    el.className = 'viz-status ' + type;
    el.classList.remove('hidden');
}

// ---- CALENDAR EXPORT (.ics) ----
