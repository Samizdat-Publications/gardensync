/* GardenSync — Garden Buddy AI Assistant (Claude) */

let gbConversation = [];   // [{role, content}] for Claude Messages API
let gbDisplayLog = [];     // [{role, text, isAction}] for UI replay on reload
let gbClaudeKey = localStorage.getItem('gardensync_claude_key') || '';
let gbProcessing = false;
let gbTotalTokensIn = 0;
let gbTotalTokensOut = 0;
let gbPendingImage = null;  // { base64, mediaType, fileName }

function gbSaveState() {
    try {
        localStorage.setItem('gardensync_gb_conversation', safeStringify(gbConversation));
        localStorage.setItem('gardensync_gb_display', safeStringify(gbDisplayLog));
    } catch (e) { /* storage full \u2014 silently fail */ }
}

function gbClearConversation() {
    gbConversation = [];
    gbDisplayLog = [];
    gbTotalTokensIn = 0;
    gbTotalTokensOut = 0;
    localStorage.removeItem('gardensync_gb_conversation');
    localStorage.removeItem('gardensync_gb_display');
    const container = document.getElementById('gb-messages');
    if (container) {
        container.innerHTML = '';
        gbShowWelcome();
    }
    gbUpdateTokenDisplay();
}

const GB_TOOLS = [
    {
        name: 'place_plant',
        description: 'Place a plant in a garden container. If x/y are omitted, auto-finds the next open spot.',
        input_schema: {
            type: 'object',
            properties: {
                bedIndex: { type: 'integer', description: 'Container index (0-based)' },
                plantId: { type: 'string', description: 'Plant ID from the library (e.g. "tomato", "basil", "green-beans")' },
                count: { type: 'integer', description: 'Number of plants to place (default 1)' },
            },
            required: ['bedIndex', 'plantId']
        }
    },
    {
        name: 'clear_bed',
        description: 'Remove all plants from a garden container.',
        input_schema: {
            type: 'object',
            properties: {
                bedIndex: { type: 'integer', description: 'Container index (0-based)' }
            },
            required: ['bedIndex']
        }
    },
    {
        name: 'apply_template',
        description: 'Apply a pre-made garden template to a container. Available templates: Salsa Garden, Pizza Garden, Three Sisters, Salad Bowl, Pollinator Patch, Herb Haven, Root Cellar.',
        input_schema: {
            type: 'object',
            properties: {
                bedIndex: { type: 'integer', description: 'Container index (0-based)' },
                templateName: { type: 'string', description: 'Template name (e.g. "Three Sisters", "Salsa Garden")' }
            },
            required: ['bedIndex', 'templateName']
        }
    },
    {
        name: 'get_garden_state',
        description: 'Get the current state of all garden containers including what plants are placed where.',
        input_schema: { type: 'object', properties: {} }
    },
    {
        name: 'get_plant_info',
        description: 'Look up detailed information about a plant from the library.',
        input_schema: {
            type: 'object',
            properties: {
                plantId: { type: 'string', description: 'Plant ID (e.g. "tomato", "green-beans")' }
            },
            required: ['plantId']
        }
    },
    {
        name: 'list_plants',
        description: 'List all available plants in the library with their IDs, names, and types.',
        input_schema: { type: 'object', properties: {} }
    },
    {
        name: 'rename_bed',
        description: 'Rename a garden container.',
        input_schema: {
            type: 'object',
            properties: {
                bedIndex: { type: 'integer', description: 'Container index (0-based)' },
                name: { type: 'string', description: 'New name for the container' }
            },
            required: ['bedIndex', 'name']
        }
    },
    {
        name: 'get_schedule_advice',
        description: 'Get planting schedule advice for the current date based on Canton OH Zone 6a frost dates.',
        input_schema: { type: 'object', properties: {} }
    },
    {
        name: 'organize_bed',
        description: 'Auto-organize a single garden container using Square Foot Gardening grid spacing. Only affects the specified container, not others.',
        input_schema: {
            type: 'object',
            properties: {
                bedIndex: { type: 'integer', description: 'Container index (0-based)' }
            },
            required: ['bedIndex']
        }
    },
    {
        name: 'remove_plants',
        description: 'Remove all instances of a specific plant type from a container. Use when the user wants to take out just one kind of plant, not clear the whole bed.',
        input_schema: {
            type: 'object',
            properties: {
                bedIndex: { type: 'integer', description: 'Container index (0-based)' },
                plantId: { type: 'string', description: 'Plant ID to remove (e.g. "tomato")' }
            },
            required: ['bedIndex', 'plantId']
        }
    }
];

function gbExecuteTool(toolName, toolInput) {
    switch (toolName) {
        case 'place_plant': {
            const { bedIndex, plantId, count = 1 } = toolInput;
            if (bedIndex < 0 || bedIndex >= state.containers.length) return { error: `Container index must be 0-${state.containers.length - 1}` };
            const container = state.containers[bedIndex];
            const plant = PLANT_LIBRARY.find(p => p.id === plantId);
            if (!plant) return { error: `Plant "${plantId}" not found. Use list_plants to see available plants.` };
            pushUndo();
            let placed = 0;
            const bedEl = document.querySelector(`.garden-bed[data-container-id="${container.id}"]`);
            const bedW = bedEl ? bedEl.offsetWidth : 400;
            const bedH = bedEl ? bedEl.offsetHeight : 220;
            for (let i = 0; i < count; i++) {
                const x = Math.random() * (bedW - 40) + 2;
                const y = Math.random() * (bedH - 40) + 2;
                placePlant(container.id, plantId, x, y);
                placed++;
            }
            autoOrganizeBed(container.id);
            return { success: true, placed, plantName: plant.name, bedName: container.name };
        }
        case 'clear_bed': {
            const { bedIndex } = toolInput;
            if (bedIndex < 0 || bedIndex >= state.containers.length) return { error: `Container index must be 0-${state.containers.length - 1}` };
            const container = state.containers[bedIndex];
            const count = container.plants.length;
            pushUndo();
            container.plants = [];
            renderPlacedPlants(container.id);
            updateBedDetails();
            saveState();
            return { success: true, cleared: count, bedName: container.name };
        }
        case 'apply_template': {
            const { bedIndex, templateName } = toolInput;
            if (bedIndex < 0 || bedIndex >= state.containers.length) return { error: `Container index must be 0-${state.containers.length - 1}` };
            const container = state.containers[bedIndex];
            const template = BED_TEMPLATES.find(t => t.name.toLowerCase() === templateName.toLowerCase());
            if (!template) return { error: `Template "${templateName}" not found. Available: ${BED_TEMPLATES.map(t => t.name).join(', ')}` };
            applyBedTemplate(container.id, template);
            return { success: true, templateName: template.name, bedName: container.name, description: template.desc };
        }
        case 'get_garden_state': {
            const containers = state.containers.map((container, i) => {
                const counts = {};
                container.plants.forEach(p => {
                    const plant = PLANT_LIBRARY.find(pl => pl.id === p.plantId);
                    const name = plant ? plant.name : p.plantId;
                    counts[name] = (counts[name] || 0) + 1;
                });
                return { bed: i + 1, name: container.name, type: container.type, totalPlants: container.plants.length, plants: counts };
            });
            return { beds: containers, totalPlants: state.containers.reduce((s, c) => s + c.plants.length, 0) };
        }
        case 'get_plant_info': {
            const plant = PLANT_LIBRARY.find(p => p.id === toolInput.plantId);
            if (!plant) return { error: `Plant "${toolInput.plantId}" not found.` };
            return {
                id: plant.id, name: plant.name, emoji: plant.emoji, type: plant.type,
                spacing: plant.spacing + ' inches', daysToHarvest: plant.daysToHarvest,
                waterNeed: plant.waterNeed, sunNeed: plant.sunNeed,
                companions: plant.companions, enemies: plant.enemies,
                notes: plant.notes
            };
        }
        case 'list_plants': {
            return { plants: PLANT_LIBRARY.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, type: p.type })) };
        }
        case 'rename_bed': {
            const { bedIndex, name } = toolInput;
            if (bedIndex < 0 || bedIndex >= state.containers.length) return { error: `Container index must be 0-${state.containers.length - 1}` };
            const container = state.containers[bedIndex];
            container.name = name;
            saveState();
            const bedEl = document.querySelector(`.garden-bed[data-container-id="${container.id}"]`);
            if (bedEl) {
                const lbl = bedEl.querySelector('.bed-label');
                if (lbl) lbl.textContent = name;
            }
            updateContainerSelector();
            return { success: true, bedIndex, newName: name };
        }
        case 'organize_bed': {
            const { bedIndex } = toolInput;
            if (bedIndex < 0 || bedIndex >= state.containers.length) return { error: `Container index must be 0-${state.containers.length - 1}` };
            const container = state.containers[bedIndex];
            const plantCount = container.plants.length;
            if (plantCount === 0) return { error: 'No plants in this container to organize.' };
            pushUndo();
            autoOrganizeBed(container.id);
            return { success: true, organized: plantCount, bedName: container.name };
        }
        case 'get_schedule_advice': {
            const now = new Date();
            const month = now.getMonth();
            const day = now.getDate();
            const lastFrost = new Date(now.getFullYear(), 3, 18); // April 18
            const firstFrost = new Date(now.getFullYear(), 9, 28); // October 28
            const daysToLastFrost = Math.ceil((lastFrost - now) / 86400000);
            const daysToFirstFrost = Math.ceil((firstFrost - now) / 86400000);
            const plantable = PLANT_LIBRARY.filter(p => {
                if (!p.sowIndoors && !p.directSow && p.transplantAfterFrost === undefined) return false;
                const sowDate = new Date(lastFrost);
                if (p.sowIndoors) sowDate.setDate(sowDate.getDate() + (p.sowIndoors * 7));
                const endDate = new Date(firstFrost);
                endDate.setDate(endDate.getDate() - p.daysToHarvest);
                return now >= new Date(sowDate.getTime() - 14 * 86400000) && now <= endDate;
            }).map(p => p.name);
            return {
                currentDate: now.toLocaleDateString(),
                daysToLastFrost: daysToLastFrost > 0 ? daysToLastFrost : 'already passed',
                daysToFirstFrost: daysToFirstFrost > 0 ? daysToFirstFrost : 'already passed',
                zone: '6a', location: 'Canton, OH',
                plantableNow: plantable.length > 0 ? plantable : ['Check specific plants - timing may vary']
            };
        }
        case 'remove_plants': {
            const { bedIndex, plantId } = toolInput;
            if (bedIndex < 0 || bedIndex >= state.containers.length) return { error: `Container index must be 0-${state.containers.length - 1}` };
            const container = state.containers[bedIndex];
            const plant = PLANT_LIBRARY.find(p => p.id === plantId);
            if (!plant) return { error: `Plant "${plantId}" not found. Use list_plants to see available plants.` };
            const before = container.plants.length;
            pushUndo();
            container.plants = container.plants.filter(p => p.plantId !== plantId);
            const removed = before - container.plants.length;
            if (removed === 0) return { error: `No ${plant.name} found in ${container.name}.` };
            renderPlacedPlants(container.id);
            updateBedDetails();
            saveState();
            return { success: true, removed, plantName: plant.name, bedName: container.name };
        }
        default:
            return { error: `Unknown tool: ${toolName}` };
    }
}

function gbBuildSystemPrompt() {
    const bedSummary = state.containers.map((container, i) => {
        const cType = CONTAINER_TYPES[container.type] || CONTAINER_TYPES['raised-bed'];
        const typeLabel = cType.label || container.type;
        if (container.plants.length === 0) return `  Container ${i + 1} (${container.name}, ${typeLabel}): empty`;
        const counts = {};
        container.plants.forEach(p => { counts[p.plantId] = (counts[p.plantId] || 0) + 1; });
        const items = Object.entries(counts).map(([id, n]) => {
            const pl = PLANT_LIBRARY.find(p => p.id === id);
            return `${pl ? pl.name : id} x${n}`;
        }).join(', ');
        return `  Container ${i + 1} (${container.name}, ${typeLabel}): ${container.plants.length} plants \u2014 ${items}`;
    }).join('\n');

    return `You are Garden Buddy, the AI assistant built into GardenSync — a community garden planner for Food Not Bombs Canton, OH (USDA Zone 6a). You can directly control the garden through tools — placing plants, clearing beds, organizing layouts, and more.

CURRENT GARDEN STATE:
${bedSummary}
Total containers: ${state.containers.length}

LOCATION: Canton, OH — Zone 6a
FROST DATES: Last frost April 18, First frost October 28, Growing season 193 days
TODAY: ${new Date().toLocaleDateString()}

AVAILABLE TEMPLATES: ${BED_TEMPLATES.map(t => t.name).join(', ')}

YOUR TOOLS — you can take real actions on the garden:
- place_plant(bedIndex, plantId, count) — Add plants to a container. They auto-space using SFG grid. Use count to place multiples at once.
- remove_plants(bedIndex, plantId) — Remove all instances of a specific plant type from a container. Use when user wants to take out just one kind of plant.
- clear_bed(bedIndex) — Remove ALL plants from a container. Use when user wants to start fresh or empty a whole bed.
- apply_template(bedIndex, templateName) — Apply a pre-made garden layout (clears existing plants first).
- get_garden_state() — See what's currently planted in every container. Call this if you need to check before taking action.
- get_plant_info(plantId) — Look up spacing, companions, enemies, water/sun needs, days to harvest.
- list_plants() — Get all available plant IDs. Call this when you don't know the exact ID for a plant.
- rename_bed(bedIndex, name) — Change a container's display name.
- organize_bed(bedIndex) — Re-space plants in a container using Square Foot Gardening grid. Only affects the one container.
- get_schedule_advice() — Zone 6a planting calendar based on today's date.

CONTAINER MATCHING:
- Container numbers are 1-indexed for users but 0-indexed in tools. "Container 1" or "the first bed" = bedIndex 0.
- Match containers by NAME or TYPE when the user refers to them descriptively:
  - "the wooden planters" → find containers with type "planter"
  - "the raised bed" → find containers with type "raised-bed"
  - "the round pots" → find containers with type "pot-round"
  - "the grow bags" → find containers with type "grow-bag"
  - "Main Veggie Bed" → match by container name
- When multiple containers match (e.g. "the two pots"), make SEPARATE tool calls for EACH matching container. You can call the same tool multiple times in one response.

PLANT ID RESOLUTION:
- Map natural language to plant IDs: "tomatoes" → "tomato", "beans"/"green beans" → "green-beans", "peppers"/"bell pepper" → "bell-pepper", "lettuce" → "lettuce", "carrots" → "carrot", "herbs" → ask which herbs or suggest basil, cilantro, parsley, etc.
- If unsure of the exact plant ID, call list_plants first to see all available options.
- For vague requests like "fill with herbs" or "add some veggies", suggest specific plants and confirm before placing.

IMAGE HANDLING:
- When the user sends a photo, analyze it: identify plants, read seed packet info, assess garden conditions.
- Offer to take action based on what you see (e.g. "I see a tomato seed packet — want me to add tomatoes to a bed?").
- Be specific about what you observe in the image.

GUIDELINES:
- Be friendly, casual, and encouraging. You're a garden buddy, not a textbook.
- Keep responses short — 2-3 sentences for actions. More detailed for advice or planning questions.
- After placing plants or making changes, briefly confirm what you did.
- When a request involves multiple containers, handle them all in one turn with multiple tool calls.
- If unsure what the user wants, ask a quick clarifying question rather than guessing wrong.
- For gardening advice, draw on Zone 6a best practices and frost date timing.`;
}

function gbShowWelcome() {
    const totalPlants = state.containers.reduce((sum, c) => sum + c.plants.length, 0);
    let greeting = `Hey! I'm <strong>Garden Buddy</strong>, your AI garden assistant. `;
    if (totalPlants > 0) {
        greeting += `You've got <strong>${totalPlants} plant${totalPlants !== 1 ? 's' : ''}</strong> across your containers right now. `;
        greeting += `I can help you rearrange, fill gaps, or plan what to add next.<br><br>`;
    } else {
        greeting += `I can help you plan containers, place plants, apply templates, and answer gardening questions.<br><br>`;
    }
    greeting += `Try saying:<br>`;
    greeting += `<em>"Plant tomatoes in Main Veggie Bed"</em><br>`;
    greeting += `<em>"Set up a Three Sisters garden"</em><br>`;
    greeting += `<em>"What should I plant this time of year?"</em>`;
    if (!gbClaudeKey) greeting += `<br><br>Enter your Claude API key above to get started!`;
    gbAddMessage('bot', greeting);
}

function gbUpdateTokenDisplay() {
    const el = document.getElementById('gb-token-display');
    if (!el) return;
    if (gbTotalTokensIn === 0 && gbTotalTokensOut === 0) {
        el.textContent = '';
        return;
    }
    const total = gbTotalTokensIn + gbTotalTokensOut;
    el.textContent = `${total.toLocaleString()} tokens`;
    el.title = `In: ${gbTotalTokensIn.toLocaleString()} / Out: ${gbTotalTokensOut.toLocaleString()}`;
}

function gbAddMessage(role, text, isAction = false, skipLog = false) {
    const container = document.getElementById('gb-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `gb-msg ${isAction ? 'gb-msg-action' : role === 'user' ? 'gb-msg-user' : 'gb-msg-bot'}`;
    div.innerHTML = `<div class="gb-msg-text">${text}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    if (!skipLog) {
        gbDisplayLog.push({ role, text, isAction });
    }
}

function gbShowTyping() {
    const container = document.getElementById('gb-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'gb-typing';
    div.id = 'gb-typing-indicator';
    div.innerHTML = '<div class="gb-typing-dot"></div><div class="gb-typing-dot"></div><div class="gb-typing-dot"></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function gbHideTyping() {
    document.getElementById('gb-typing-indicator')?.remove();
}

async function gbSendMessage() {
    if (gbProcessing) return;
    const input = document.getElementById('gb-input');
    const text = input.value.trim();
    const hasImage = !!gbPendingImage;
    if (!text && !hasImage) return;

    if (!gbClaudeKey) {
        gbAddMessage('bot', 'Please enter your Claude API key above to get started!');
        return;
    }

    input.value = '';
    input.style.height = 'auto';

    // Build display message
    const safeText = text ? text.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    const imgLabel = hasImage ? '<span style="opacity:0.6;font-size:0.7rem">&#x1F4F7; Image attached</span><br>' : '';
    gbAddMessage('user', imgLabel + safeText);

    // Build API content
    let content;
    if (hasImage) {
        content = [];
        content.push({
            type: 'image',
            source: { type: 'base64', media_type: gbPendingImage.mediaType, data: gbPendingImage.base64 }
        });
        content.push({ type: 'text', text: text || 'What do you see in this image?' });
        // Clear image state
        gbPendingImage = null;
        gbClearImagePreview();
    } else {
        content = text;
    }

    gbConversation.push({ role: 'user', content });
    gbProcessing = true;
    document.getElementById('gb-send').disabled = true;
    gbShowTyping();

    try {
        await gbCallClaude();
    } catch (err) {
        gbHideTyping();
        gbAddMessage('bot', `Sorry, something went wrong: ${err.message}`);
        console.error('[GardenBuddy] Error:', err);
    }

    gbProcessing = false;
    document.getElementById('gb-send').disabled = false;
    gbSaveState();
}

function gbClearImagePreview() {
    gbPendingImage = null;
    const preview = document.getElementById('gb-image-preview');
    if (preview) {
        preview.innerHTML = '';
        preview.classList.add('hidden');
    }
    // Reset file input so same file can be re-selected
    const fileInput = document.getElementById('gb-image-input');
    if (fileInput) fileInput.value = '';
}

function gbShowImagePreview(file, base64Data) {
    const preview = document.getElementById('gb-image-preview');
    if (!preview) return;
    preview.innerHTML = `
        <div class="gb-image-thumb-wrap">
            <img class="gb-image-thumb" src="data:${file.type};base64,${base64Data}" alt="Attached image">
            <button class="gb-image-remove" title="Remove image">&times;</button>
        </div>
        <span class="gb-image-label">${file.name}</span>
    `;
    preview.classList.remove('hidden');
    // Wire remove button
    preview.querySelector('.gb-image-remove').addEventListener('click', gbClearImagePreview);
}

async function gbCallClaude() {
    const maxLoops = 5;
    for (let loop = 0; loop < maxLoops; loop++) {
        const body = {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: gbBuildSystemPrompt(),
            messages: gbConversation,
            tools: GB_TOOLS
        };

        const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': gbClaudeKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: safeStringify(body)
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            const errMsg = errData?.error?.message || `API error ${resp.status}`;
            throw new Error(errMsg);
        }

        const data = await resp.json();
        gbHideTyping();

        // Track token usage
        if (data.usage) {
            gbTotalTokensIn += data.usage.input_tokens || 0;
            gbTotalTokensOut += data.usage.output_tokens || 0;
            gbUpdateTokenDisplay();
        }

        // Process response content blocks
        const assistantContent = data.content || [];
        gbConversation.push({ role: 'assistant', content: assistantContent });

        if (data.stop_reason === 'tool_use') {
            // Execute tool calls and build tool results
            const toolResults = [];
            for (const block of assistantContent) {
                if (block.type === 'tool_use') {
                    const result = gbExecuteTool(block.name, block.input);
                    // Show action message in chat
                    const actionMsg = gbFormatAction(block.name, block.input, result);
                    if (actionMsg) gbAddMessage('bot', actionMsg, true);

                    toolResults.push({
                        type: 'tool_result',
                        tool_use_id: block.id,
                        content: safeStringify(result)
                    });
                }
            }
            // Add tool results to conversation and loop
            gbConversation.push({ role: 'user', content: toolResults });
            gbShowTyping();
            continue;
        }

        // Extract text blocks and display
        const textParts = assistantContent
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('\n');

        if (textParts) {
            // Simple markdown-like formatting
            const formatted = textParts
                .replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
            gbAddMessage('bot', formatted);
        }
        break;
    }
}

function gbFormatAction(toolName, input, result) {
    if (result.error) return `\u26A0 ${result.error}`;
    switch (toolName) {
        case 'place_plant':
            return `\u2705 Placed ${result.placed}x ${result.plantName} in ${result.bedName} (auto-spaced)`;
        case 'clear_bed':
            return `\u{1F9F9} Cleared ${result.cleared} plants from ${result.bedName}`;
        case 'apply_template':
            return `\u2728 Applied "${result.templateName}" template to ${result.bedName}`;
        case 'rename_bed':
            return `\u270F\uFE0F Renamed Bed ${input.bedIndex + 1} to "${result.newName}"`;
        case 'organize_bed':
            return `\u2705 Auto-organized ${result.organized} plants in ${result.bedName} using SFG spacing`;
        case 'remove_plants':
            return `\u{1F5D1} Removed ${result.removed}x ${result.plantName} from ${result.bedName}`;
        default:
            return null;
    }
}

function initGardenBuddy() {
    const fab = document.getElementById('garden-buddy-fab');
    const panel = document.getElementById('garden-buddy-panel');
    const closeBtn = document.getElementById('gb-close');
    const clearBtn = document.getElementById('gb-clear');
    const saveKeyBtn = document.getElementById('gb-save-key');
    const keyInput = document.getElementById('gb-claude-key');
    const sendBtn = document.getElementById('gb-send');
    const inputEl = document.getElementById('gb-input');

    if (!fab || !panel) return;

    // Load saved key
    if (gbClaudeKey) {
        keyInput.value = gbClaudeKey;
        document.getElementById('gb-key-row').classList.add('saved');
    }

    // Restore chat history or show welcome
    const savedConvo = localStorage.getItem('gardensync_gb_conversation');
    const savedDisplay = localStorage.getItem('gardensync_gb_display');
    const container = document.getElementById('gb-messages');
    container.innerHTML = ''; // Clear static welcome HTML

    if (savedConvo && savedDisplay) {
        try {
            gbConversation = JSON.parse(savedConvo);
            gbDisplayLog = JSON.parse(savedDisplay);
            // Replay display log into UI
            for (const entry of gbDisplayLog) {
                gbAddMessage(entry.role, entry.text, entry.isAction, true);
            }
        } catch (e) {
            gbConversation = [];
            gbDisplayLog = [];
            gbShowWelcome();
        }
    } else {
        gbShowWelcome();
    }

    // FAB toggle
    fab.addEventListener('click', () => {
        const isHidden = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        fab.classList.toggle('active', !isHidden);
        if (isHidden) {
            inputEl.focus();
        }
    });

    // Close
    closeBtn.addEventListener('click', () => {
        panel.classList.add('hidden');
        fab.classList.remove('active');
    });

    // Clear conversation
    if (clearBtn) {
        clearBtn.addEventListener('click', gbClearConversation);
    }

    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !panel.classList.contains('hidden')) {
            panel.classList.add('hidden');
            fab.classList.remove('active');
        }
    });

    // Save API key
    saveKeyBtn.addEventListener('click', () => {
        const key = keyInput.value.trim();
        if (key) {
            gbClaudeKey = key;
            localStorage.setItem('gardensync_claude_key', key);
            document.getElementById('gb-key-row').classList.add('saved');
            gbAddMessage('bot', 'API key saved! How can I help with your garden today?');
            gbSaveState();
        }
    });

    // Show key row on double-click header
    const headerLeft = panel.querySelector('.gb-header-left');
    headerLeft.addEventListener('dblclick', () => {
        document.getElementById('gb-key-row').classList.remove('saved');
    });

    // Send message
    sendBtn.addEventListener('click', gbSendMessage);

    // Enter to send (Shift+Enter for newline)
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            gbSendMessage();
        }
    });

    // Auto-resize textarea
    inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
    });

    // Image attachment
    const attachBtn = document.getElementById('gb-attach');
    const imageInput = document.getElementById('gb-image-input');
    if (attachBtn && imageInput) {
        attachBtn.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                gbAddMessage('bot', 'Please select an image file (JPG, PNG, etc.).');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                gbAddMessage('bot', 'Image is too large (max 10 MB). Try a smaller photo.');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                // reader.result is "data:<type>;base64,<data>"
                const base64 = reader.result.split(',')[1];
                gbPendingImage = { base64, mediaType: file.type, fileName: file.name };
                gbShowImagePreview(file, base64);
            };
            reader.readAsDataURL(file);
        });
    }
}
