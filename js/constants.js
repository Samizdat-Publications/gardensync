/* GardenSync — Constants, Plant Data & Container Definitions */

// ---- PLANT LIBRARY (Zone 6a compatible) ----
let PLANT_LIBRARY = [
    // ---- VEGETABLES ----
    {
        id: 'tomato', name: 'Tomato', emoji: '\u{1F345}', type: 'vegetable',
        spacing: 24, daysToHarvest: 75, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: 2,
        directSow: null, harvestWeeks: 10,
        companions: ['basil', 'marigold', 'carrot', 'parsley', 'onion', 'garlic', 'chive', 'nasturtium', 'lettuce', 'spinach', 'borage'],
        enemies: ['cabbage', 'fennel', 'dill', 'potato', 'broccoli', 'kale'],
        notes: 'Stake or cage. Indeterminate types produce all season.',
        seedStartInstructions: 'Start seeds indoors 6-8 weeks before last frost (Mar 1-7). Use seed starting mix, 1/4" deep. Keep at 70-80\u00B0F. Transplant out after May 1 when soil is 60\u00B0F+.',
        careNotes: 'Water deeply 1-2x/week. Mulch heavily. Remove suckers for determinate types. Side-dress with compost mid-season.',
        lowMaintenance: true
    },
    {
        id: 'cucumber', name: 'Cucumber', emoji: '\u{1F952}', type: 'vegetable',
        spacing: 18, daysToHarvest: 60, waterNeed: 'high',
        sunNeed: 'full', sowIndoors: -3, transplantAfterFrost: 2,
        directSow: 2, harvestWeeks: 8,
        companions: ['green-beans', 'peas', 'lettuce', 'sunflower', 'radish', 'dill', 'marigold', 'nasturtium', 'corn', 'borage'],
        enemies: ['potato', 'sage', 'cantaloupe', 'rosemary'],
        notes: 'Can trellis vertically to save space. Pick frequently.',
        seedStartInstructions: 'Start indoors 3-4 weeks before last frost (Mar 21-28) OR direct sow after May 1. Plant 1" deep. Needs 70\u00B0F soil.',
        careNotes: 'Needs consistent moisture. Trellis to save space & improve air flow. Pick daily once producing.',
        lowMaintenance: false
    },
    {
        id: 'lettuce', name: 'Lettuce', emoji: '\u{1F96C}', type: 'vegetable',
        spacing: 8, daysToHarvest: 45, waterNeed: 'medium',
        sunNeed: 'partial', sowIndoors: -4, transplantAfterFrost: -2,
        directSow: -2, harvestWeeks: 6,
        companions: ['carrot', 'radish', 'strawberry', 'chive', 'onion', 'garlic', 'green-beans', 'peas', 'spinach', 'dill'],
        enemies: [],
        notes: 'Cool season crop. Succession plant every 2 weeks. Bolts in heat.',
        seedStartInstructions: 'Start indoors mid-March or direct sow as early as April 1. Surface sow (needs light). Succession plant every 2 weeks through May, resume in Aug.',
        careNotes: 'Keep soil consistently moist. Shade cloth in summer. Harvest outer leaves for continuous production.',
        lowMaintenance: true
    },
    {
        id: 'spinach', name: 'Spinach', emoji: '\u{1F343}', type: 'vegetable',
        spacing: 6, daysToHarvest: 40, waterNeed: 'medium',
        sunNeed: 'partial', sowIndoors: null, transplantAfterFrost: null,
        directSow: -4, harvestWeeks: 4,
        companions: ['strawberry', 'peas', 'green-beans', 'lettuce', 'radish', 'kale'],
        enemies: ['potato'],
        notes: 'Very cold-hardy. One of the first crops to plant. Bolts fast in heat.',
        seedStartInstructions: 'Direct sow 4-6 weeks before last frost (Mar 7-21). Plant 1/2" deep, 1" apart, thin to 6". Can also fall sow in September.',
        careNotes: 'Keep cool & moist. Mulch to retain moisture. Harvest outer leaves. Plant again in fall.',
        lowMaintenance: true
    },
    {
        id: 'green-beans', name: 'Green Beans', emoji: '\u{1FAD8}', type: 'vegetable',
        spacing: 6, daysToHarvest: 55, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 1, harvestWeeks: 6,
        companions: ['corn', 'zucchini', 'cucumber', 'strawberry', 'marigold', 'radish', 'nasturtium', 'carrot', 'lettuce', 'eggplant', 'potato', 'borage'],
        enemies: ['onion', 'garlic', 'fennel', 'chive'],
        notes: 'Nitrogen fixer. Bush types need no support. Very productive.',
        seedStartInstructions: 'Direct sow 1 week after last frost (Apr 25-May 1). Plant 1" deep, 6" apart. Soil must be 60\u00B0F+. Do NOT start indoors \u2014 beans hate transplanting.',
        careNotes: 'Minimal care once established. Water during drought only. Pick regularly to encourage production. Bush types are lowest maintenance.',
        lowMaintenance: true
    },
    {
        id: 'pepper', name: 'Bell Pepper', emoji: '\u{1F336}', type: 'vegetable',
        spacing: 18, daysToHarvest: 70, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -8, transplantAfterFrost: 2,
        directSow: null, harvestWeeks: 10,
        companions: ['tomato', 'basil', 'carrot', 'marigold', 'onion', 'garlic', 'oregano', 'parsley', 'spinach', 'lettuce'],
        enemies: ['fennel', 'kohlrabi'],
        notes: 'Slow to start. Needs warm soil. Very productive once going.',
        seedStartInstructions: 'Start indoors 8-10 weeks before last frost (Feb 15-Mar 1). Needs warmth (75-85\u00B0F) for germination. Slow grower. Harden off carefully. Transplant after May 1.',
        careNotes: 'Mulch well. Stake if heavy with fruit. Water consistently. Pick green or let ripen to red for more sweetness.',
        lowMaintenance: true
    },
    {
        id: 'zucchini', name: 'Zucchini', emoji: '\u{1F95C}', type: 'vegetable',
        spacing: 24, daysToHarvest: 50, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -3, transplantAfterFrost: 1,
        directSow: 1, harvestWeeks: 10,
        companions: ['corn', 'green-beans', 'marigold', 'nasturtium', 'dill', 'radish', 'sunflower', 'borage'],
        enemies: ['potato'],
        notes: 'Incredibly productive. One plant feeds many. Pick small.',
        seedStartInstructions: 'Start indoors 3-4 weeks before last frost (Mar 28) or direct sow 1 week after (Apr 25). Plant 1" deep. Germinates fast in warm soil.',
        careNotes: 'Water at base to prevent powdery mildew. Harvest at 6-8" for best flavor. Check daily \u2014 they grow FAST.',
        lowMaintenance: true
    },
    {
        id: 'radish', name: 'Radish', emoji: '\u{1F4AE}', type: 'vegetable',
        spacing: 3, daysToHarvest: 25, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -4, harvestWeeks: 2,
        companions: ['lettuce', 'peas', 'green-beans', 'carrot', 'cucumber', 'spinach', 'nasturtium', 'zucchini'],
        enemies: [],
        notes: 'Fastest veggie! Great row marker. Succession plant biweekly.',
        seedStartInstructions: 'Direct sow 4-6 weeks before last frost (Mar 7-21). Plant 1/2" deep, 1" apart. Succession sow every 2 weeks. Also great fall crop (Sept).',
        careNotes: 'Virtually zero maintenance. Thin to 2-3" apart. Harvest promptly or they get pithy. Great teaching crop for new gardeners.',
        lowMaintenance: true
    },
    {
        id: 'carrot', name: 'Carrot', emoji: '\u{1F955}', type: 'vegetable',
        spacing: 3, daysToHarvest: 70, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -2, harvestWeeks: 8,
        companions: ['tomato', 'lettuce', 'onion', 'rosemary', 'radish', 'peas', 'green-beans', 'chive', 'garlic'],
        enemies: ['dill'],
        notes: 'Direct sow only \u2014 doesn\'t transplant. Loose soil essential.',
        seedStartInstructions: 'Direct sow 2-3 weeks before last frost (Apr 1). Tiny seeds \u2014 mix with sand for even sowing. Press into soil surface, barely cover. Keep moist until germination (14-21 days).',
        careNotes: 'Thin to 2-3" apart when 2" tall. Keep soil loose and stone-free. Mulch shoulders to prevent greening. Sweet after frost!',
        lowMaintenance: true
    },
    {
        id: 'kale', name: 'Kale', emoji: '\u{1F96C}', type: 'vegetable',
        spacing: 18, daysToHarvest: 55, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: -2,
        directSow: -4, harvestWeeks: 20,
        companions: ['green-beans', 'beet', 'lettuce', 'onion', 'garlic', 'dill', 'nasturtium', 'marigold', 'spinach'],
        enemies: ['strawberry', 'tomato'],
        notes: 'Cold-hardy champion. Sweetens after frost. Harvest all season.',
        seedStartInstructions: 'Start indoors 6 weeks before last frost (Mar 7) or direct sow 4 weeks before (Mar 21). Plant 1/4" deep. Cold tolerant \u2014 can go out early.',
        careNotes: 'Extremely low maintenance. Harvest lower leaves, plant keeps producing. Gets SWEETER after frost. Can overwinter in Zone 6a with mulch.',
        lowMaintenance: true
    },
    {
        id: 'onion', name: 'Onion', emoji: '\u{1F9C5}', type: 'vegetable',
        spacing: 4, daysToHarvest: 100, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -10, transplantAfterFrost: -2,
        directSow: null, harvestWeeks: 2,
        companions: ['carrot', 'lettuce', 'tomato', 'strawberry', 'pepper', 'kale', 'spinach', 'garlic', 'chive', 'beet'],
        enemies: ['green-beans', 'peas'],
        notes: 'Start from sets for easiest results. Long day varieties for Ohio.',
        seedStartInstructions: 'Start from seeds 10-12 weeks before last frost (Jan 15-Feb 1) or plant onion sets as soon as soil is workable (mid-March). Use long-day varieties for Ohio.',
        careNotes: 'Weed carefully \u2014 shallow roots. Stop watering when tops fall over. Cure in sun for 2 weeks before storage.',
        lowMaintenance: true
    },
    {
        id: 'garlic', name: 'Garlic', emoji: '\u{1F9C4}', type: 'vegetable',
        spacing: 6, daysToHarvest: 240, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: null, harvestWeeks: 2,
        companions: ['tomato', 'pepper', 'lettuce', 'strawberry', 'carrot', 'kale', 'spinach', 'onion', 'chive'],
        enemies: ['green-beans', 'peas'],
        notes: 'Plant in FALL (October). Harvest following July. Easiest crop ever.',
        seedStartInstructions: 'Plant individual cloves in mid-October, 2" deep, pointy end up, 6" apart. Mulch heavily with straw. They grow roots in fall, go dormant in winter, and shoot up in spring.',
        careNotes: 'Almost zero effort. Remove scapes in June for bigger bulbs. Harvest when lower 1/3 of leaves are brown (July). Cure 2 weeks. ULTIMATE low-maintenance crop.',
        lowMaintenance: true
    },
    {
        id: 'corn', name: 'Sweet Corn', emoji: '\u{1F33D}', type: 'vegetable',
        spacing: 12, daysToHarvest: 75, waterNeed: 'high',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 2, harvestWeeks: 3,
        companions: ['green-beans', 'zucchini', 'cucumber', 'peas', 'sunflower', 'marigold'],
        enemies: ['tomato'],
        notes: 'Three Sisters crop! Plant in blocks (not rows) for pollination. Heavy feeder.',
        seedStartInstructions: 'Direct sow 2 weeks after last frost (May 2) when soil is 60\u00B0F+. Plant 1" deep, 12" apart in blocks of at least 4 rows for wind pollination. Succession plant every 2 weeks through June.',
        careNotes: 'Heavy feeder \u2014 side-dress with compost when knee-high. Needs 1" water/week, critical during silking. Harvest when silks are brown and kernels milky.',
        lowMaintenance: false
    },
    {
        id: 'broccoli', name: 'Broccoli', emoji: '\u{1F966}', type: 'vegetable',
        spacing: 18, daysToHarvest: 70, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: -2,
        directSow: null, harvestWeeks: 4,
        companions: ['onion', 'garlic', 'beet', 'lettuce', 'spinach', 'dill', 'nasturtium', 'marigold', 'thyme', 'rosemary'],
        enemies: ['tomato', 'pepper', 'strawberry', 'green-beans'],
        notes: 'Cool-season crop. Plant spring and fall. Harvest side shoots for extended production.',
        seedStartInstructions: 'Start indoors 6-8 weeks before last frost (Mar 1-7). Plant 1/4" deep. Transplant 2 weeks before last frost (Apr 4). For fall crop, start indoors mid-June, transplant late July.',
        careNotes: 'Consistent moisture. Floating row covers prevent cabbage worms. Harvest central head when tight, then side shoots produce for weeks.',
        lowMaintenance: false
    },
    {
        id: 'cabbage', name: 'Cabbage', emoji: '\u{1F96C}', type: 'vegetable',
        spacing: 18, daysToHarvest: 80, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: -2,
        directSow: null, harvestWeeks: 3,
        companions: ['onion', 'garlic', 'beet', 'lettuce', 'dill', 'nasturtium', 'thyme', 'mint'],
        enemies: ['tomato', 'pepper', 'strawberry', 'green-beans'],
        notes: 'Stores very well. Great for donations. Cool-season crop.',
        seedStartInstructions: 'Start indoors 6-8 weeks before last frost (Mar 1-7). Transplant 2 weeks before last frost (Apr 4). For fall crop, start mid-June, transplant late July.',
        careNotes: 'Use row covers to prevent cabbage worms. Consistent watering prevents splitting. Harvest when heads are firm. Stores 3-4 months \u2014 ideal for food bank donation.',
        lowMaintenance: false
    },
    {
        id: 'beet', name: 'Beet', emoji: '\u{1F534}', type: 'vegetable',
        spacing: 4, daysToHarvest: 55, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -3, harvestWeeks: 6,
        companions: ['onion', 'garlic', 'lettuce', 'kale', 'broccoli', 'cabbage', 'green-beans', 'mint'],
        enemies: ['swiss-chard'],
        notes: 'Both roots AND greens are edible. Cool-season. Succession plant.',
        seedStartInstructions: 'Direct sow 3-4 weeks before last frost (Mar 21-28). Plant 1/2" deep, 1" apart, thin to 4". Each "seed" is actually a cluster \u2014 thin aggressively. Succession sow every 3 weeks.',
        careNotes: 'Soak seeds overnight for faster germination. Thin when 2" tall \u2014 eat the thinnings as microgreens! Both roots and greens are nutritious.',
        lowMaintenance: true
    },
    {
        id: 'swiss-chard', name: 'Swiss Chard', emoji: '\u{1F33F}', type: 'vegetable',
        spacing: 8, daysToHarvest: 55, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -3, transplantAfterFrost: 0,
        directSow: -2, harvestWeeks: 16,
        companions: ['green-beans', 'peas', 'onion', 'garlic', 'lettuce', 'carrot', 'cabbage', 'kale'],
        enemies: ['beet', 'potato'],
        notes: 'Cut-and-come-again all season. Cold-hardy. Beautiful rainbow varieties.',
        seedStartInstructions: 'Start indoors 3-4 weeks before last frost (Mar 28) or direct sow 2 weeks before (Apr 4). Plant 1/2" deep. Very cold tolerant.',
        careNotes: 'Harvest outer leaves at 8-10". Plant keeps producing all season. Tolerates both heat and frost. One of the most productive greens per square foot.',
        lowMaintenance: true
    },
    {
        id: 'peas', name: 'Garden Peas', emoji: '\u{1FAD1}', type: 'vegetable',
        spacing: 3, daysToHarvest: 60, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -4, harvestWeeks: 4,
        companions: ['carrot', 'radish', 'green-beans', 'corn', 'cucumber', 'lettuce', 'spinach', 'mint'],
        enemies: ['onion', 'garlic', 'chive'],
        notes: 'Cool-season nitrogen fixer. Plant early! Needs trellis for climbing types.',
        seedStartInstructions: 'Direct sow 4-6 weeks before last frost (Mar 7-21). Plant 1" deep, 3" apart. Inoculate with rhizobium for best nitrogen fixation. Do NOT start indoors.',
        careNotes: 'Provide trellis or netting for climbing types. Pick frequently to encourage production. Pull plants when done and plant fall crop in Aug.',
        lowMaintenance: true
    },
    {
        id: 'eggplant', name: 'Eggplant', emoji: '\u{1F346}', type: 'vegetable',
        spacing: 24, daysToHarvest: 80, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -8, transplantAfterFrost: 3,
        directSow: null, harvestWeeks: 10,
        companions: ['green-beans', 'pepper', 'marigold', 'nasturtium', 'thyme', 'oregano'],
        enemies: ['fennel'],
        notes: 'Needs warm soil and long season. Very productive once established.',
        seedStartInstructions: 'Start indoors 8-10 weeks before last frost (Feb 15-Mar 1). Needs warmth (75-85\u00B0F) for germination. Transplant 3 weeks after last frost (May 9) when nights stay above 60\u00B0F.',
        careNotes: 'Mulch heavily. Stake or cage for support when heavy with fruit. Harvest when skin is glossy and firm.',
        lowMaintenance: false
    },
    {
        id: 'potato', name: 'Potato', emoji: '\u{1F954}', type: 'vegetable',
        spacing: 12, daysToHarvest: 90, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -2, harvestWeeks: 3,
        companions: ['green-beans', 'corn', 'cabbage', 'broccoli', 'marigold', 'nasturtium', 'thyme'],
        enemies: ['tomato', 'pepper', 'eggplant', 'cucumber', 'zucchini', 'sunflower', 'cantaloupe'],
        notes: 'Plant seed potatoes, not grocery store potatoes. Hill soil as they grow. Massive yield.',
        seedStartInstructions: 'Plant seed potato pieces 2-3 weeks before last frost (Apr 1-4). Cut into pieces with 2-3 eyes each, cure cut sides 2 days. Plant 4" deep, 12" apart.',
        careNotes: 'Hill soil 6" around stems twice during growing. Stop watering when foliage yellows. Harvest when tops die back. Cure in cool dark place for storage.',
        lowMaintenance: true
    },
    // ---- FRUITS ----
    {
        id: 'strawberry', name: 'Strawberry', emoji: '\u{1F353}', type: 'fruit',
        spacing: 12, daysToHarvest: 90, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: 0,
        directSow: null, harvestWeeks: 4,
        companions: ['lettuce', 'spinach', 'green-beans', 'thyme', 'onion', 'garlic', 'chive', 'marigold', 'nasturtium', 'borage'],
        enemies: ['cabbage', 'broccoli'],
        notes: 'Perennial! Plant once, harvest for years. Use bare root transplants.',
        seedStartInstructions: 'Purchase bare root crowns. Plant as soon as soil is workable (mid-April). Set crown at soil level. Pinch first-year flowers on June-bearers for bigger second-year crop.',
        careNotes: 'Mulch with straw to keep fruit clean. Remove runners unless you want spreading. Very low maintenance once established.',
        lowMaintenance: true
    },
    {
        id: 'cantaloupe', name: 'Cantaloupe', emoji: '\u{1F348}', type: 'fruit',
        spacing: 36, daysToHarvest: 85, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -3, transplantAfterFrost: 2,
        directSow: 2, harvestWeeks: 4,
        companions: ['corn', 'sunflower', 'marigold', 'nasturtium', 'radish', 'lettuce'],
        enemies: ['potato', 'cucumber'],
        notes: 'Space hog \u2014 needs room to sprawl. Warm soil essential.',
        seedStartInstructions: 'Start indoors 3-4 weeks before last frost (Mar 28). Use peat pots to avoid root disturbance. Transplant after May 1 when soil is 65\u00B0F+.',
        careNotes: 'Black plastic mulch warms soil. Reduce water as fruit ripens. Slip test: ripe when stem separates easily.',
        lowMaintenance: false
    },
    {
        id: 'blueberry', name: 'Blueberry', emoji: '\u{1FAD0}', type: 'fruit',
        spacing: 48, daysToHarvest: 365, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: 0,
        directSow: null, harvestWeeks: 6,
        companions: ['strawberry', 'thyme', 'basil', 'borage', 'chive'],
        enemies: ['tomato', 'pepper', 'eggplant'],
        notes: 'Perennial shrub. Needs acidic soil (pH 4.5-5.5). Use sulfur or peat to lower pH. Produces fruit in year 2-3. Grows 4-6 ft tall (highbush).',
        seedStartInstructions: 'Plant bare root or potted nursery stock in early spring (April). Dig hole twice root ball width. Amend soil with peat moss & sulfur for acidity. Space 4 ft apart.',
        careNotes: 'Mulch heavily with pine needles or wood chips (acidifying). Water consistently — 1-2 inches/week. Prune oldest canes in late winter. Net fruit to protect from birds. Needs 2+ varieties for cross-pollination.',
        lowMaintenance: true
    },
    // ---- HERBS ----
    {
        id: 'basil', name: 'Basil', emoji: '\u{1F33F}', type: 'herb',
        spacing: 10, daysToHarvest: 60, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: 2,
        directSow: 2, harvestWeeks: 14,
        companions: ['tomato', 'pepper', 'marigold', 'lettuce', 'oregano', 'parsley'],
        enemies: ['sage', 'rue'],
        notes: 'Classic tomato companion. Pinch flowers for bushy growth.',
        seedStartInstructions: 'Start indoors 6-8 weeks before last frost (Mar 1-7). Surface sow, press into soil. Needs light & warmth (70\u00B0F+). Transplant after all frost danger.',
        careNotes: 'Pinch growing tips regularly for bushy plants. Harvest before flowering. Very frost-sensitive \u2014 cover or harvest at season end.',
        lowMaintenance: true
    },
    {
        id: 'chive', name: 'Chives', emoji: '\u{1F33E}', type: 'herb',
        spacing: 8, daysToHarvest: 60, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -8, transplantAfterFrost: 0,
        directSow: 0, harvestWeeks: 20,
        companions: ['carrot', 'tomato', 'strawberry', 'lettuce', 'onion', 'garlic'],
        enemies: ['green-beans', 'peas'],
        notes: 'Perennial! Returns every year. Pest deterrent. Edible flowers.',
        seedStartInstructions: 'Start indoors 8-10 weeks before last frost (Feb 15) or buy transplants. Very slow from seed. Easier to divide existing clumps.',
        careNotes: 'Perennial \u2014 plant once, harvest for years. Cut back to 2" periodically for fresh growth. Divide clumps every 3 years.',
        lowMaintenance: true
    },
    {
        id: 'parsley', name: 'Parsley', emoji: '\u{2618}', type: 'herb',
        spacing: 8, daysToHarvest: 75, waterNeed: 'medium',
        sunNeed: 'partial', sowIndoors: -8, transplantAfterFrost: -2,
        directSow: -2, harvestWeeks: 20,
        companions: ['tomato', 'pepper', 'carrot', 'chive', 'green-beans', 'lettuce'],
        enemies: ['mint'],
        notes: 'Biennial. Attracts swallowtail butterflies. Extremely versatile culinary herb.',
        seedStartInstructions: 'Start indoors 8-10 weeks before last frost (Feb 15). SLOW germinator \u2014 soak seeds 24hrs first, takes 3-4 weeks to sprout. Or direct sow 2 weeks before last frost (Apr 4).',
        careNotes: 'Slow to start but very productive. Cut outer stems to harvest. Biennial \u2014 let a few plants flower in year 2 for swallowtail butterfly host. Cold hardy into November.',
        lowMaintenance: true
    },
    {
        id: 'cilantro', name: 'Cilantro', emoji: '\u{1F33F}', type: 'herb',
        spacing: 4, daysToHarvest: 45, waterNeed: 'medium',
        sunNeed: 'partial', sowIndoors: null, transplantAfterFrost: null,
        directSow: -2, harvestWeeks: 3,
        companions: ['tomato', 'pepper', 'green-beans', 'peas', 'lettuce', 'spinach'],
        enemies: ['fennel', 'dill'],
        notes: 'Bolts fast in heat. Succession sow! Seeds = coriander. Culturally essential.',
        seedStartInstructions: 'Direct sow 2 weeks before last frost (Apr 4). Plant 1/4" deep, scatter thickly. Succession sow every 2-3 weeks through May, resume in Sept.',
        careNotes: 'Bolts to seed rapidly in warm weather. Plant in partial shade in summer. Let some bolt \u2014 coriander seeds are a valuable spice. Self-seeds readily.',
        lowMaintenance: true
    },
    {
        id: 'oregano', name: 'Oregano', emoji: '\u{1F33F}', type: 'herb',
        spacing: 12, daysToHarvest: 60, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: 0,
        directSow: 0, harvestWeeks: 20,
        companions: ['tomato', 'pepper', 'green-beans', 'broccoli', 'cabbage', 'kale', 'basil', 'thyme'],
        enemies: [],
        notes: 'Perennial! Returns every year in Zone 6a. Good all-around companion plant.',
        seedStartInstructions: 'Start indoors 6-8 weeks before last frost (Mar 1-7) or buy transplants (easier). Tiny seeds \u2014 surface sow, press gently. Perennial in Zone 6a.',
        careNotes: 'Extremely low maintenance. Cut back by 1/3 before flowering for best flavor. Drought tolerant. Mulch in fall for winter protection.',
        lowMaintenance: true
    },
    {
        id: 'dill', name: 'Dill', emoji: '\u{1F33F}', type: 'herb',
        spacing: 8, daysToHarvest: 55, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 0, harvestWeeks: 8,
        companions: ['cucumber', 'lettuce', 'onion', 'zucchini', 'kale', 'green-beans', 'broccoli', 'cabbage'],
        enemies: ['carrot', 'tomato'],
        notes: 'Self-seeds aggressively. Attracts beneficial insects. Easy pickles!',
        seedStartInstructions: 'Direct sow after last frost (Apr 18). Scatter seeds, press into soil. Barely cover. Self-seeds like crazy \u2014 you\'ll have it forever after one planting.',
        careNotes: 'Let some plants go to seed for next year\'s crop. Attracts swallowtail butterflies. Harvest leaves anytime, seeds when brown.',
        lowMaintenance: true
    },
    {
        id: 'mint', name: 'Mint', emoji: '\u{1F33F}', type: 'herb',
        spacing: 12, daysToHarvest: 60, waterNeed: 'medium',
        sunNeed: 'partial', sowIndoors: null, transplantAfterFrost: 0,
        directSow: null, harvestWeeks: 20,
        companions: ['tomato', 'cabbage', 'peas', 'kale', 'lettuce'],
        enemies: ['parsley'],
        notes: 'WARNING: Invasive spreader! ALWAYS plant in containers, never directly in beds.',
        seedStartInstructions: 'Buy transplants \u2014 do NOT direct sow in beds. MUST be contained in a pot sunk into the bed or it will take over everything. Plant after last frost.',
        careNotes: 'Will aggressively spread if not contained. Grow in sunken pots within beds. Cut back hard periodically. Perennial and virtually unkillable.',
        lowMaintenance: true
    },
    {
        id: 'thyme', name: 'Thyme', emoji: '\u{1F33F}', type: 'herb',
        spacing: 8, daysToHarvest: 70, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -8, transplantAfterFrost: 0,
        directSow: null, harvestWeeks: 20,
        companions: ['strawberry', 'tomato', 'cabbage', 'oregano', 'marigold', 'eggplant', 'potato', 'broccoli'],
        enemies: [],
        notes: 'Perennial ground cover. Drought champion. Practically unkillable.',
        seedStartInstructions: 'Start indoors 8-10 weeks before last frost (Feb 15) or buy transplants (much easier). Slow from seed. Perennial in Zone 6a.',
        careNotes: 'Nearly indestructible. Drought tolerant. Cut back by 1/3 in spring. Never overwater. Spreading varieties make great ground cover between beds.',
        lowMaintenance: true
    },
    {
        id: 'rosemary', name: 'Rosemary', emoji: '\u{1F33F}', type: 'herb',
        spacing: 18, daysToHarvest: 80, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -10, transplantAfterFrost: 2,
        directSow: null, harvestWeeks: 20,
        companions: ['carrot', 'green-beans', 'broccoli', 'cabbage', 'kale', 'pepper'],
        enemies: ['cucumber', 'zucchini'],
        notes: 'Treat as annual in Zone 6a (may overwinter with heavy protection). Repels many pests.',
        seedStartInstructions: 'Buy transplants \u2014 very slow and unreliable from seed. Plant after last frost (Apr 18). In Zone 6a, treat as annual or bring pots indoors for winter.',
        careNotes: 'Excellent drought tolerance. Do not overwater. Repels cabbage moths, carrot rust flies, and bean beetles. Bring potted plants indoors before first frost.',
        lowMaintenance: true
    },
    {
        id: 'borage', name: 'Borage', emoji: '\u{1F33A}', type: 'herb',
        spacing: 18, daysToHarvest: 55, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -4, transplantAfterFrost: 0,
        directSow: 0, harvestWeeks: 12,
        companions: ['tomato', 'strawberry', 'zucchini', 'cucumber', 'green-beans'],
        enemies: [],
        notes: 'Top-tier companion plant. Massive pollinator attractor. Edible flowers.',
        seedStartInstructions: 'Start indoors 4-6 weeks before last frost (Mar 14-28) or direct sow after last frost (Apr 18). Plant 1/4-1/2" deep. Self-seeds vigorously.',
        careNotes: 'Grows large (2-3 feet). Stake to prevent flopping. Attracts bees and parasitic wasps that control hornworms. Edible star-shaped blue flowers.',
        lowMaintenance: true
    },
    // ---- FLOWERS ----
    {
        id: 'sweet-peas', name: 'Sweet Peas', emoji: '\u{1F33C}', type: 'flower',
        spacing: 6, daysToHarvest: 65, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: -2,
        directSow: -4, harvestWeeks: 8,
        companions: ['green-beans', 'carrot', 'radish'],
        enemies: ['onion', 'garlic'],
        notes: 'Beautiful cut flowers. Cool season \u2014 plant early. Needs trellis. NOT edible (ornamental only).',
        seedStartInstructions: 'Soak seeds 24hrs. Start indoors 6 weeks before last frost (Mar 7) or direct sow 4 weeks before (Mar 21). Nick seed coat with file before soaking.',
        careNotes: 'Provide trellis or netting. Keep soil cool with mulch. Deadhead regularly for continuous bloom.',
        lowMaintenance: true
    },
    {
        id: 'marigold', name: 'Marigold', emoji: '\u{1F33B}', type: 'flower',
        spacing: 8, daysToHarvest: 50, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: 0,
        directSow: 0, harvestWeeks: 16,
        companions: ['tomato', 'pepper', 'green-beans', 'zucchini', 'cucumber', 'strawberry', 'nasturtium', 'eggplant', 'potato', 'broccoli'],
        enemies: [],
        notes: 'Pest deterrent powerhouse. Plant everywhere as companion. Deer resistant.',
        seedStartInstructions: 'Start indoors 6-8 weeks before last frost (Mar 1) or direct sow after last frost (Apr 18). Easy germinators. Cover lightly with soil.',
        careNotes: 'Nearly indestructible. Deadhead for continuous bloom. Drought tolerant once established. French marigolds best for pest control.',
        lowMaintenance: true
    },
    {
        id: 'nasturtium', name: 'Nasturtium', emoji: '\u{1F33A}', type: 'flower',
        spacing: 10, daysToHarvest: 55, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 0, harvestWeeks: 14,
        companions: ['tomato', 'cucumber', 'zucchini', 'green-beans', 'radish', 'kale', 'strawberry', 'marigold', 'broccoli', 'cabbage', 'potato'],
        enemies: [],
        notes: 'Edible! Trap crop for aphids. Thrives in poor soil. Zero maintenance.',
        seedStartInstructions: 'Direct sow after last frost (Apr 18). Plant 1/2" deep. Large seeds, easy to handle. Nick seed coat for faster germination.',
        careNotes: 'Thrives on neglect. Poor soil = more flowers. Do NOT fertilize. Edible flowers and leaves (peppery). Trap crop attracts aphids away from veggies.',
        lowMaintenance: true
    },
    {
        id: 'sunflower', name: 'Sunflower', emoji: '\u{1F33B}', type: 'flower',
        spacing: 18, daysToHarvest: 80, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 1, harvestWeeks: 4,
        companions: ['cucumber', 'corn', 'zucchini', 'lettuce', 'green-beans'],
        enemies: ['potato'],
        notes: 'Pollinators love them. Community engagement magnet. Seeds for birds.',
        seedStartInstructions: 'Direct sow 1 week after last frost (Apr 25). Plant 1" deep. Fast growers. Succession plant every 2 weeks for continuous bloom.',
        careNotes: 'Water regularly until established, then drought tolerant. Stake tall varieties. Leave seed heads for birds in fall \u2014 great community engagement.',
        lowMaintenance: true
    },

    // ---- VARIETY-SPECIFIC ENTRIES (from seed packets, added 2026-03-07) ----

    // — TOMATOES —
    {
        id: 'tomato-cherokee-purple', name: 'Tomato - Cherokee Purple', emoji: '\u{1F345}', type: 'vegetable',
        spacing: 30, daysToHarvest: 82, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: 2,
        directSow: null, harvestWeeks: 10,
        companions: ['basil', 'marigold', 'carrot', 'parsley', 'onion', 'garlic', 'chive', 'nasturtium'],
        enemies: ['cabbage', 'fennel', 'dill', 'potato', 'broccoli', 'kale'],
        notes: 'Heirloom indeterminate. 10-12 oz pink-purple fruit with smoky, sweet flavor. Disease tolerant. Certified organic (Ferry-Morse).',
        seedStartInstructions: 'Start indoors 6 weeks before last frost in sunny location. Plant 1/4" deep. Germination 7-10 days. Transplant outdoors when seedlings have 4-6 leaves and weather is warm.',
        careNotes: 'Indeterminate vines \u2014 stake or cage. Cannot tolerate frost. Can also direct sow when soil is warm. Space 2.5 ft apart, 2 ft rows.',
        lowMaintenance: false,
        seedPacket: true
    },
    {
        id: 'tomato-red-brandywine', name: 'Tomato - Red Brandywine', emoji: '\u{1F345}', type: 'vegetable',
        spacing: 24, daysToHarvest: 90, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -7, transplantAfterFrost: 2,
        directSow: null, harvestWeeks: 10,
        companions: ['basil', 'marigold', 'carrot', 'parsley', 'onion', 'garlic', 'chive', 'nasturtium'],
        enemies: ['cabbage', 'fennel', 'dill', 'potato', 'broccoli', 'kale'],
        notes: 'Heirloom indeterminate. Deep red, avg 8 oz fruits with well-balanced flavor. Disease tolerant. Needs staking \u2014 few but large fruit. (Livingston)',
        seedStartInstructions: 'Start indoors 6-8 weeks before last frost. Plant 1/4" deep. Transplant to 2 ft spacing after danger of frost when soil warms.',
        careNotes: 'Indeterminate \u2014 stake heavily. Produces fewer but larger fruit than most varieties. Direct sow also possible after frost.',
        lowMaintenance: false,
        seedPacket: true
    },
    {
        id: 'tomato-roma', name: 'Tomato - Roma', emoji: '\u{1F345}', type: 'vegetable',
        spacing: 36, daysToHarvest: 80, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: 2,
        directSow: null, harvestWeeks: 8,
        companions: ['basil', 'marigold', 'carrot', 'parsley', 'onion', 'garlic', 'chive', 'nasturtium'],
        enemies: ['cabbage', 'fennel', 'dill', 'potato', 'broccoli', 'kale'],
        notes: 'Determinate paste tomato. Heavy yields, little juice, mild flavor. Good leaf cover. Disease tolerant. Ideal for preserves, canning, and puree. (Ferry-Morse)',
        seedStartInstructions: 'Start indoors 6 weeks before warm weather. Plant 1/4" deep. Germination 7-10 days. Transplant at 4-6 leaves when weather is warm. Space 3 ft apart, 2 ft rows.',
        careNotes: 'Determinate \u2014 more compact than indeterminate. Cannot tolerate frost. Harvest when firm and deep red.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'tomato-better-boy', name: 'Tomato - Better Boy Hybrid', emoji: '\u{1F345}', type: 'vegetable',
        spacing: 24, daysToHarvest: 80, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: 2,
        directSow: null, harvestWeeks: 10,
        companions: ['basil', 'marigold', 'carrot', 'parsley', 'onion', 'garlic', 'chive', 'nasturtium'],
        enemies: ['cabbage', 'fennel', 'dill', 'potato', 'broccoli', 'kale'],
        notes: 'Hybrid indeterminate. Extra-large fruits up to 1.5 lbs. Deep red, smooth, firm, meaty. Tolerant of CFN, ASC, and ST diseases. (Ferry-Morse)',
        seedStartInstructions: 'Start indoors 6 weeks before warm weather. Plant 1/4" deep. Germination 8-10 days. Transplant at 4-6 leaves. Space 2 ft apart, 2 ft rows.',
        careNotes: 'Vigorous indeterminate \u2014 stake or cage. Cannot tolerate frost. Seeds can be sown directly when soil is warm.',
        lowMaintenance: false,
        seedPacket: true
    },
    {
        id: 'tomato-mortgage-lifter', name: 'Tomato - Mortgage Lifter', emoji: '\u{1F345}', type: 'vegetable',
        spacing: 30, daysToHarvest: 82, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -5, transplantAfterFrost: 2,
        directSow: null, harvestWeeks: 10,
        companions: ['basil', 'marigold', 'carrot', 'parsley', 'onion', 'garlic', 'chive', 'nasturtium'],
        enemies: ['cabbage', 'fennel', 'dill', 'potato', 'broccoli', 'kale'],
        notes: 'Heirloom indeterminate. Avg 2.5 lbs each, deep pink, sweet, large and meaty with few seeds. Developed 1930s in Logan, WV. (Livingston)',
        seedStartInstructions: 'Start indoors 4-6 weeks before last frost. Plant 1/4" in flats or pots. Transplant seedlings 18-36" apart.',
        careNotes: 'Indeterminate \u2014 staking required due to large fruit size. Produces fewer but massive fruit.',
        lowMaintenance: false,
        seedPacket: true
    },

    // — VEGETABLES (other) —
    {
        id: 'onion-evergreen-bunching', name: 'Onion - Evergreen Bunching', emoji: '\u{1F9C5}', type: 'vegetable',
        spacing: 3, daysToHarvest: 60, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -4, harvestWeeks: 8,
        companions: ['carrot', 'lettuce', 'tomato', 'strawberry', 'pepper', 'kale', 'spinach'],
        enemies: ['green-beans', 'peas'],
        notes: 'Green bunching onion. Crisp and mild, great in salads and as appetizer. Certified organic (Ferry-Morse).',
        seedStartInstructions: 'Sow directly in full sun and well-drained soil. Plant 2-3 seeds per inch, 1/4-1/2" deep. Thin to 3" apart when 3" tall. Germination 10-12 days.',
        careNotes: 'Begin pulling when pencil-thick. 12" between rows. Can be harvested at any size.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'carrot-chantenay', name: 'Carrot - Chantenay', emoji: '\u{1F955}', type: 'vegetable',
        spacing: 3, daysToHarvest: 70, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -2, harvestWeeks: 4,
        companions: ['tomato', 'lettuce', 'onion', 'radish', 'peas', 'chive', 'rosemary'],
        enemies: ['dill', 'parsley'],
        notes: 'Heirloom from the mid-1800s. Tender, crisp 5-7" conical roots with strong tops. Good for storage, canning, and freezing. (Livingston)',
        seedStartInstructions: 'Direct sow 2 weeks before last frost. Plant 1/2-3/4" deep. Thin to 2-4" apart.',
        careNotes: 'Keep soil consistently moist for germination. Shape and color may vary with soil type and temperature. Lower temps may give yellower roots.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'beet-bulls-blood', name: 'Beet - Bull\'s Blood', emoji: '\u{1F534}', type: 'vegetable',
        spacing: 4, daysToHarvest: 46, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 1, harvestWeeks: 3,
        companions: ['onion', 'garlic', 'lettuce', 'spinach', 'kale', 'cabbage', 'broccoli'],
        enemies: ['green-beans'],
        notes: 'Deep red ornamental leaves \u2014 great in salad mixes. Tasty roots too. Harvest roots at 2-3". Adds color to flower gardens. Height 1-2 ft. (Livingston)',
        seedStartInstructions: 'Direct sow when soil warms after last frost. Plant 1/2" deep.',
        careNotes: 'Dual purpose \u2014 harvest both sweet leaves and roots. Thin progressively.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'beet-early-wonder', name: 'Beet - Tall Top Early Wonder', emoji: '\u{1F534}', type: 'vegetable',
        spacing: 4, daysToHarvest: 60, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -4, harvestWeeks: 3,
        companions: ['onion', 'garlic', 'lettuce', 'spinach', 'kale', 'cabbage', 'broccoli'],
        enemies: ['green-beans'],
        notes: 'All-purpose table beet. Flattened globe roots with purplish-red flesh. High in vitamins A, B2, B6, C. Certified organic (Ferry-Morse).',
        seedStartInstructions: 'Sow as early as ground can be worked. Plant 1" deep, press down firmly. Rows 18" apart, thin to 4". Germination 8-10 days.',
        careNotes: 'When tops are 6", pull plants until 4" apart. Harvest when roots are 3" diameter.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'pumpkin-big-max', name: 'Pumpkin - Big Max', emoji: '\u{1F383}', type: 'vegetable',
        spacing: 96, daysToHarvest: 120, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 2, harvestWeeks: 2,
        companions: ['corn', 'green-beans', 'marigold', 'nasturtium', 'radish'],
        enemies: ['potato'],
        notes: 'Giant pumpkin \u2014 up to 6 ft diameter and 100+ lbs! Round to flattened-round, pinkish-orange. Excellent for prize pumpkins. Certified organic (Ferry-Morse).',
        seedStartInstructions: 'Sow 3 seeds per hill (9-12" tall, 1 ft across) after frost danger. Full sun. Plant 1-1.5" deep. Germination 7-10 days.',
        careNotes: 'Thin to 2 per hill at 1" tall, then strongest at 3". Heavy organic mulch. Space hills 8 ft apart.',
        lowMaintenance: false,
        seedPacket: true
    },
    {
        id: 'watermelon-crimson-sweet', name: 'Watermelon - Crimson Sweet', emoji: '\u{1F349}', type: 'vegetable',
        spacing: 60, daysToHarvest: 80, waterNeed: 'high',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 2, harvestWeeks: 3,
        companions: ['corn', 'marigold', 'nasturtium', 'radish', 'sunflower'],
        enemies: ['potato'],
        notes: 'Sweet, deep red flesh with dark green striped rind. Round melons up to 25 lbs. High in vitamins A, B, C. Certified organic (Ferry-Morse).',
        seedStartInstructions: 'Sow 4-5 seeds per hill (12" tall, 2 ft across) in full sun after frost. Plant 1/2" deep. Germination 6-8 days. Thin to 3 per hill at 6".',
        careNotes: 'Do not disturb roots. 5 ft between plants, 6 ft between rows. Water consistently.',
        lowMaintenance: false,
        seedPacket: true
    },
    {
        id: 'watermelon-petite-yellow', name: 'Watermelon - Petite Yellow', emoji: '\u{1F349}', type: 'vegetable',
        spacing: 72, daysToHarvest: 72, waterNeed: 'high',
        sunNeed: 'full', sowIndoors: -4, transplantAfterFrost: 2,
        directSow: 2, harvestWeeks: 3,
        companions: ['corn', 'marigold', 'nasturtium', 'radish', 'sunflower'],
        enemies: ['potato'],
        notes: 'Compact variety with bright yellow flesh, 6-10 lbs. Sweet and aromatic. Space-saving. Not frost hardy. (Livingston)',
        seedStartInstructions: 'Start indoors 4 weeks before last frost, or direct sow after danger of frost and soil warms. Plant 1/2" deep. Thin to 6-8 ft apart.',
        careNotes: 'Water regularly but do not overwater. More compact than other watermelons.',
        lowMaintenance: false,
        seedPacket: true
    },
    {
        id: 'watermelon-dixie-queen', name: 'Watermelon - Dixie Queen', emoji: '\u{1F349}', type: 'vegetable',
        spacing: 72, daysToHarvest: 85, waterNeed: 'high',
        sunNeed: 'full', sowIndoors: -4, transplantAfterFrost: 2,
        directSow: 2, harvestWeeks: 3,
        companions: ['corn', 'marigold', 'nasturtium', 'radish', 'sunflower'],
        enemies: ['potato'],
        notes: 'Heirloom. Earlier-to-harvest, 40-50 lbs with dark green and ivory stripes. Crisp red flesh, exceptionally sweet. (Livingston)',
        seedStartInstructions: 'Start indoors 4 weeks before last frost, or direct sow after frost/soil warms. Plant 1/2" deep. Thin to 6-8 ft apart.',
        careNotes: 'Harvest when bottom turns yellow and stem curlicue dries.',
        lowMaintenance: false,
        seedPacket: true
    },
    {
        id: 'cantaloupe-hearts-of-gold', name: 'Cantaloupe - Hearts of Gold', emoji: '\u{1F348}', type: 'vegetable',
        spacing: 36, daysToHarvest: 90, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -4, transplantAfterFrost: 2,
        directSow: 1, harvestWeeks: 3,
        companions: ['corn', 'sunflower', 'marigold', 'nasturtium', 'radish', 'lettuce'],
        enemies: ['potato', 'cucumber'],
        notes: 'Heirloom developed 1895. Most popular Midwest variety in 1930s. Almost round, ~3 lb melons with sweet, deep orange flesh. (Livingston)',
        seedStartInstructions: 'Start indoors 4 weeks before last frost. Plant 1/4" deep. Thin to 36" apart. Direct sow after danger of frost.',
        careNotes: 'Needs warm soil and full sun. Harvest when stem slips easily from fruit.',
        lowMaintenance: false,
        seedPacket: true
    },
    {
        id: 'cantaloupe-delicious-51', name: 'Cantaloupe - Delicious 51', emoji: '\u{1F348}', type: 'vegetable',
        spacing: 36, daysToHarvest: 80, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -4, transplantAfterFrost: 2,
        directSow: 1, harvestWeeks: 3,
        companions: ['corn', 'sunflower', 'marigold', 'nasturtium', 'radish', 'lettuce'],
        enemies: ['potato', 'cucumber'],
        notes: 'Salmon-orange flesh, very sweet and aromatic. 5-6" oval, 3-4 lbs. Lightly netted rind. (Livingston)',
        seedStartInstructions: 'Start indoors 3-4 weeks before last frost, or direct sow after frost. Plant 1/2" deep. Space 3 ft apart in raised rows or hills.',
        careNotes: 'Sunny, warm location with well-drained soil. Harvest when stem slips easily.',
        lowMaintenance: false,
        seedPacket: true
    },
    {
        id: 'squash-cocozelle', name: 'Squash - Cocozelle', emoji: '\u{1F95C}', type: 'vegetable',
        spacing: 21, daysToHarvest: 50, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -3, transplantAfterFrost: 1,
        directSow: 1, harvestWeeks: 8,
        companions: ['corn', 'green-beans', 'radish', 'marigold', 'nasturtium', 'borage'],
        enemies: ['potato'],
        notes: 'Italian zucchini with bush habit. Dark green with lighter stripes. Firm, greenish-white flesh. Good in containers and small gardens. Good for freezing/canning. (Livingston)',
        seedStartInstructions: 'Start indoors 14-21 days before last frost, or direct sow after frost. Plant 1/2-3/4" deep. Thin to 18-24" apart.',
        careNotes: 'Best harvested at 12" or shorter. Pick often for prolonged harvest.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'cucumber-national-pickling', name: 'Cucumber - National Pickling', emoji: '\u{1F952}', type: 'vegetable',
        spacing: 48, daysToHarvest: 55, waterNeed: 'high',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 2, harvestWeeks: 6,
        companions: ['green-beans', 'peas', 'lettuce', 'sunflower', 'radish', 'dill', 'marigold', 'nasturtium', 'corn'],
        enemies: ['potato', 'sage', 'rosemary'],
        notes: 'Very high-yielding vines. Crispy, tender-skinned blocky fruit. Top-notch for pickling when harvested young. Certified organic (Ferry-Morse).',
        seedStartInstructions: 'Sow a few seeds per hill (12" tall, 2 ft across) in full sun with well-drained soil. Plant 1/2" deep. Germination 8-10 days. Thin to 3 per hill at 2".',
        careNotes: 'Trellis for smaller gardens. Succession plant every 3 weeks for all-season cucumbers. Keep fruits picked. 4 ft / 6 ft spacing.',
        lowMaintenance: false,
        seedPacket: true
    },
    {
        id: 'cowpeas-california-blackeye', name: 'Cowpeas - California Blackeye', emoji: '\u{1FAD8}', type: 'vegetable',
        spacing: 3, daysToHarvest: 80, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 2, harvestWeeks: 4,
        companions: ['corn', 'cucumber', 'radish'],
        enemies: ['onion', 'garlic', 'fennel'],
        notes: 'Bushy plants produce 7" pods with greenish-white peas marked with a black eye. Most popular southern pea. Tender and delicious. Certified organic (Ferry-Morse).',
        seedStartInstructions: 'Sow directly in full sun after soil warms. Plant 2 seeds every 3", 1" deep. Germination 7-10 days. Thin to 1 per 3" when they have 4 leaves.',
        careNotes: 'Keep soil moist. Space rows 3 ft apart. Heat-loving crop.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'lettuce-lolla-rossa', name: 'Lettuce - Lolla Rossa', emoji: '\u{1F96C}', type: 'vegetable',
        spacing: 10, daysToHarvest: 50, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -5, transplantAfterFrost: 0,
        directSow: 1, harvestWeeks: 6,
        companions: ['carrot', 'radish', 'strawberry', 'chive', 'onion', 'garlic', 'green-beans', 'peas'],
        enemies: [],
        notes: 'Beautiful magenta, frilly leaves with light green base. Mild and tasty. Excellent cut-and-come-again. Decorative in containers. (Livingston)',
        seedStartInstructions: 'Start indoors 4-6 weeks before last frost, or direct sow after frost. Plant 1/4" deep. Thin to 8-12". Height 6-12".',
        careNotes: 'Pick outer leaves as they grow, or harvest whole. Crisper in cooler temps.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'pea-early-frosty', name: 'Pea - Early Frosty', emoji: '\u{1FAD1}', type: 'vegetable',
        spacing: 3, daysToHarvest: 62, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -6, harvestWeeks: 3,
        companions: ['carrot', 'radish', 'cucumber', 'corn', 'lettuce', 'spinach'],
        enemies: ['onion', 'garlic', 'chive'],
        notes: 'Vigorous, heavy producer of 4" double pods with 7-8 sweet peas. Easy to pick, wilt resistant. Good for short seasons and cold springs. (Livingston)',
        seedStartInstructions: 'Direct sow as soon as soil can be worked. Plant 1/2-3/4" deep, 1-3" apart. Height 28-30".',
        careNotes: 'Train on stakes or trellis. Succession plant every 2 weeks through midspring, resume in late summer for fall crop.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'pea-lincoln', name: 'Pea - Lincoln', emoji: '\u{1FAD1}', type: 'vegetable',
        spacing: 8, daysToHarvest: 62, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -6, harvestWeeks: 3,
        companions: ['carrot', 'radish', 'cucumber', 'corn', 'lettuce', 'spinach'],
        enemies: ['onion', 'garlic', 'chive'],
        notes: 'High yields of sweet, tender peas. 4-5" pods with 6-9 peas. Heat and wilt tolerant. Great fresh, canned, or frozen. Ideal for fall crop. (Livingston)',
        seedStartInstructions: 'Direct sow as soon as soil can be worked. Plant 3/4-1" deep. Thin to 8". Height 24-30".',
        careNotes: 'Sow in double rows with trellis between for easy harvest. Succession plant every 2 weeks.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'arugula-roquette', name: 'Arugula - Roquette', emoji: '\u{1F96C}', type: 'vegetable',
        spacing: 9, daysToHarvest: 40, waterNeed: 'medium',
        sunNeed: 'partial', sowIndoors: null, transplantAfterFrost: null,
        directSow: -4, harvestWeeks: 4,
        companions: ['lettuce', 'spinach', 'carrot', 'onion', 'chive'],
        enemies: [],
        notes: 'Mustard family. Long, smooth leaves with pungent taste. Best as greens and in salads when young. Certified organic (Ferry-Morse).',
        seedStartInstructions: 'Sow as soon as ground can be worked. Plant 1 seed every 3", 1/4" deep. Thin when established. Germination 8-10 days.',
        careNotes: 'Pick outer leaves for regular use. Rows 14" apart, plants 9" apart.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'spinach-america', name: 'Spinach - America', emoji: '\u{1F343}', type: 'vegetable',
        spacing: 8, daysToHarvest: 50, waterNeed: 'medium',
        sunNeed: 'partial', sowIndoors: null, transplantAfterFrost: null,
        directSow: -4, harvestWeeks: 4,
        companions: ['strawberry', 'peas', 'green-beans', 'lettuce', 'radish', 'kale'],
        enemies: ['potato'],
        notes: 'Heirloom savoy-leafed (curly) variety, ~12" wide. Outstanding flavor. Drought and heat tolerant compact variety. Spring and fall sowing. (Livingston)',
        seedStartInstructions: 'Direct sow when soil is 50-70\u00B0F \u2014 spring and fall. Plant 1/2-1" deep. Thin to 6-10". Height ~8".',
        careNotes: 'Harvest dark leaves before bolting. Grow in cold frames for winter salads. Can freeze for later.',
        lowMaintenance: true,
        seedPacket: true
    },

    // — HERBS —
    {
        id: 'dill-mammoth', name: 'Dill - Mammoth', emoji: '\u{1F33F}', type: 'herb',
        spacing: 9, daysToHarvest: 67, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 1, harvestWeeks: 4,
        companions: ['lettuce', 'cucumber', 'onion', 'cabbage', 'corn'],
        enemies: ['carrot', 'tomato'],
        notes: 'Annual herb. Highly aromatic. Use for dill pickles, salads, soups, meat, fish. Certified organic (Ferry-Morse).',
        seedStartInstructions: 'Sow directly in well-drained soil in sunny location. Plant 1/4" deep. Germination 7-14 days. Thin to 9" apart when 2" tall.',
        careNotes: 'Harvest when lower part of seed cluster is ripe. Let some go to seed for self-sowing.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'basil-sweet', name: 'Basil - Sweet', emoji: '\u{1F33F}', type: 'herb',
        spacing: 10, daysToHarvest: 85, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: 1,
        directSow: 1, harvestWeeks: 12,
        companions: ['tomato', 'pepper', 'oregano', 'marigold'],
        enemies: ['sage'],
        notes: 'Annual herb. Spicy flavor, pleasing aroma. Excellent tomato companion. Certified organic (Ferry-Morse).',
        seedStartInstructions: 'Start indoors 6 weeks before transplanting near sunny window, or direct sow after frost in full sun. Plant 1/4" deep. Germination 5-10 days.',
        careNotes: 'Rows 2 ft apart, thin to 10". Pinch flower buds for longer leaf harvest.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'parsley-flat-italian', name: 'Parsley - Flat Italian', emoji: '\u{2618}', type: 'herb',
        spacing: 10, daysToHarvest: 75, waterNeed: 'medium',
        sunNeed: 'partial', sowIndoors: -6, transplantAfterFrost: null,
        directSow: -4, harvestWeeks: 16,
        companions: ['tomato', 'corn', 'asparagus'],
        enemies: ['lettuce', 'mint'],
        notes: 'Biennial herb. Very nice flavor for fresh use and drying. Dark green flat leaves. Easy to grow. Certified organic (Ferry-Morse).',
        seedStartInstructions: 'Soak seeds overnight in warm water. Start indoors 6 weeks before planting, or sow in rich, moist soil as early as ground can be worked. Plant 1/4" deep. Germination 21-28 days.',
        careNotes: 'Thin to 10" apart when 2" tall. Cut only 2-3 stems at a time. Sun or partial shade.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'catnip', name: 'Catnip', emoji: '\u{1F33F}', type: 'herb',
        spacing: 20, daysToHarvest: 72, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 1, harvestWeeks: 8,
        companions: ['squash', 'pumpkin', 'cucumber'],
        enemies: [],
        notes: 'Perennial herb (mint family). Lemony-mint flavor for cooking and tea. Attracts cats and bees. Certified organic (Ferry-Morse).',
        seedStartInstructions: 'Sow directly in full sun, ordinary well-drained soil. Plant 1/4" deep. Germination 8-12 days. Thin to 20" when 2" tall.',
        careNotes: 'Pinch back shoot tops for bushy plants when buds appear. Pick leaves as needed.',
        lowMaintenance: true,
        seedPacket: true
    },

    // — FLOWERS —
    {
        id: 'california-poppy-mission-bells', name: 'California Poppy - Mission Bells', emoji: '\u{1F33A}', type: 'flower',
        spacing: 6, daysToHarvest: 80, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -4, harvestWeeks: 10,
        companions: ['marigold', 'zinnia', 'nasturtium'],
        enemies: [],
        notes: 'Free-flowering bell-shaped blooms in shimmering jewel tones. Drought tolerant and sturdy. Perfect for rock gardens and containers. Reseeds in mild climates. (Ferry-Morse)',
        seedStartInstructions: 'In early spring, sow in open ground well exposed. Cover with 1/4" soil. In mild climates, plant fall or winter. Germination 10-12 days. Thin when 2" high.',
        careNotes: 'Does not transplant easily. Height 12". Days to bloom: 70-90.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'marigold-crackerjack', name: 'Marigold - Crackerjack Mixed', emoji: '\u{1F33B}', type: 'flower',
        spacing: 12, daysToHarvest: 52, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -7, transplantAfterFrost: 1,
        directSow: 1, harvestWeeks: 14,
        companions: ['tomato', 'pepper', 'cucumber', 'eggplant', 'green-beans', 'potato'],
        enemies: [],
        notes: 'Half-hardy annual. Huge flowers in orange, gold, yellow, primrose. Blooms midsummer to first frost. Height 2-3 ft. (Ferry-Morse)',
        seedStartInstructions: 'After frost, sow in open ground 1/4" deep. For earlier bloom, start indoors 6-8 weeks before last frost. Germination 5-8 days. Thin/transplant when 2" high. Harden off.',
        careNotes: 'Deadhead for continuous bloom. Great pest deterrent in vegetable gardens. Days to bloom: 45-60.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'marigold-french-dwarf', name: 'Marigold - French Double Dwarf', emoji: '\u{1F33B}', type: 'flower',
        spacing: 8, daysToHarvest: 52, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -7, transplantAfterFrost: 1,
        directSow: 1, harvestWeeks: 16,
        companions: ['tomato', 'pepper', 'cucumber', 'eggplant', 'green-beans', 'potato'],
        enemies: [],
        notes: 'Half-hardy annual. Compact plants, showy double flowers in Gold, Orange, Harmony \u2014 All-American Winners. Blooms all summer to frost. Height 6-10". (Ferry-Morse)',
        seedStartInstructions: 'After frost, sow in open ground 1/4" deep. For earlier bloom, start indoors 6-8 weeks before last frost. Germination 5-8 days. Thin/transplant when 2". Harden off.',
        careNotes: 'Perfect for borders and containers. Easy to grow. Days to bloom: 45-60.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'zinnia-california-giants', name: 'Zinnia - California Giants Mixed', emoji: '\u{1F33C}', type: 'flower',
        spacing: 15, daysToHarvest: 47, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -4, transplantAfterFrost: 1,
        directSow: 1, harvestWeeks: 14,
        companions: ['marigold', 'nasturtium', 'sunflower'],
        enemies: [],
        notes: 'Large dahlia-type flowers in wide range of bright shades. Long summer bloom. Remove faded blooms to extend season. Height 24-36". (Ferry-Morse)',
        seedStartInstructions: 'After frost, sow in open ground 1/4" deep. For earlier bloom, start indoors 4 weeks before. Germination 7-12 days. Thin/transplant at 3".',
        careNotes: 'Deadhead regularly. Great for cut flower arrangements. Days to bloom: 35-60.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'zinnia-state-fair', name: 'Zinnia - State Fair Giant Mixed', emoji: '\u{1F33C}', type: 'flower',
        spacing: 12, daysToHarvest: 47, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -4, transplantAfterFrost: 1,
        directSow: 1, harvestWeeks: 14,
        companions: ['marigold', 'nasturtium', 'sunflower'],
        enemies: [],
        notes: 'Half-hardy annual. Huge 4-6" blooms in luminous shades. Extremely vigorous. Height 2.5-4 ft. Many unique colors. (Ferry-Morse)',
        seedStartInstructions: 'After frost, sow in open ground 1/4" deep. For earlier bloom, start indoors 4 weeks before. Germination 5-10 days. Thin/transplant at 3".',
        careNotes: 'Great for tall garden borders and cut flowers. Deadhead regularly. Days to bloom: 35-60.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'nasturtium-alaska', name: 'Nasturtium - Alaska Mixed', emoji: '\u{1F33A}', type: 'flower',
        spacing: 10, daysToHarvest: 36, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 1, harvestWeeks: 14,
        companions: ['tomato', 'cucumber', 'cabbage', 'radish', 'green-beans'],
        enemies: [],
        notes: 'Bushy variety with green and white marbled leaves. Bright 2" blooms in yellow, orange, crimson. Edible flowers and leaves with peppery watercress taste. Height 16-18". (Ferry-Morse)',
        seedStartInstructions: 'After frost, sow in open ground 1/2" deep. Germination 7-14 days. Thin when 3" tall. Does not transplant well.',
        careNotes: 'Water sparingly. Not too fertile soil \u2014 rich soil favors leaves over flowers. Edible in salads.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'nasturtium-tall-single', name: 'Nasturtium - Tall Single Mixed', emoji: '\u{1F33A}', type: 'flower',
        spacing: 10, daysToHarvest: 36, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 1, harvestWeeks: 14,
        companions: ['tomato', 'cucumber', 'cabbage', 'radish', 'green-beans'],
        enemies: [],
        notes: 'Old-fashioned annual, climbs/sprawls. Fragrant flowers in sunny colors bloom until frost. Height up to 5 ft on support. Easy to grow. (Ferry-Morse)',
        seedStartInstructions: 'Direct seed after frost. Plant 1/2" deep in dry, well-drained location. Germination 8-12 days. Thin to 8-12" apart.',
        careNotes: 'Rich soil favors leaves, not flowers. Water sparingly. Can seed in fall for winter bloom in mild climates.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'hollyhock-summer-carnival', name: 'Hollyhock - Summer Carnival Mixed', emoji: '\u{1F338}', type: 'flower',
        spacing: 24, daysToHarvest: 100, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -7, transplantAfterFrost: 1,
        directSow: 1, harvestWeeks: 10,
        companions: ['marigold', 'zinnia', 'sunflower'],
        enemies: [],
        notes: 'Stunning flowering biennial. Bright 4" double blooms in pink, red, yellow. Lovely along fences and in cottage gardens. Reseeds annually. Height 4-6 ft. (Ferry-Morse)',
        seedStartInstructions: 'Sow in open ground after frost, or start indoors 6-8 weeks before in sunny window. Plant 1/4" deep. Germination 10-21 days. Transplant carefully.',
        careNotes: 'Stake in windy locations. Treat as biennial for best blooms. Days to bloom: ~100.',
        lowMaintenance: false,
        seedPacket: true
    },
    {
        id: 'wildflower-birds-butterfly', name: 'Wildflower - Birds & Butterfly Mix', emoji: '\u{1F33C}', type: 'flower',
        spacing: 6, daysToHarvest: 49, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 0, harvestWeeks: 20,
        companions: [],
        enemies: [],
        notes: 'Mix of annuals and perennials. Annuals bloom year 1, perennials year 2. Includes Centaurea, Calendula, Coreopsis, Delphinium, Dianthus, and more. Height 12-36". (Ferry-Morse)',
        seedStartInstructions: 'Broadcast thinly over prepared soil. Rake in lightly, no deeper than 1/8". Soak area and maintain moisture 4-6 weeks. Germination 7-21 days.',
        careNotes: 'Ideal for meadows, sunny slopes, low-maintenance areas. Min 4 hrs sun daily. Drought resistant once established. Mix 1:2 sand to seed for even distribution. Days to bloom: 42-56.',
        lowMaintenance: true,
        seedPacket: true
    },
    {
        id: 'collard-greens', name: 'Collard Greens', emoji: '\u{1F96C}', type: 'vegetable',
        spacing: 18, daysToHarvest: 65, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: -3,
        directSow: -4, harvestWeeks: 30,
        companions: ['tomato', 'pepper', 'onion', 'dill', 'nasturtium', 'marigold', 'sweet-alyssum', 'calendula'],
        enemies: ['strawberry', 'fennel'],
        notes: 'Heat-tolerant brassica. Harvest outer leaves for continuous production. Sweeter after light frost.',
        seedStartInstructions: 'Start indoors 6-8 weeks before last frost (early March). Plant 1/4" deep. Transplant out 3 weeks before last frost when seedlings have 4 true leaves.',
        careNotes: 'Water 1-1.5" per week. Mulch to retain moisture. Side-dress with compost monthly. Watch for cabbage worms — companion plant with nasturtium/marigold.',
        lowMaintenance: true
    },
    {
        id: 'butternut-squash', name: 'Butternut Squash', emoji: '\u{1F33D}', type: 'vegetable',
        spacing: 36, daysToHarvest: 110, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -3, transplantAfterFrost: 2,
        directSow: 1, harvestWeeks: 4,
        companions: ['nasturtium', 'green-beans', 'corn', 'marigold', 'oregano', 'borage', 'radish', 'sunflower'],
        enemies: ['potato', 'cucumber', 'cantaloupe'],
        notes: 'Stores 3-6 months in cool dry area. Cure 2 weeks in sun after harvest. Excellent food bank crop.',
        seedStartInstructions: 'Start indoors 3-4 weeks before last frost (late March). Plant 1" deep. Transplant 2 weeks after last frost when soil is 65°F+.',
        careNotes: 'Needs space — vines sprawl 8-12 ft. Water deeply at base, avoid wetting leaves. Hand-pollinate if few bees. Harvest when stem is dry and corky.',
        lowMaintenance: false
    },
    {
        id: 'sweet-alyssum', name: 'Sweet Alyssum', emoji: '\u{1F33C}', type: 'flower',
        spacing: 8, daysToHarvest: 50, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: -1,
        directSow: -2, harvestWeeks: 20,
        companions: ['tomato', 'pepper', 'kale', 'collard-greens', 'broccoli', 'cabbage', 'lettuce', 'potato'],
        enemies: [],
        notes: 'Living mulch & beneficial insect magnet. Low-growing carpet covers bare soil. Attracts hoverflies and parasitic wasps that eat aphids.',
        seedStartInstructions: 'Start indoors 6 weeks before last frost (mid-March) or direct sow 2 weeks before last frost. Surface sow — needs light to germinate.',
        careNotes: 'Almost zero maintenance. Shear back by half if it gets leggy mid-summer — rebounds in 2 weeks. Self-seeds freely.',
        lowMaintenance: true
    },
    {
        id: 'calendula', name: 'Calendula', emoji: '\u{1F33B}', type: 'flower',
        spacing: 10, daysToHarvest: 45, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: -2,
        directSow: -2, harvestWeeks: 16,
        companions: ['tomato', 'pepper', 'carrot', 'green-beans', 'strawberry', 'kale', 'cabbage', 'broccoli'],
        enemies: [],
        notes: 'Edible flowers. Trap crop for aphids — protects neighboring veggies. Petals make tea or salve.',
        seedStartInstructions: 'Start indoors 6 weeks before last frost or direct sow 2 weeks before last frost. Plant 1/4" deep. Germinates best in cool soil.',
        careNotes: 'Deadhead regularly to extend bloom season. Tolerates light frost. Self-seeds prolifically — pull volunteers where unwanted.',
        lowMaintenance: true
    }
];

// ---- DEMO DATA (inlined to avoid fetch() failure on file:// protocol) ----
// Classic FNB demo — original 4 raised bed layout
const DEMO_CLASSIC = {
    "version": 1, "exportDate": "2025-06-15T12:00:00.000Z", "app": "GardenSync // Food Not Bombs Canton", "isDemo": true,
    "state": {
        "beds": [
            [
                {"id":"tomato-demo-001","plantId":"tomato","x":20,"y":20},{"id":"tomato-demo-002","plantId":"tomato","x":80,"y":20},
                {"id":"tomato-demo-003","plantId":"tomato","x":140,"y":20},{"id":"tomato-demo-004","plantId":"tomato","x":200,"y":20},
                {"id":"basil-demo-001","plantId":"basil","x":40,"y":80},{"id":"basil-demo-002","plantId":"basil","x":100,"y":80},
                {"id":"basil-demo-003","plantId":"basil","x":160,"y":80},{"id":"marigold-demo-001","plantId":"marigold","x":260,"y":20},
                {"id":"marigold-demo-002","plantId":"marigold","x":260,"y":80},{"id":"pepper-demo-001","plantId":"pepper","x":300,"y":40},
                {"id":"pepper-demo-002","plantId":"pepper","x":340,"y":40},{"id":"carrot-demo-001","plantId":"carrot","x":20,"y":140},
                {"id":"carrot-demo-002","plantId":"carrot","x":40,"y":140},{"id":"carrot-demo-003","plantId":"carrot","x":60,"y":140},
                {"id":"carrot-demo-004","plantId":"carrot","x":80,"y":140},{"id":"carrot-demo-005","plantId":"carrot","x":100,"y":140},
                {"id":"carrot-demo-006","plantId":"carrot","x":120,"y":140},{"id":"onion-demo-001","plantId":"onion","x":20,"y":180},
                {"id":"onion-demo-002","plantId":"onion","x":40,"y":180},{"id":"onion-demo-003","plantId":"onion","x":60,"y":180},
                {"id":"onion-demo-004","plantId":"onion","x":80,"y":180},{"id":"onion-demo-005","plantId":"onion","x":100,"y":180}
            ],
            [
                {"id":"lettuce-demo-001","plantId":"lettuce","x":20,"y":20},{"id":"lettuce-demo-002","plantId":"lettuce","x":60,"y":20},
                {"id":"lettuce-demo-003","plantId":"lettuce","x":100,"y":20},{"id":"lettuce-demo-004","plantId":"lettuce","x":140,"y":20},
                {"id":"spinach-demo-001","plantId":"spinach","x":20,"y":60},{"id":"spinach-demo-002","plantId":"spinach","x":40,"y":60},
                {"id":"spinach-demo-003","plantId":"spinach","x":60,"y":60},{"id":"spinach-demo-004","plantId":"spinach","x":80,"y":60},
                {"id":"spinach-demo-005","plantId":"spinach","x":100,"y":60},{"id":"spinach-demo-006","plantId":"spinach","x":120,"y":60},
                {"id":"radish-demo-001","plantId":"radish","x":180,"y":20},{"id":"radish-demo-002","plantId":"radish","x":200,"y":20},
                {"id":"radish-demo-003","plantId":"radish","x":220,"y":20},{"id":"radish-demo-004","plantId":"radish","x":180,"y":40},
                {"id":"radish-demo-005","plantId":"radish","x":200,"y":40},{"id":"radish-demo-006","plantId":"radish","x":220,"y":40},
                {"id":"kale-demo-001","plantId":"kale","x":280,"y":20},{"id":"kale-demo-002","plantId":"kale","x":340,"y":20},
                {"id":"kale-demo-003","plantId":"kale","x":280,"y":80},{"id":"chive-demo-001","plantId":"chive","x":160,"y":120},
                {"id":"chive-demo-002","plantId":"chive","x":200,"y":120},{"id":"strawberry-demo-001","plantId":"strawberry","x":20,"y":120},
                {"id":"strawberry-demo-002","plantId":"strawberry","x":60,"y":120},{"id":"strawberry-demo-003","plantId":"strawberry","x":100,"y":120},
                {"id":"strawberry-demo-004","plantId":"strawberry","x":20,"y":160},{"id":"strawberry-demo-005","plantId":"strawberry","x":60,"y":160},
                {"id":"strawberry-demo-006","plantId":"strawberry","x":100,"y":160}
            ],
            [
                {"id":"green-beans-demo-001","plantId":"green-beans","x":20,"y":20},{"id":"green-beans-demo-002","plantId":"green-beans","x":40,"y":20},
                {"id":"green-beans-demo-003","plantId":"green-beans","x":60,"y":20},{"id":"green-beans-demo-004","plantId":"green-beans","x":80,"y":20},
                {"id":"green-beans-demo-005","plantId":"green-beans","x":100,"y":20},{"id":"green-beans-demo-006","plantId":"green-beans","x":120,"y":20},
                {"id":"green-beans-demo-007","plantId":"green-beans","x":140,"y":20},{"id":"green-beans-demo-008","plantId":"green-beans","x":160,"y":20},
                {"id":"cucumber-demo-001","plantId":"cucumber","x":220,"y":20},{"id":"cucumber-demo-002","plantId":"cucumber","x":280,"y":20},
                {"id":"cucumber-demo-003","plantId":"cucumber","x":340,"y":20},{"id":"zucchini-demo-001","plantId":"zucchini","x":20,"y":100},
                {"id":"zucchini-demo-002","plantId":"zucchini","x":80,"y":100},{"id":"nasturtium-demo-001","plantId":"nasturtium","x":160,"y":100},
                {"id":"nasturtium-demo-002","plantId":"nasturtium","x":200,"y":100},{"id":"nasturtium-demo-003","plantId":"nasturtium","x":240,"y":100},
                {"id":"sunflower-demo-001","plantId":"sunflower","x":320,"y":100},{"id":"sunflower-demo-002","plantId":"sunflower","x":360,"y":100},
                {"id":"dill-demo-001","plantId":"dill","x":160,"y":160},{"id":"dill-demo-002","plantId":"dill","x":200,"y":160},
                {"id":"dill-demo-003","plantId":"dill","x":240,"y":160}
            ],
            [
                {"id":"garlic-demo-001","plantId":"garlic","x":20,"y":20},{"id":"garlic-demo-002","plantId":"garlic","x":40,"y":20},
                {"id":"garlic-demo-003","plantId":"garlic","x":60,"y":20},{"id":"garlic-demo-004","plantId":"garlic","x":80,"y":20},
                {"id":"garlic-demo-005","plantId":"garlic","x":100,"y":20},{"id":"garlic-demo-006","plantId":"garlic","x":120,"y":20},
                {"id":"garlic-demo-007","plantId":"garlic","x":140,"y":20},{"id":"garlic-demo-008","plantId":"garlic","x":160,"y":20},
                {"id":"garlic-demo-009","plantId":"garlic","x":180,"y":20},{"id":"garlic-demo-010","plantId":"garlic","x":200,"y":20},
                {"id":"thyme-demo-001","plantId":"thyme","x":20,"y":80},{"id":"thyme-demo-002","plantId":"thyme","x":60,"y":80},
                {"id":"thyme-demo-003","plantId":"thyme","x":100,"y":80},{"id":"mint-demo-001","plantId":"mint","x":240,"y":20},
                {"id":"mint-demo-002","plantId":"mint","x":280,"y":20},{"id":"sweet-peas-demo-001","plantId":"sweet-peas","x":20,"y":140},
                {"id":"sweet-peas-demo-002","plantId":"sweet-peas","x":40,"y":140},{"id":"sweet-peas-demo-003","plantId":"sweet-peas","x":60,"y":140},
                {"id":"sweet-peas-demo-004","plantId":"sweet-peas","x":80,"y":140},{"id":"sweet-peas-demo-005","plantId":"sweet-peas","x":100,"y":140},
                {"id":"sweet-peas-demo-006","plantId":"sweet-peas","x":120,"y":140},{"id":"marigold-demo-d01","plantId":"marigold","x":280,"y":80},
                {"id":"marigold-demo-d02","plantId":"marigold","x":320,"y":80},{"id":"marigold-demo-d03","plantId":"marigold","x":360,"y":80},
                {"id":"cantaloupe-demo-001","plantId":"cantaloupe","x":200,"y":120}
            ]
        ],
        "volunteers": [
            {"id":"vol-1","name":"Stewart G.","phone":"330-555-0101","availability":"high"},
            {"id":"vol-2","name":"Maria L.","phone":"330-555-0202","availability":"medium"},
            {"id":"vol-3","name":"Jamal W.","phone":"330-555-0303","availability":"high"},
            {"id":"vol-4","name":"Sage R.","phone":"330-555-0404","availability":"low"},
            {"id":"vol-5","name":"Devon C.","phone":"330-555-0505","availability":"medium"}
        ],
        "bedAssignments": ["vol-1","vol-2","vol-3","vol-4"]
    },
    "plantingLog": {},
    "harvests": [
        {"id":"h-001","plant":"lettuce","bed":"2","weight":"2.5","date":"2025-05-15","notes":"First spring harvest! Beautiful heads.","donated":"yes"},
        {"id":"h-002","plant":"radish","bed":"2","weight":"1.2","date":"2025-05-20","notes":"Cherry Belle variety, super crunchy.","donated":"yes"},
        {"id":"h-003","plant":"spinach","bed":"2","weight":"3.1","date":"2025-05-25","notes":"Big haul before the heat hits.","donated":"yes"},
        {"id":"h-004","plant":"strawberry","bed":"2","weight":"1.8","date":"2025-06-01","notes":"First berries of the year!","donated":"partial"},
        {"id":"h-005","plant":"lettuce","bed":"2","weight":"2.0","date":"2025-06-05","notes":"Second succession planting.","donated":"yes"},
        {"id":"h-006","plant":"green-beans","bed":"3","weight":"4.2","date":"2025-06-20","notes":"Bush beans going crazy.","donated":"yes"},
        {"id":"h-007","plant":"zucchini","bed":"3","weight":"6.5","date":"2025-06-25","notes":"Two massive zukes. Should have picked smaller.","donated":"yes"},
        {"id":"h-008","plant":"cucumber","bed":"3","weight":"3.0","date":"2025-07-01","notes":"Fresh cukes for FNB meal!","donated":"yes"},
        {"id":"h-009","plant":"tomato","bed":"1","weight":"8.5","date":"2025-07-15","notes":"Tomato avalanche begins.","donated":"yes"},
        {"id":"h-010","plant":"basil","bed":"1","weight":"0.5","date":"2025-07-15","notes":"Huge basil harvest, made pesto.","donated":"partial"},
        {"id":"h-011","plant":"pepper","bed":"1","weight":"2.3","date":"2025-07-20","notes":"Green peppers, left some to ripen red.","donated":"yes"},
        {"id":"h-012","plant":"kale","bed":"2","weight":"3.8","date":"2025-07-25","notes":"Kale just keeps giving.","donated":"yes"},
        {"id":"h-013","plant":"tomato","bed":"1","weight":"12.0","date":"2025-08-01","notes":"Peak tomato season. So many romas.","donated":"yes"},
        {"id":"h-014","plant":"zucchini","bed":"3","weight":"5.0","date":"2025-08-05","notes":"Leaving zukes on neighbors porches at this point.","donated":"yes"},
        {"id":"h-015","plant":"green-beans","bed":"3","weight":"3.5","date":"2025-08-10","notes":"Second flush of beans.","donated":"yes"}
    ],
    "journal": {
        "bed-0": [
            {"id":1001,"text":"Transplanted tomato starts from Mahoning Valley greenhouse","date":"2025-05-05T14:00:00.000Z"},
            {"id":1002,"text":"Added basil companions between tomato rows","date":"2025-05-10T10:00:00.000Z"},
            {"id":1003,"text":"Staked all tomatoes, used Florida weave method","date":"2025-05-20T16:00:00.000Z"},
            {"id":1004,"text":"First tomato flowers appearing!","date":"2025-06-08T09:00:00.000Z"},
            {"id":1005,"text":"Side-dressed with compost. Plants looking strong.","date":"2025-06-25T11:00:00.000Z"}
        ],
        "bed-1": [
            {"id":2001,"text":"Direct-sowed lettuce and spinach mix","date":"2025-04-01T08:00:00.000Z"},
            {"id":2002,"text":"Radish seeds in between rows as markers","date":"2025-04-01T08:30:00.000Z"},
            {"id":2003,"text":"Planted strawberry bare roots along south edge","date":"2025-04-15T10:00:00.000Z"},
            {"id":2004,"text":"Transplanted kale starts from indoor seed trays","date":"2025-04-20T14:00:00.000Z"},
            {"id":2005,"text":"Added shade cloth before heat wave","date":"2025-06-15T07:00:00.000Z"}
        ],
        "bed-2": [
            {"id":3001,"text":"Direct-sowed bush beans after last frost","date":"2025-04-25T09:00:00.000Z"},
            {"id":3002,"text":"Transplanted cucumber starts with trellis","date":"2025-05-05T11:00:00.000Z"},
            {"id":3003,"text":"Zucchini going wild, hand-pollinating female flowers","date":"2025-06-10T08:00:00.000Z"},
            {"id":3004,"text":"Nasturtiums attracting aphids away from cukes - working great!","date":"2025-06-20T15:00:00.000Z"}
        ],
        "bed-3": [
            {"id":4001,"text":"Garlic planted last October, scapes appearing","date":"2025-06-01T10:00:00.000Z"},
            {"id":4002,"text":"Removed garlic scapes - will use in FNB stir fry","date":"2025-06-10T09:00:00.000Z"},
            {"id":4003,"text":"Sweet peas blooming beautifully on trellis","date":"2025-06-15T16:00:00.000Z"},
            {"id":4004,"text":"Thyme spreading nicely as ground cover between beds","date":"2025-06-20T12:00:00.000Z"},
            {"id":4005,"text":"Mint in sunken pots - NOT letting it escape this year","date":"2025-05-01T14:00:00.000Z"}
        ]
    },
    "completedTasks": {},
    "bedNames": ["SALSA GARDEN", "COOL GREENS", "THREE SISTERS+", "HERB SPIRAL"],
    "harvestGoal": 150,
    "geminiKey": ""
};

// Showcase demo — all 7 container types, v2 native format
const DEMO_SHOWCASE = {
    "version": 2, "exportDate": "2026-03-05T12:00:00.000Z", "app": "GardenSync // Food Not Bombs Canton", "isDemo": true,
    "state": {
        "containers": [
            {
                "id": "demo2-raised-1", "type": "raised-bed", "name": "MAIN VEGGIE BED",
                "canvasX": 40, "canvasY": 40, "w": 5, "h": 10, "diameter": null,
                "plants": [
                    {"id":"d2-tomato-1","plantId":"tomato","x":20,"y":20},{"id":"d2-tomato-2","plantId":"tomato","x":80,"y":20},
                    {"id":"d2-tomato-3","plantId":"tomato","x":140,"y":20},{"id":"d2-tomato-4","plantId":"tomato","x":200,"y":20},
                    {"id":"d2-basil-1","plantId":"basil","x":40,"y":70},{"id":"d2-basil-2","plantId":"basil","x":100,"y":70},
                    {"id":"d2-basil-3","plantId":"basil","x":160,"y":70},
                    {"id":"d2-pepper-1","plantId":"pepper","x":260,"y":30},{"id":"d2-pepper-2","plantId":"pepper","x":310,"y":30},
                    {"id":"d2-marigold-1","plantId":"marigold","x":260,"y":100},{"id":"d2-marigold-2","plantId":"marigold","x":310,"y":100},
                    {"id":"d2-carrot-1","plantId":"carrot","x":20,"y":130},{"id":"d2-carrot-2","plantId":"carrot","x":40,"y":130},
                    {"id":"d2-carrot-3","plantId":"carrot","x":60,"y":130},{"id":"d2-carrot-4","plantId":"carrot","x":80,"y":130},
                    {"id":"d2-onion-1","plantId":"onion","x":20,"y":170},{"id":"d2-onion-2","plantId":"onion","x":40,"y":170},
                    {"id":"d2-onion-3","plantId":"onion","x":60,"y":170}
                ],
                "notes": "Main production bed — tomatoes, peppers, root veg", "volunteer": null
            },
            {
                "id": "demo2-raised-2", "type": "raised-bed", "name": "SALAD BAR",
                "canvasX": 40, "canvasY": 290, "w": 4, "h": 8, "diameter": null,
                "plants": [
                    {"id":"d2-lettuce-1","plantId":"lettuce","x":20,"y":20},{"id":"d2-lettuce-2","plantId":"lettuce","x":60,"y":20},
                    {"id":"d2-lettuce-3","plantId":"lettuce","x":100,"y":20},{"id":"d2-lettuce-4","plantId":"lettuce","x":140,"y":20},
                    {"id":"d2-spinach-1","plantId":"spinach","x":20,"y":60},{"id":"d2-spinach-2","plantId":"spinach","x":50,"y":60},
                    {"id":"d2-spinach-3","plantId":"spinach","x":80,"y":60},{"id":"d2-spinach-4","plantId":"spinach","x":110,"y":60},
                    {"id":"d2-radish-1","plantId":"radish","x":160,"y":20},{"id":"d2-radish-2","plantId":"radish","x":180,"y":20},
                    {"id":"d2-radish-3","plantId":"radish","x":160,"y":40},{"id":"d2-radish-4","plantId":"radish","x":180,"y":40},
                    {"id":"d2-kale-1","plantId":"kale","x":230,"y":20},{"id":"d2-kale-2","plantId":"kale","x":270,"y":20},
                    {"id":"d2-strawberry-1","plantId":"strawberry","x":20,"y":110},{"id":"d2-strawberry-2","plantId":"strawberry","x":60,"y":110},
                    {"id":"d2-strawberry-3","plantId":"strawberry","x":100,"y":110}
                ],
                "notes": "Cool-season greens + strawberry border", "volunteer": null
            },
            {
                "id": "demo2-planter-1", "type": "planter", "name": "HERB PLANTER",
                "canvasX": 410, "canvasY": 290, "w": 1, "h": 4, "diameter": null,
                "plants": [
                    {"id":"d2-basil-p1","plantId":"basil","x":8,"y":10},
                    {"id":"d2-parsley-1","plantId":"parsley","x":8,"y":50},
                    {"id":"d2-cilantro-1","plantId":"cilantro","x":8,"y":90},
                    {"id":"d2-chive-1","plantId":"chive","x":8,"y":130}
                ],
                "notes": "Kitchen herb planter by the back door", "volunteer": null
            },
            {
                "id": "demo2-planter-2", "type": "planter", "name": "SALSA STRIP",
                "canvasX": 410, "canvasY": 500, "w": 1, "h": 3, "diameter": null,
                "plants": [
                    {"id":"d2-pepper-p1","plantId":"pepper","x":8,"y":15},
                    {"id":"d2-cilantro-p1","plantId":"cilantro","x":8,"y":55},
                    {"id":"d2-onion-p1","plantId":"onion","x":8,"y":90}
                ],
                "notes": "Salsa ingredients right by the grill", "volunteer": null
            },
            {
                "id": "demo2-pot-1", "type": "pot-round", "name": "ROSEMARY POT",
                "canvasX": 490, "canvasY": 40, "w": null, "h": null, "diameter": 1.5,
                "plants": [
                    {"id":"d2-rosemary-1","plantId":"rosemary","x":12,"y":12}
                ],
                "notes": "Terracotta pot — overwinters in garage", "volunteer": null
            },
            {
                "id": "demo2-pot-2", "type": "pot-round", "name": "MINT JAR",
                "canvasX": 780, "canvasY": 290, "w": null, "h": null, "diameter": 1.5,
                "plants": [
                    {"id":"d2-mint-1","plantId":"mint","x":12,"y":12}
                ],
                "notes": "Contained so it doesn't take over!", "volunteer": null
            },
            {
                "id": "demo2-growbag-1", "type": "grow-bag", "name": "TOMATO BAG",
                "canvasX": 660, "canvasY": 40, "w": null, "h": null, "diameter": 2,
                "plants": [
                    {"id":"d2-tomato-gb1","plantId":"tomato","x":18,"y":18}
                ],
                "notes": "10-gal grow bag — cherry tomatoes on patio", "volunteer": null
            },
            {
                "id": "demo2-growbag-2", "type": "grow-bag", "name": "PEPPER BAG",
                "canvasX": 700, "canvasY": 500, "w": null, "h": null, "diameter": 1.5,
                "plants": [
                    {"id":"d2-pepper-gb1","plantId":"pepper","x":12,"y":12}
                ],
                "notes": "7-gal grow bag — jalapeños", "volunteer": null
            },
            {
                "id": "demo2-inground-1", "type": "in-ground", "name": "SQUASH PATCH",
                "canvasX": 40, "canvasY": 500, "w": 6, "h": 8, "diameter": null,
                "plants": [
                    {"id":"d2-zucchini-1","plantId":"zucchini","x":30,"y":30},{"id":"d2-zucchini-2","plantId":"zucchini","x":130,"y":30},
                    {"id":"d2-cucumber-1","plantId":"cucumber","x":30,"y":110},{"id":"d2-cucumber-2","plantId":"cucumber","x":130,"y":110},
                    {"id":"d2-nasturtium-1","plantId":"nasturtium","x":80,"y":70},
                    {"id":"d2-sunflower-1","plantId":"sunflower","x":200,"y":30},{"id":"d2-sunflower-2","plantId":"sunflower","x":200,"y":110},
                    {"id":"d2-corn-1","plantId":"corn","x":30,"y":190},{"id":"d2-corn-2","plantId":"corn","x":70,"y":190},
                    {"id":"d2-corn-3","plantId":"corn","x":110,"y":190},{"id":"d2-corn-4","plantId":"corn","x":150,"y":190},
                    {"id":"d2-green-beans-1","plantId":"green-beans","x":30,"y":240},{"id":"d2-green-beans-2","plantId":"green-beans","x":60,"y":240},
                    {"id":"d2-green-beans-3","plantId":"green-beans","x":90,"y":240},{"id":"d2-green-beans-4","plantId":"green-beans","x":120,"y":240}
                ],
                "notes": "Direct in-ground area — three sisters planting", "volunteer": null
            },
            {
                "id": "demo2-window-1", "type": "window-box", "name": "KITCHEN WINDOW",
                "canvasX": 40, "canvasY": 790, "w": 0.5, "h": 3, "diameter": null,
                "plants": [
                    {"id":"d2-oregano-1","plantId":"oregano","x":4,"y":12},
                    {"id":"d2-thyme-1","plantId":"thyme","x":4,"y":52},
                    {"id":"d2-chive-w1","plantId":"chive","x":4,"y":92}
                ],
                "notes": "Mounted under kitchen window — herbs within arm's reach", "volunteer": null
            },
            {
                "id": "demo2-potato-1", "type": "potato-tower", "name": "POTATO TOWER",
                "canvasX": 330, "canvasY": 790, "w": null, "h": null, "diameter": 2,
                "plants": [
                    {"id":"d2-potato-1","plantId":"potato","x":15,"y":15},
                    {"id":"d2-potato-2","plantId":"potato","x":35,"y":35},
                    {"id":"d2-potato-3","plantId":"potato","x":55,"y":15}
                ],
                "notes": "Wire tower with straw — Yukon Gold", "volunteer": null
            }
        ],
        "volunteers": [
            {"id":"vol-1","name":"Stewart G.","phone":"330-555-0101","availability":"high"},
            {"id":"vol-2","name":"Maria L.","phone":"330-555-0202","availability":"medium"},
            {"id":"vol-3","name":"Jamal W.","phone":"330-555-0303","availability":"high"}
        ],
        "bedAssignments": {}
    },
    "plantingLog": {},
    "harvests": [],
    "journal": {},
    "completedTasks": {},
    "harvestGoal": 200,
    "geminiKey": ""
};

// ---- DEMO 3: THREE SISTERS COMPANION GARDEN ----
const DEMO_THREE_SISTERS = {
    "version": 2, "exportDate": "2026-03-06T12:00:00.000Z",
    "app": "GardenSync // Food Not Bombs Canton", "isDemo": true,
    "state": {
        "containers": [
            {
                "id": "d3-inground-1", "type": "in-ground", "name": "THREE SISTERS MOUND A",
                "canvasX": 40, "canvasY": 40, "w": 8, "h": 10, "diameter": null,
                "plants": [
                    {"id":"d3-corn-1","plantId":"corn","x":60,"y":40},{"id":"d3-corn-2","plantId":"corn","x":120,"y":40},
                    {"id":"d3-corn-3","plantId":"corn","x":180,"y":40},{"id":"d3-corn-4","plantId":"corn","x":240,"y":40},
                    {"id":"d3-corn-5","plantId":"corn","x":60,"y":120},{"id":"d3-corn-6","plantId":"corn","x":120,"y":120},
                    {"id":"d3-corn-7","plantId":"corn","x":180,"y":120},{"id":"d3-corn-8","plantId":"corn","x":240,"y":120},
                    {"id":"d3-bean-1","plantId":"green-beans","x":40,"y":80},{"id":"d3-bean-2","plantId":"green-beans","x":100,"y":80},
                    {"id":"d3-bean-3","plantId":"green-beans","x":160,"y":80},{"id":"d3-bean-4","plantId":"green-beans","x":220,"y":80},
                    {"id":"d3-bean-5","plantId":"green-beans","x":280,"y":80},
                    {"id":"d3-zuc-1","plantId":"zucchini","x":50,"y":180},{"id":"d3-zuc-2","plantId":"zucchini","x":150,"y":180},
                    {"id":"d3-zuc-3","plantId":"zucchini","x":250,"y":180},
                    {"id":"d3-sunfl-1","plantId":"sunflower","x":320,"y":40},{"id":"d3-sunfl-2","plantId":"sunflower","x":320,"y":120},
                    {"id":"d3-nastur-1","plantId":"nasturtium","x":50,"y":240},{"id":"d3-nastur-2","plantId":"nasturtium","x":150,"y":240}
                ],
                "notes": "Three Sisters: corn stalks support beans, beans fix nitrogen for corn, squash leaves shade soil & deter pests", "volunteer": null
            },
            {
                "id": "d3-inground-2", "type": "in-ground", "name": "THREE SISTERS MOUND B",
                "canvasX": 490, "canvasY": 40, "w": 8, "h": 10, "diameter": null,
                "plants": [
                    {"id":"d3b-corn-1","plantId":"corn","x":60,"y":40},{"id":"d3b-corn-2","plantId":"corn","x":120,"y":40},
                    {"id":"d3b-corn-3","plantId":"corn","x":180,"y":40},{"id":"d3b-corn-4","plantId":"corn","x":240,"y":40},
                    {"id":"d3b-corn-5","plantId":"corn","x":60,"y":120},{"id":"d3b-corn-6","plantId":"corn","x":120,"y":120},
                    {"id":"d3b-corn-7","plantId":"corn","x":180,"y":120},{"id":"d3b-corn-8","plantId":"corn","x":240,"y":120},
                    {"id":"d3b-bean-1","plantId":"green-beans","x":40,"y":80},{"id":"d3b-bean-2","plantId":"green-beans","x":100,"y":80},
                    {"id":"d3b-bean-3","plantId":"green-beans","x":160,"y":80},{"id":"d3b-bean-4","plantId":"green-beans","x":220,"y":80},
                    {"id":"d3b-cuke-1","plantId":"cucumber","x":50,"y":180},{"id":"d3b-cuke-2","plantId":"cucumber","x":150,"y":180},
                    {"id":"d3b-cuke-3","plantId":"cucumber","x":250,"y":180},
                    {"id":"d3b-marig-1","plantId":"marigold","x":320,"y":60},{"id":"d3b-marig-2","plantId":"marigold","x":320,"y":160},
                    {"id":"d3b-borage-1","plantId":"borage","x":50,"y":240}
                ],
                "notes": "Variation with cucumbers instead of squash — borage attracts pollinators, marigolds repel beetles", "volunteer": null
            },
            {
                "id": "d3-raised-1", "type": "raised-bed", "name": "COMPANION ROOT VEG",
                "canvasX": 40, "canvasY": 410, "w": 4, "h": 8, "diameter": null,
                "plants": [
                    {"id":"d3-carrot-1","plantId":"carrot","x":20,"y":20},{"id":"d3-carrot-2","plantId":"carrot","x":40,"y":20},
                    {"id":"d3-carrot-3","plantId":"carrot","x":60,"y":20},{"id":"d3-carrot-4","plantId":"carrot","x":80,"y":20},
                    {"id":"d3-onion-1","plantId":"onion","x":20,"y":50},{"id":"d3-onion-2","plantId":"onion","x":40,"y":50},
                    {"id":"d3-onion-3","plantId":"onion","x":60,"y":50},{"id":"d3-onion-4","plantId":"onion","x":80,"y":50},
                    {"id":"d3-beet-1","plantId":"beet","x":120,"y":20},{"id":"d3-beet-2","plantId":"beet","x":140,"y":20},
                    {"id":"d3-beet-3","plantId":"beet","x":120,"y":50},{"id":"d3-beet-4","plantId":"beet","x":140,"y":50},
                    {"id":"d3-dill-1","plantId":"dill","x":180,"y":20},{"id":"d3-dill-2","plantId":"dill","x":200,"y":20},
                    {"id":"d3-chive-1","plantId":"chive","x":180,"y":50},
                    {"id":"d3-marig-3","plantId":"marigold","x":240,"y":20},{"id":"d3-marig-4","plantId":"marigold","x":240,"y":50}
                ],
                "notes": "Carrots + onions repel each other's pests, dill attracts beneficial wasps, marigolds deter nematodes", "volunteer": null
            },
            {
                "id": "d3-raised-2", "type": "raised-bed", "name": "TOMATO & BASIL BED",
                "canvasX": 410, "canvasY": 410, "w": 4, "h": 8, "diameter": null,
                "plants": [
                    {"id":"d3-tom-1","plantId":"tomato","x":30,"y":20},{"id":"d3-tom-2","plantId":"tomato","x":100,"y":20},
                    {"id":"d3-tom-3","plantId":"tomato","x":170,"y":20},{"id":"d3-tom-4","plantId":"tomato","x":240,"y":20},
                    {"id":"d3-basil-1","plantId":"basil","x":30,"y":60},{"id":"d3-basil-2","plantId":"basil","x":100,"y":60},
                    {"id":"d3-basil-3","plantId":"basil","x":170,"y":60},{"id":"d3-basil-4","plantId":"basil","x":240,"y":60},
                    {"id":"d3-pepper-1","plantId":"pepper","x":30,"y":100},{"id":"d3-pepper-2","plantId":"pepper","x":100,"y":100},
                    {"id":"d3-parsley-1","plantId":"parsley","x":170,"y":100},{"id":"d3-parsley-2","plantId":"parsley","x":240,"y":100},
                    {"id":"d3-marig-5","plantId":"marigold","x":30,"y":130},{"id":"d3-marig-6","plantId":"marigold","x":240,"y":130}
                ],
                "notes": "Classic companion trio — basil improves tomato flavor & repels aphids, marigolds protect from whiteflies", "volunteer": null
            }
        ],
        "volunteers": []
    },
    "plantingLog": {}, "harvests": [], "journal": {}, "completedTasks": {}, "harvestGoal": 150
};

// ---- DEMO 4: KITCHEN HERB PATIO ----
const DEMO_HERB_PATIO = {
    "version": 2, "exportDate": "2026-03-06T12:00:00.000Z",
    "app": "GardenSync // Food Not Bombs Canton", "isDemo": true,
    "state": {
        "containers": [
            {
                "id": "d4-window-1", "type": "window-box", "name": "KITCHEN WINDOW HERBS",
                "canvasX": 40, "canvasY": 40, "w": 0.5, "h": 3, "diameter": null,
                "plants": [
                    {"id":"d4-basil-1","plantId":"basil","x":4,"y":12},
                    {"id":"d4-parsley-1","plantId":"parsley","x":4,"y":52},
                    {"id":"d4-chive-1","plantId":"chive","x":4,"y":92}
                ],
                "notes": "Most-used cooking herbs right by the kitchen — snip and use daily", "volunteer": null
            },
            {
                "id": "d4-window-2", "type": "window-box", "name": "BEDROOM WINDOW HERBS",
                "canvasX": 330, "canvasY": 40, "w": 0.5, "h": 3, "diameter": null,
                "plants": [
                    {"id":"d4-thyme-1","plantId":"thyme","x":4,"y":12},
                    {"id":"d4-oregano-1","plantId":"oregano","x":4,"y":52},
                    {"id":"d4-cilantro-1","plantId":"cilantro","x":4,"y":92}
                ],
                "notes": "Mediterranean herbs that love full sun — thyme and oregano are drought tolerant", "volunteer": null
            },
            {
                "id": "d4-pot-rosemary", "type": "pot-round", "name": "ROSEMARY POT",
                "canvasX": 40, "canvasY": 160, "w": null, "h": null, "diameter": 1.5,
                "plants": [{"id":"d4-rosemary-1","plantId":"rosemary","x":12,"y":12}],
                "notes": "Terracotta pot — bring indoors before frost, needs full sun", "volunteer": null
            },
            {
                "id": "d4-pot-mint", "type": "pot-round", "name": "MINT (CONTAINED!)",
                "canvasX": 210, "canvasY": 160, "w": null, "h": null, "diameter": 1.5,
                "plants": [{"id":"d4-mint-1","plantId":"mint","x":12,"y":12}],
                "notes": "ALWAYS keep mint in a pot — it will take over your entire garden otherwise!", "volunteer": null
            },
            {
                "id": "d4-pot-basil", "type": "pot-round", "name": "THAI BASIL POT",
                "canvasX": 380, "canvasY": 160, "w": null, "h": null, "diameter": 1.5,
                "plants": [{"id":"d4-basil-2","plantId":"basil","x":12,"y":12}],
                "notes": "Dedicated basil pot for pesto — pinch flower buds to keep leaves growing", "volunteer": null
            },
            {
                "id": "d4-planter-1", "type": "planter", "name": "SALAD HERB PLANTER",
                "canvasX": 40, "canvasY": 330, "w": 1, "h": 4, "diameter": null,
                "plants": [
                    {"id":"d4-dill-1","plantId":"dill","x":8,"y":15},
                    {"id":"d4-cilantro-2","plantId":"cilantro","x":8,"y":55},
                    {"id":"d4-parsley-2","plantId":"parsley","x":8,"y":95},
                    {"id":"d4-borage-1","plantId":"borage","x":8,"y":135}
                ],
                "notes": "Salad garnish herbs — succession-plant cilantro every 3 weeks since it bolts fast", "volunteer": null
            },
            {
                "id": "d4-growbag-1", "type": "grow-bag", "name": "CHERRY TOMATO BAG",
                "canvasX": 410, "canvasY": 330, "w": null, "h": null, "diameter": 2,
                "plants": [
                    {"id":"d4-tomato-1","plantId":"tomato","x":18,"y":18},
                    {"id":"d4-basil-3","plantId":"basil","x":40,"y":40}
                ],
                "notes": "10-gal grow bag — basil planted at base is a classic tomato companion", "volunteer": null
            }
        ],
        "volunteers": []
    },
    "plantingLog": {}, "harvests": [], "journal": {}, "completedTasks": {}, "harvestGoal": 50
};

// ---- DEMO 5: BEGINNER STARTER GARDEN ----
const DEMO_BEGINNER = {
    "version": 2, "exportDate": "2026-03-06T12:00:00.000Z",
    "app": "GardenSync // Food Not Bombs Canton", "isDemo": true,
    "state": {
        "containers": [
            {
                "id": "d5-raised-1", "type": "raised-bed", "name": "EASY GREENS BED",
                "canvasX": 40, "canvasY": 40, "w": 4, "h": 4, "diameter": null,
                "plants": [
                    {"id":"d5-lettuce-1","plantId":"lettuce","x":20,"y":20},{"id":"d5-lettuce-2","plantId":"lettuce","x":60,"y":20},
                    {"id":"d5-lettuce-3","plantId":"lettuce","x":100,"y":20},
                    {"id":"d5-spinach-1","plantId":"spinach","x":20,"y":60},{"id":"d5-spinach-2","plantId":"spinach","x":60,"y":60},
                    {"id":"d5-spinach-3","plantId":"spinach","x":100,"y":60},
                    {"id":"d5-radish-1","plantId":"radish","x":20,"y":100},{"id":"d5-radish-2","plantId":"radish","x":40,"y":100},
                    {"id":"d5-radish-3","plantId":"radish","x":60,"y":100},{"id":"d5-radish-4","plantId":"radish","x":80,"y":100},
                    {"id":"d5-radish-5","plantId":"radish","x":100,"y":100},{"id":"d5-radish-6","plantId":"radish","x":120,"y":100},
                    {"id":"d5-marig-1","plantId":"marigold","x":140,"y":20},{"id":"d5-marig-2","plantId":"marigold","x":140,"y":60}
                ],
                "notes": "All fast-growing, beginner-friendly crops — radishes harvest in 25 days! Marigolds protect from pests", "volunteer": null
            },
            {
                "id": "d5-raised-2", "type": "raised-bed", "name": "SUMMER VEGGIES",
                "canvasX": 250, "canvasY": 40, "w": 4, "h": 4, "diameter": null,
                "plants": [
                    {"id":"d5-tomato-1","plantId":"tomato","x":30,"y":20},{"id":"d5-tomato-2","plantId":"tomato","x":90,"y":20},
                    {"id":"d5-basil-1","plantId":"basil","x":30,"y":60},{"id":"d5-basil-2","plantId":"basil","x":90,"y":60},
                    {"id":"d5-pepper-1","plantId":"pepper","x":30,"y":100},{"id":"d5-pepper-2","plantId":"pepper","x":90,"y":100},
                    {"id":"d5-marig-3","plantId":"marigold","x":130,"y":20},{"id":"d5-marig-4","plantId":"marigold","x":130,"y":100}
                ],
                "notes": "Tomato + basil is the #1 companion pair — basil repels aphids and may improve tomato flavor", "volunteer": null
            },
            {
                "id": "d5-growbag-1", "type": "grow-bag", "name": "ZUCCHINI BAG",
                "canvasX": 460, "canvasY": 40, "w": null, "h": null, "diameter": 2,
                "plants": [
                    {"id":"d5-zuc-1","plantId":"zucchini","x":20,"y":20},
                    {"id":"d5-nastur-1","plantId":"nasturtium","x":50,"y":50}
                ],
                "notes": "One zucchini plant produces LOTS — nasturtium is a trap crop for aphids", "volunteer": null
            },
            {
                "id": "d5-planter-1", "type": "planter", "name": "HERB STARTER",
                "canvasX": 40, "canvasY": 260, "w": 1, "h": 3, "diameter": null,
                "plants": [
                    {"id":"d5-basil-3","plantId":"basil","x":8,"y":15},
                    {"id":"d5-parsley-1","plantId":"parsley","x":8,"y":50},
                    {"id":"d5-chive-1","plantId":"chive","x":8,"y":85}
                ],
                "notes": "Start with these 3 easy herbs — all beginner-proof and great in the kitchen", "volunteer": null
            },
            {
                "id": "d5-pot-1", "type": "pot-round", "name": "STRAWBERRY POT",
                "canvasX": 330, "canvasY": 260, "w": null, "h": null, "diameter": 1.5,
                "plants": [
                    {"id":"d5-strawb-1","plantId":"strawberry","x":12,"y":12}
                ],
                "notes": "Everbearing strawberries produce all summer — great reward for a new gardener!", "volunteer": null
            }
        ],
        "volunteers": []
    },
    "plantingLog": {}, "harvests": [], "journal": {}, "completedTasks": {}, "harvestGoal": 75
};

// ---- DEMO 6: SALSA & PIZZA GARDEN ----
const DEMO_SALSA_PIZZA = {
    "version": 2, "exportDate": "2026-03-06T12:00:00.000Z",
    "app": "GardenSync // Food Not Bombs Canton", "isDemo": true,
    "state": {
        "containers": [
            {
                "id": "d6-raised-1", "type": "raised-bed", "name": "SALSA BED",
                "canvasX": 40, "canvasY": 40, "w": 5, "h": 8, "diameter": null,
                "plants": [
                    {"id":"d6-tom-1","plantId":"tomato","x":30,"y":20},{"id":"d6-tom-2","plantId":"tomato","x":100,"y":20},
                    {"id":"d6-tom-3","plantId":"tomato","x":170,"y":20},{"id":"d6-tom-4","plantId":"tomato","x":240,"y":20},
                    {"id":"d6-pepper-1","plantId":"pepper","x":30,"y":70},{"id":"d6-pepper-2","plantId":"pepper","x":100,"y":70},
                    {"id":"d6-pepper-3","plantId":"pepper","x":170,"y":70},
                    {"id":"d6-onion-1","plantId":"onion","x":30,"y":110},{"id":"d6-onion-2","plantId":"onion","x":50,"y":110},
                    {"id":"d6-onion-3","plantId":"onion","x":70,"y":110},{"id":"d6-onion-4","plantId":"onion","x":90,"y":110},
                    {"id":"d6-cilantro-1","plantId":"cilantro","x":140,"y":110},{"id":"d6-cilantro-2","plantId":"cilantro","x":170,"y":110},
                    {"id":"d6-garlic-1","plantId":"garlic","x":210,"y":110},{"id":"d6-garlic-2","plantId":"garlic","x":240,"y":110},
                    {"id":"d6-marig-1","plantId":"marigold","x":280,"y":20},{"id":"d6-marig-2","plantId":"marigold","x":280,"y":70}
                ],
                "notes": "Everything for fresh salsa — tomatoes, hot peppers, onions, cilantro, garlic. Marigolds keep pests away", "volunteer": null
            },
            {
                "id": "d6-raised-2", "type": "raised-bed", "name": "PIZZA GARDEN",
                "canvasX": 40, "canvasY": 290, "w": 4, "h": 6, "diameter": null,
                "plants": [
                    {"id":"d6-tom-5","plantId":"tomato","x":30,"y":20},{"id":"d6-tom-6","plantId":"tomato","x":90,"y":20},
                    {"id":"d6-tom-7","plantId":"tomato","x":150,"y":20},
                    {"id":"d6-basil-1","plantId":"basil","x":30,"y":60},{"id":"d6-basil-2","plantId":"basil","x":90,"y":60},
                    {"id":"d6-basil-3","plantId":"basil","x":150,"y":60},
                    {"id":"d6-oregano-1","plantId":"oregano","x":30,"y":100},{"id":"d6-oregano-2","plantId":"oregano","x":90,"y":100},
                    {"id":"d6-pepper-4","plantId":"pepper","x":150,"y":100},
                    {"id":"d6-parsley-1","plantId":"parsley","x":200,"y":20},{"id":"d6-parsley-2","plantId":"parsley","x":200,"y":60}
                ],
                "notes": "Grow your own pizza toppings — Roma tomatoes + basil + oregano + peppers. Classic Italian companion planting", "volunteer": null
            },
            {
                "id": "d6-planter-1", "type": "planter", "name": "GARNISH STRIP",
                "canvasX": 420, "canvasY": 40, "w": 1, "h": 3, "diameter": null,
                "plants": [
                    {"id":"d6-cilantro-3","plantId":"cilantro","x":8,"y":15},
                    {"id":"d6-chive-1","plantId":"chive","x":8,"y":55},
                    {"id":"d6-dill-1","plantId":"dill","x":8,"y":95}
                ],
                "notes": "Quick-snip garnishes — succession plant cilantro every 3 weeks", "volunteer": null
            },
            {
                "id": "d6-pot-1", "type": "pot-round", "name": "ROSEMARY POT",
                "canvasX": 420, "canvasY": 200, "w": null, "h": null, "diameter": 1.5,
                "plants": [{"id":"d6-rosemary-1","plantId":"rosemary","x":12,"y":12}],
                "notes": "Essential pizza herb — perennial that comes back every year in Zone 6+", "volunteer": null
            },
            {
                "id": "d6-growbag-1", "type": "grow-bag", "name": "EXTRA TOMATO BAG",
                "canvasX": 420, "canvasY": 370, "w": null, "h": null, "diameter": 2,
                "plants": [
                    {"id":"d6-tom-8","plantId":"tomato","x":18,"y":18},
                    {"id":"d6-basil-4","plantId":"basil","x":45,"y":45}
                ],
                "notes": "Cherry tomatoes for snacking — basil at the base is the ultimate companion", "volunteer": null
            }
        ],
        "volunteers": []
    },
    "plantingLog": {}, "harvests": [], "journal": {}, "completedTasks": {}, "harvestGoal": 100
};

// ---- DEMO 7: MY GARDEN (Stewart's actual garden layout) ----
// Display sizes (px) after boost logic — used to calculate spacing:
//   Main Bed 4×8  → 320×160       Oval Bed #1 2.5×4 → 160×100
//   Large Bed 4×6 → 240×160       Oval Bed #2 2.5×3 → 120×100
//   Metal Bed 3×4 → 160×120       Blueberry Pots 2.5' → 100×100
//   Wooden Planter 1×3 → 240×80 (boosted)    Grow Bags 2.5' → 100×100
//
// Layout from hand-drawn diagram rotated 90° CW (right=south→bottom):
//   NW: 2 wooden planters    N-center: oval bed    NE: fruit tree pot
//   W-center: large bed 4×6  Center: main bed 4×8  E: small beds + grow bags
//                                                   SE: fruit tree pot
// ---- OUR ACTUAL GARDEN — Empty (matches real physical layout) ----
const DEMO_OUR_GARDEN_EMPTY = {
    "version": 2, "exportDate": "2026-03-08T02:34:20.670Z",
    "app": "GardenSync // Food Not Bombs Canton", "isDemo": true,
    "state": {
        "containers": [
            { "id": "mg-wood-1", "type": "planter", "name": "HERB PLANTER", "canvasX": 80, "canvasY": 60, "w": 4, "h": 1, "diameter": null, "plants": [], "notes": "Weathered wooden planter box, narrow (~1×3 ft). NW corner. Perfect for herbs — basil, cilantro, parsley, dill.", "volunteer": null, "vertical": false },
            { "id": "mg-wood-2", "type": "planter", "name": "ONION PLANTER", "canvasX": 80, "canvasY": 140, "w": 4, "h": 1, "diameter": null, "plants": [], "notes": "Weathered wooden planter box, narrow (~1×3 ft). NW corner, below herb planter. Good for onions, garlic, shallots, or a strawberry row.", "volunteer": null, "vertical": false },
            { "id": "mg-sm-bed-2", "type": "raised-bed", "name": "OVAL BED #1 (2.5×4)", "canvasX": 320, "canvasY": 60, "w": 4, "h": 2, "diameter": null, "plants": [], "notes": "Galvanized oval raised bed, ~2.5×4 ft. North-center of garden. Deep enough for root veg or compact tomatoes.", "volunteer": null, "vertical": false },
            { "id": "mg-ftp-1", "type": "pot-round", "name": "BLUEBERRY POT #1", "canvasX": 820, "canvasY": 460, "w": null, "h": null, "diameter": 2.5, "plants": [], "notes": "Large round pot. NE corner. Keep well-watered in summer — pots dry out fast.", "volunteer": null },
            { "id": "mg-lg-bed-2", "type": "raised-bed", "name": "LARGE BED (4×8)", "canvasX": 60, "canvasY": 280, "w": 4, "h": 8, "diameter": null, "plants": [], "notes": "4×6 ft corrugated metal raised bed. West side of garden. Good for peppers, squash, greens, or a second round of climbing crops.", "volunteer": null, "vertical": true },
            { "id": "mg-lg-bed-1", "type": "raised-bed", "name": "MAIN BED (4×8)", "canvasX": 320, "canvasY": 280, "w": 8, "h": 4, "diameter": null, "plants": [], "notes": "4×8 ft corrugated metal raised bed with wooden A-frame trellis. Center of the garden — great for tomatoes, cucumbers, beans, and anything that climbs.", "volunteer": null, "vertical": true },
            { "id": "mg-sm-bed-1", "type": "raised-bed", "name": "METAL BED (3×4)", "canvasX": 610, "canvasY": 265, "w": 4, "h": 2, "diameter": null, "plants": [], "notes": "3×4 ft corrugated metal raised bed. East side, upper. Compact — good for greens, root veg, or dedicated herb space.", "volunteer": null, "vertical": false },
            { "id": "mg-sm-bed-3", "type": "raised-bed", "name": "OVAL BED #2 (2.5×3)", "canvasX": 600, "canvasY": 60, "w": 2, "h": 4, "diameter": null, "plants": [], "notes": "Galvanized oval raised bed, ~2.5×3 ft. East side. Good for lettuce, radishes, or herbs.", "volunteer": null },
            { "id": "mg-bag-1", "type": "grow-bag", "name": "GROW BAG #1", "canvasX": 1040, "canvasY": 360, "w": null, "h": null, "diameter": 1.5, "plants": [], "notes": "Black fabric grow bag. East side. Great root aeration — try potatoes, peppers, or compact tomatoes.", "volunteer": null },
            { "id": "mg-bag-2", "type": "grow-bag", "name": "GROW BAG #2", "canvasX": 1040, "canvasY": 460, "w": null, "h": null, "diameter": 1.5, "plants": [], "notes": "Black fabric grow bag. East side. Lightweight and portable — bring indoors if frost threatens.", "volunteer": null },
            { "id": "mg-bag-3", "type": "grow-bag", "name": "GROW BAG #3", "canvasX": 960, "canvasY": 460, "w": null, "h": null, "diameter": 1.5, "plants": [], "notes": "Black fabric grow bag. East side. Pair with Bag #4 for succession planting.", "volunteer": null },
            { "id": "mg-bag-4", "type": "grow-bag", "name": "GROW BAG #4", "canvasX": 960, "canvasY": 360, "w": null, "h": null, "diameter": 1.5, "plants": [], "notes": "Black fabric grow bag. East side. Easy to move around for optimal sun exposure.", "volunteer": null },
            { "id": "mg-ftp-2", "type": "pot-round", "name": "BLUEBERRY POT #2", "canvasX": 820, "canvasY": 260, "w": null, "h": null, "diameter": 2.5, "plants": [], "notes": "Large round pot. SE corner. Consider underplanting with strawberries at the base.", "volunteer": null },
            { "id": "mg-bed-copy-1", "type": "raised-bed", "name": "METAL BED (3×4) COPY", "canvasX": 610, "canvasY": 465, "w": 4, "h": 2, "diameter": null, "plants": [], "notes": "3×4 ft corrugated metal raised bed. East side, lower. Compact — good for greens, root veg, or dedicated herb space.", "volunteer": null, "vertical": false },
            { "id": "mg-pot-tomato", "type": "pot-round", "name": "TOMATO POT", "canvasX": 660, "canvasY": 160, "plants": [], "notes": "", "volunteer": null, "diameter": 1.5 },
            { "id": "mg-pot-round-3", "type": "pot-round", "name": "ROUND POT #3", "canvasX": 660, "canvasY": 380, "plants": [], "notes": "", "volunteer": null, "diameter": 1.5 },
            { "id": "mg-pot-lg-3", "type": "pot-round", "name": "LARGE POT #3", "canvasX": 360, "canvasY": 680, "w": null, "h": null, "diameter": 2.5, "plants": [], "notes": "Large round pot. South-center.", "volunteer": null },
            { "id": "mg-pot-lg-4", "type": "pot-round", "name": "LARGE POT #4", "canvasX": 80, "canvasY": 680, "w": null, "h": null, "diameter": 2.5, "plants": [], "notes": "Large round pot. SW corner.", "volunteer": null },
            { "id": "mg-pot-round-4", "type": "pot-round", "name": "ROUND POT #4", "canvasX": 660, "canvasY": 600, "plants": [], "notes": "", "volunteer": null, "diameter": 1.5 },
            { "id": "mg-planter-3", "type": "planter", "name": "PLANTER BOX #3", "canvasX": 620, "canvasY": 700, "w": 4, "h": 1, "diameter": null, "plants": [], "notes": "Wooden planter box, narrow (~1×3 ft). South side.", "volunteer": null, "vertical": false }
        ],
        "volunteers": []
    },
    "plantingLog": {}, "harvests": [], "journal": {}, "completedTasks": {}, "harvestGoal": 150
};

// ---- OUR ACTUAL GARDEN — Planted with ALL 36 custom seed packets ----
// Optimal companion planting layout for Zone 6a (Canton, OH)
//
// PLANTING STRATEGY:
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ HERB PLANTER (4×1)        — Basil, Parsley, Dill (herb row)               │
// │ ONION PLANTER (4×1)       — Onions + Arugula (tight-spacing companions)    │
// │ PLANTER BOX #3 (4×1)      — Wildflower & Calif Poppy border strip         │
// │                                                                            │
// │ MAIN BED (4×8, trellis)   — Tomato row + Cucumber on trellis + Basil +    │
// │                              Marigold + Nasturtium companions              │
// │ LARGE BED (4×8)           — Squash/Melon guild: Cantaloupe, Squash,       │
// │                              Cowpeas (N-fixer), Marigold/Nasturtium border │
// │                                                                            │
// │ OVAL BED #1 (2.5×4)       — Root veg: Carrots + Beets + Lettuce           │
// │ OVAL BED #2 (2×4)         — Cool greens: Peas, Spinach, Lettuce           │
// │ METAL BED (3×4)           — Tomato (Brandywine) + Basil + Marigold        │
// │ METAL BED COPY (3×4)      — Tomato (Better Boy) + Zinnia + Nasturtium     │
// │                                                                            │
// │ 4 GROW BAGS (1.5ft)       — 1 tomato variety each (Roma, Mortgage Lifter, │
// │                              Cherokee Purple, Better Boy)                  │
// │ 2 LARGE POTS (2.5ft)      — Hollyhock, Catnip (pollinator/pest control)   │
// │ 2 LARGE POTS (2.5ft)      — Cantaloupe, Pumpkin (sprawlers in big pots)   │
// │ 3 SMALL POTS (1.5ft)      — Zinnia, Nasturtium, Marigold (companion pots) │
// └─────────────────────────────────────────────────────────────────────────────┘
//
// Plant ID helper — generates n unique plant instances for a given plantId
function _pp(plantId, n) {
    const plants = [];
    for (let i = 0; i < n; i++) plants.push({
        id: `demo-${plantId}-${i}-${Math.random().toString(36).substr(2,7)}`,
        plantId: plantId, x: 0, y: 0
    });
    return plants;
}
// Merge multiple plant arrays
function _merge(/* ...arrays */) {
    const result = [];
    for (let i = 0; i < arguments.length; i++) result.push.apply(result, arguments[i]);
    return result;
}

const DEMO_OUR_GARDEN_PLANTED = {
    "version": 2, "exportDate": "2026-03-08T04:00:00.000Z",
    "app": "GardenSync // Food Not Bombs Canton", "isDemo": true,
    "state": {
        "containers": [
            // ═══════════════════════════════════════════════════════
            // HERB PLANTER (4×1 ft = 48×12 in) — Herbs that love tomatoes
            // Basil-Sweet (10"), Parsley (10"), Dill (9") — all fit single row
            // NOTE: Dill is enemy of tomato/carrot so isolated here, far from beds
            { "id": "mg-wood-1", "type": "planter", "name": "HERB PLANTER", "canvasX": 80, "canvasY": 60, "w": 4, "h": 1, "diameter": null,
              "plants": _merge(_pp('basil-sweet', 2), _pp('parsley-flat-italian', 1), _pp('dill-mammoth', 1)),
              "notes": "Herb row: 2× Sweet Basil, 1× Flat Italian Parsley, 1× Mammoth Dill. Dill kept away from tomato beds (enemy).", "volunteer": null, "vertical": false },

            // ONION PLANTER (4×1 ft) — Rosemary
            { "id": "mg-wood-2", "type": "planter", "name": "ONION PLANTER", "canvasX": 80, "canvasY": 140, "w": 4, "h": 1, "diameter": null,
              "plants": _pp('rosemary', 1),
              "notes": "1× Rosemary — perennial herb, companion to many veggies.", "volunteer": null, "vertical": false },

            // ═══════════════════════════════════════════════════════
            // OVAL BED #1 (4×2 ft = 48×24 in) — Root Veg Guild
            // Carrots (3"), Beets (4"), Lettuce (10") — all companions of each other
            // Beet companions: onion, garlic, lettuce. Carrot companions: onion, lettuce
            { "id": "mg-sm-bed-2", "type": "raised-bed", "name": "OVAL BED #1 (2.5×4)", "canvasX": 320, "canvasY": 60, "w": 4, "h": 2, "diameter": null,
              "plants": _merge(_pp('carrot-chantenay', 6), _pp('beet-bulls-blood', 4), _pp('beet-early-wonder', 4), _pp('lettuce-lolla-rossa', 2)),
              "notes": "Root veg guild: 6× Chantenay Carrot, 4× Bull's Blood Beet, 4× Early Wonder Beet, 2× Lolla Rossa Lettuce. All companions — lettuce provides living mulch.", "volunteer": null, "vertical": false },

            // ═══════════════════════════════════════════════════════
            // BLUEBERRY POT #1 (2.5ft dia) — Existing blueberry bush
            { "id": "mg-ftp-1", "type": "pot-round", "name": "BLUEBERRY POT #1", "canvasX": 820, "canvasY": 460, "w": null, "h": null, "diameter": 2.5,
              "plants": _pp('blueberry', 1),
              "notes": "1× Blueberry bush (existing plant). Acidic potting mix. Mulch with pine needles. Needs cross-pollinator (Pot #2).", "volunteer": null },

            // ═══════════════════════════════════════════════════════
            // LARGE BED (4×8 ft = 48×96 in, vertical) — Vine/Melon Guild
            // Squash (21"), Cantaloupe (36"), Cowpeas as nitrogen-fixer (3"),
            // Watermelon Petite Yellow (72" but vertical training possible)
            // + Marigold & Nasturtium borders for pest control
            { "id": "mg-lg-bed-2", "type": "raised-bed", "name": "LARGE BED (4×8)", "canvasX": 60, "canvasY": 280, "w": 4, "h": 8, "diameter": null,
              "plants": _merge(
                  _pp('squash-cocozelle', 2),
                  _pp('cantaloupe-delicious-51', 2),
                  _pp('watermelon-petite-yellow', 1),
                  _pp('watermelon-dixie-queen', 1),
                  _pp('cowpeas-california-blackeye', 6)
              ),
              "notes": "Vine & Melon guild: 2× Cocozelle Squash, 2× Delicious 51 Cantaloupe, 1× Petite Yellow + 1× Dixie Queen Watermelon, 6× Blackeye Cowpeas (nitrogen fixer between rows). Three Sisters companions. Add companion flowers for pest control.", "volunteer": null, "vertical": true },

            // ═══════════════════════════════════════════════════════
            // MAIN BED (4×8 ft, trellis, vertical) — Tomato + Trellis Guild
            // 3 tomato varieties (24-30" spacing) on trellis side +
            // Cucumber on trellis (48" but climbs) + Basil companion + Marigold border
            { "id": "mg-lg-bed-1", "type": "raised-bed", "name": "MAIN BED (4×8)", "canvasX": 320, "canvasY": 280, "w": 8, "h": 4, "diameter": null,
              "plants": _merge(
                  _pp('tomato-cherokee-purple', 2),
                  _pp('tomato-red-brandywine', 2),
                  _pp('tomato-mortgage-lifter', 1),
                  _pp('cucumber-national-pickling', 2),
                  _pp('basil-sweet', 2)
              ),
              "notes": "Tomato & Trellis guild: 2× Cherokee Purple, 2× Red Brandywine, 1× Mortgage Lifter (all on trellis), 2× National Pickling Cucumber (climbs trellis), 2× Sweet Basil (tomato companion). Basil repels aphids & improves tomato flavor. Add companion flowers for extra pest control.", "volunteer": null, "vertical": true },

            // ═══════════════════════════════════════════════════════
            // METAL BED (3×4 ft = 36×48 in) — Tomato + Companion Flowers
            // Brandywine (24") + Marigold + Nasturtium
            { "id": "mg-sm-bed-1", "type": "raised-bed", "name": "METAL BED (3×4)", "canvasX": 610, "canvasY": 265, "w": 4, "h": 2, "diameter": null,
              "plants": _pp('tomato-better-boy', 2),
              "notes": "2× Better Boy Tomato (24\" spacing, compact). Room for companion flowers.", "volunteer": null, "vertical": false },

            // ═══════════════════════════════════════════════════════
            // OVAL BED #2 (2×4 ft) — Cool Season Guild: Peas + Greens
            // Peas (3-8"), Spinach (8"), Lettuce (10") — all companions
            // Peas fix nitrogen for greens. NO onion/garlic here (pea enemies!)
            { "id": "mg-sm-bed-3", "type": "raised-bed", "name": "OVAL BED #2 (2.5×3)", "canvasX": 600, "canvasY": 60, "w": 2, "h": 4, "diameter": null,
              "plants": _merge(
                  _pp('pea-early-frosty', 4),
                  _pp('pea-lincoln', 4),
                  _pp('spinach-america', 3),
                  _pp('lettuce-lolla-rossa', 2)
              ),
              "notes": "Cool-season guild: 4× Early Frosty Pea, 4× Lincoln Pea, 3× America Spinach, 2× Lolla Rossa Lettuce. Peas fix nitrogen for the greens. NO onion/garlic here (pea enemies!).", "volunteer": null },

            // ═══════════════════════════════════════════════════════
            // GROW BAGS — 1 tomato variety each (perfect for single-plant containers)
            { "id": "mg-bag-1", "type": "grow-bag", "name": "GROW BAG #1", "canvasX": 1040, "canvasY": 360, "w": null, "h": null, "diameter": 1.5,
              "plants": _pp('tomato-roma', 1),
              "notes": "1× Roma Tomato — determinate, compact, great for sauce. Fabric bag = excellent drainage.", "volunteer": null },
            { "id": "mg-bag-2", "type": "grow-bag", "name": "GROW BAG #2", "canvasX": 1040, "canvasY": 460, "w": null, "h": null, "diameter": 1.5,
              "plants": _pp('tomato-cherokee-purple', 1),
              "notes": "1× Cherokee Purple Tomato — heirloom indeterminate, cage or stake it. Bring indoors if frost threatens.", "volunteer": null },
            { "id": "mg-bag-3", "type": "grow-bag", "name": "GROW BAG #3", "canvasX": 960, "canvasY": 460, "w": null, "h": null, "diameter": 1.5,
              "plants": _pp('tomato-mortgage-lifter', 1),
              "notes": "1× Mortgage Lifter Tomato — big beefsteak heirloom. Needs strong cage.", "volunteer": null },
            { "id": "mg-bag-4", "type": "grow-bag", "name": "GROW BAG #4", "canvasX": 960, "canvasY": 360, "w": null, "h": null, "diameter": 1.5,
              "plants": _pp('tomato-better-boy', 1),
              "notes": "1× Better Boy Hybrid — reliable producer, disease resistant.", "volunteer": null },

            // ═══════════════════════════════════════════════════════
            // BLUEBERRY POT #2 (2.5ft) — Existing blueberry bush (cross-pollinator)
            { "id": "mg-ftp-2", "type": "pot-round", "name": "BLUEBERRY POT #2", "canvasX": 820, "canvasY": 260, "w": null, "h": null, "diameter": 2.5,
              "plants": _pp('blueberry', 1),
              "notes": "1× Blueberry bush (existing plant). Cross-pollinates with Pot #1. Keep soil acidic (pH 4.5-5.5). Net when berries ripen.", "volunteer": null },

            // ═══════════════════════════════════════════════════════
            // METAL BED COPY (3×4 ft) — Mixed tomato varieties
            { "id": "mg-bed-copy-1", "type": "raised-bed", "name": "METAL BED (3×4) COPY", "canvasX": 610, "canvasY": 465, "w": 4, "h": 2, "diameter": null,
              "plants": _merge(_pp('tomato-mortgage-lifter', 1), _pp('tomato-better-boy', 1)),
              "notes": "1× Mortgage Lifter + 1× Better Boy Tomato. Room for companion flowers.", "volunteer": null, "vertical": false },

            // ═══════════════════════════════════════════════════════
            // SMALL POTS — Companion flower pots (place near veggie beds)
            { "id": "mg-pot-tomato", "type": "pot-round", "name": "TOMATO POT", "canvasX": 660, "canvasY": 160,
              "plants": [],
              "notes": "Empty — add companion flowers or herbs here.", "volunteer": null, "diameter": 1.5 },
            { "id": "mg-pot-round-3", "type": "pot-round", "name": "ROUND POT #3", "canvasX": 660, "canvasY": 380,
              "plants": [],
              "notes": "Empty — add companion flowers or herbs here.", "volunteer": null, "diameter": 1.5 },

            // ═══════════════════════════════════════════════════════
            // LARGE POTS — Sprawlers that need big containers
            { "id": "mg-pot-lg-3", "type": "pot-round", "name": "LARGE POT #3", "canvasX": 360, "canvasY": 680, "w": null, "h": null, "diameter": 2.5,
              "plants": _pp('pumpkin-big-max', 1),
              "notes": "1× Big Max Pumpkin — vines trail far beyond pot. Fun project!", "volunteer": null },
            { "id": "mg-pot-lg-4", "type": "pot-round", "name": "LARGE POT #4", "canvasX": 80, "canvasY": 680, "w": null, "h": null, "diameter": 2.5,
              "plants": _pp('watermelon-crimson-sweet', 1),
              "notes": "1× Crimson Sweet Watermelon — vines trail over edge, needs ground space around pot.", "volunteer": null },

            // ROUND POT #4 — Empty, ready for assignment
            { "id": "mg-pot-round-4", "type": "pot-round", "name": "ROUND POT #4", "canvasX": 660, "canvasY": 600,
              "plants": [],
              "notes": "Empty — available for companion flowers or herbs.", "volunteer": null, "diameter": 1.5 },

            // ═══════════════════════════════════════════════════════
            // ONION PLANTER (4×1 ft) — Bunching onions
            { "id": "mg-planter-3", "type": "planter", "name": "Onion Planter (4x1)", "canvasX": 620, "canvasY": 700, "w": 4, "h": 1, "diameter": null,
              "plants": _pp('onion-evergreen-bunching', 4),
              "notes": "4× Evergreen Bunching Onion — pest deterrent, easy to grow.", "volunteer": null, "vertical": false }
        ],
        "volunteers": []
    },
    "plantingLog": {}, "harvests": [], "journal": {}, "completedTasks": {}, "harvestGoal": 200
};

// ---- FNB FULL RESEARCH PLAN — 5-bed food bank donation garden ----
const DEMO_FNB_FULL_PLAN = {
    "version": 2, "exportDate": "2026-04-12T00:00:00.000Z",
    "app": "GardenSync // Food Not Bombs Canton", "isDemo": true,
    "state": {
        "containers": [
            { "id": "fnb-fp-bed-1", "type": "raised-bed", "name": "GREENS POWERHOUSE", "canvasX": 120, "canvasY": 40, "w": 4, "h": 8, "diameter": null,
              "plants": _merge(_pp('kale', 6), _pp('swiss-chard', 12), _pp('collard-greens', 4), _pp('lettuce', 6), _pp('spinach', 6), _pp('parsley', 4)),
              "notes": "BED 1 - GREENS POWERHOUSE\n\nWhy these crops: Leafy greens are the #1 most-requested item at food banks and the hardest to source commercially (short shelf life, expensive). This bed produces 3-season harvests from a single planting.\n\nKale (6): Cold-hardy superstar. Survives Zone 6a winters with row cover. Yields 1-2 lbs/plant/week once established. Cut-and-come-again for 6+ months.\nSwiss Chard (12): Heat-tolerant alternative to spinach. Rainbow varieties add color to donations. 18in spacing in grid pattern.\nCollard Greens (4): Southern staple, extremely productive. Each plant yields 1 lb/week. Sweeter after frost. Center of bed for height.\nLettuce (6): Fast 45-day crop. Succession plant every 2 weeks Apr-May, resume Aug-Sep. South edge for partial shade from taller greens.\nSpinach (6): Cool-season crop, bolt-resistant varieties. Plant early spring and fall. North edge of bed.\nParsley (4): Corners - companion to everything, deters pests. Biennial - produces 2 years.\n\nCompanion logic: All leafy greens are companions. Parsley at corners attracts beneficial insects. No enemies in this bed.\n\nPlanting calendar (Zone 6a, last frost Apr 18):\n- Mar 1: Start kale, collards, chard indoors\n- Mar 15: Direct sow spinach, lettuce outdoors (cold-hardy)\n- Apr 1: Transplant kale, collards, chard\n- Apr 15: Direct sow parsley\n- Weekly: Harvest outer leaves, never strip a plant bare\n\nVolunteer notes: Harvest Saturdays - fill bags with mixed greens. Wash and bundle for distribution same day (greens do not store).", "volunteer": null, "vertical": false },

            { "id": "fnb-fp-bed-2", "type": "raised-bed", "name": "TOMATO & PEPPER HQ", "canvasX": 120, "canvasY": 400, "w": 4, "h": 8, "diameter": null,
              "plants": _merge(_pp('tomato', 4), _pp('pepper', 4), _pp('basil', 6), _pp('marigold', 4), _pp('sweet-alyssum', 6)),
              "notes": "BED 2 - TOMATO & PEPPER HQ\n\nWhy these crops: Tomatoes and peppers are high-value produce that food banks rarely receive fresh. One tomato plant yields 10-20 lbs/season. Peppers store 2-3 weeks refrigerated.\n\nTomato (4): 24in spacing, caged/staked. Choose determinate varieties for concentrated harvest (Roma for sauce, Better Boy for slicing). Each plant = 10-20 lbs.\nPepper (4): 18in spacing between tomatoes. Bell peppers for eating fresh, jalapenos for variety. Companions of tomatoes.\nBasil (6): Interplanted - improves tomato flavor and repels hornworms, aphids, whiteflies. Harvest regularly to prevent flowering.\nMarigold (4): Corners - trap crop for aphids, repels nematodes in soil. French marigolds (Tagetes patula) most effective.\nSweet Alyssum (6): South edge ground cover - attracts hoverflies and parasitic wasps that eat tomato hornworm eggs. Living mulch reduces soil splash.\n\nCompanion logic: Classic tomato guild. Basil + tomato is the strongest companion pair in the garden. Marigold + alyssum provide pest control without chemicals.\n\nPlanting calendar:\n- Mar 1: Start tomato and pepper seeds indoors (8 weeks before transplant)\n- Mar 15: Start basil indoors\n- Apr 1: Start sweet alyssum indoors or buy starts\n- May 1: Transplant everything after last frost\n- May 15: Plant marigold starts at corners\n- Jun-Sep: Harvest tomatoes 2-3x/week at peak\n\nVolunteer notes: Tomatoes bruise easily - use shallow boxes for transport. Peppers can accumulate in fridge for weekly batch donation.", "volunteer": null, "vertical": false },

            { "id": "fnb-fp-bed-3", "type": "raised-bed", "name": "UNDERGROUND VAULT", "canvasX": 120, "canvasY": 760, "w": 4, "h": 8, "diameter": null,
              "plants": _merge(_pp('onion', 20), _pp('carrot', 15), _pp('beet', 12), _pp('chive', 4)),
              "notes": "BED 3 - UNDERGROUND VAULT\n\nWhy these crops: Root vegetables are the backbone of food bank storage. Onions last 2-3 months, carrots 4-5 months, beets 3-4 months in cool storage. No refrigeration needed.\n\nOnion (20): 4in spacing in rows. Sets planted early spring. Yellow storage onions last longest (2-3 months). Cure 2 weeks in shade after harvest.\nCarrot (15): 3in spacing between onion rows. Direct sow - do not transplant. Chantenay or Danvers types for heavy clay soil. Store in sand or sawdust.\nBeet (12): 4in spacing. Dual-purpose: roots store months, greens are nutritious and harvestable while roots grow. Succession plant for continuous harvest.\nChive (4): Corners - perennial companion. Repels carrot fly and aphids. Edible flowers attract pollinators. Returns every year.\n\nCompanion logic: Onion + carrot is a classic pair - onion repels carrot fly, carrot repels onion fly. Beets companion with onions. Chives at corners protect everything.\n\nPlanting calendar:\n- Mar 15: Plant onion sets as soon as soil is workable\n- Apr 1: Direct sow carrots (soil must be loose, no rocks)\n- Apr 1: Direct sow beets\n- Apr 1: Plant chive divisions at corners\n- Jul-Aug: Harvest beets as needed, cure onions\n- Sep-Oct: Pull carrots after first frost (sweetens them)\n\nVolunteer notes: Root veg is low-maintenance - the main work is weeding. Bag in paper (not plastic) for food bank distribution.", "volunteer": null, "vertical": false },

            { "id": "fnb-fp-bed-4", "type": "raised-bed", "name": "CALORIE CENTRAL", "canvasX": 120, "canvasY": 1120, "w": 4, "h": 8, "diameter": null,
              "plants": _pp('potato', 24),
              "notes": "BED 4 - CALORIE CENTRAL\n\nWhy this crop: Potatoes are the highest-calorie crop per square foot and store 4-6 months without refrigeration. A single 4x8 bed yields 50-100 lbs - enough to feed multiple families.\n\nPotato (24): 12in spacing in rows, 3 rows across. Use certified seed potatoes (not grocery store - those are treated). Yukon Gold or Kennebec for all-purpose. Hill soil around stems as they grow.\n\nVariety strategy: Plant 1/3 early (Red Norland, ready July), 1/3 mid (Yukon Gold, ready Aug), 1/3 late (Kennebec, ready Sep) for staggered harvest.\n\nCompanion logic: Potatoes are loners - they are enemies of tomato, squash, and cucumber (share blight). This dedicated bed avoids conflicts.\n\nPlanting calendar:\n- Apr 1: Cut seed potatoes, let callous 2 days\n- Apr 5: Plant 4in deep, eyes up\n- May-Jun: Hill soil 2-3 times as plants grow\n- Jul: Harvest new potatoes from early varieties\n- Aug-Sep: Main harvest when tops die back\n- Cure 2 weeks in dark, cool area before storage\n\nVolunteer notes: Potato harvest is a great group activity - dig carefully with hands or broadfork. Brush off soil, do NOT wash before storage. Store in paper bags in cool dark area.", "volunteer": null, "vertical": false },

            { "id": "fnb-fp-bed-5", "type": "raised-bed", "name": "STORAGE & PROTEIN", "canvasX": 120, "canvasY": 1480, "w": 4, "h": 8, "diameter": null,
              "plants": _merge(_pp('butternut-squash', 2), _pp('green-beans', 18), _pp('cilantro', 2), _pp('dill', 2), _pp('oregano', 2), _pp('thyme', 2), _pp('rosemary', 2), _pp('basil', 2), _pp('nasturtium', 4), _pp('calendula', 1), _pp('borage', 1)),
              "notes": "BED 5 - STORAGE & PROTEIN\n\nWhy these crops: Butternut squash stores 3-6 months unrefrigerated - the ultimate food bank crop. Green beans provide plant protein and can be dried for long-term storage. Herbs add nutrition and flavor to donations.\n\nButternut Squash (2): 36in spacing - vines will sprawl over bed edges. Each plant produces 4-8 squash (3-4 lbs each). Cure 2 weeks in sun after harvest.\nGreen Beans (18): Bush type, 6in spacing in center rows. Plant 2 successions (May 1 and Jun 15). Each planting yields for 3 weeks. Can be dried for winter protein.\nCilantro (2): Cool-season herb, bolts in heat. Plant spring and fall.\nDill (2): Self-seeds, attracts beneficial insects. Companion to beans.\nOregano (2): Perennial - plant once, harvest for years. Dries easily.\nThyme (2): Perennial ground cover, pest deterrent. Dries well.\nRosemary (2): Perennial, may need winter protection in Zone 6a.\nBasil (2): Annual herb, pairs with squash. Harvest before flowering.\nNasturtium (4): Corners - edible trap crop for aphids and squash bugs.\nCalendula (1): Trap crop for aphids, edible flowers.\nBorage (1): Attracts pollinators for squash (squash needs bee pollination).\n\nCompanion logic: Beans + squash is a Three Sisters pairing (minus corn). Nasturtium protects squash from vine borers. Herbs at edges create a pest-deterrent border.\n\nPlanting calendar:\n- Mar 15: Start squash indoors\n- Apr 1: Direct sow cilantro, dill\n- May 1: Transplant squash, direct sow beans, plant herb starts\n- May 15: Plant nasturtium, calendula, borage starts\n- Jun 15: Second bean planting\n- Sep-Oct: Harvest and cure squash\n\nVolunteer notes: Squash is the star donation - each fruit feeds a family for multiple meals. Bundle herb bouquets - people love getting fresh herbs with their produce.", "volunteer": null, "vertical": false }
        ],
        "volunteers": [
            {"id":"fnb-vol-1","name":"Saturday Crew A","phone":"","availability":"high"},
            {"id":"fnb-vol-2","name":"Saturday Crew B","phone":"","availability":"high"},
            {"id":"fnb-vol-3","name":"Weekday Waterer","phone":"","availability":"low"}
        ]
    },
    "plantingLog": {}, "harvests": [], "journal": {}, "completedTasks": {}, "harvestGoal": 500
};

// ---- FNB EASY START — Low-maintenance only ----
const DEMO_FNB_EASY_START = {
    "version": 2, "exportDate": "2026-04-12T00:00:00.000Z",
    "app": "GardenSync // Food Not Bombs Canton", "isDemo": true,
    "state": {
        "containers": [
            { "id": "fnb-es-bed-1", "type": "raised-bed", "name": "GREENS BED", "canvasX": 120, "canvasY": 40, "w": 4, "h": 8, "diameter": null,
              "plants": _merge(_pp('kale', 8), _pp('swiss-chard', 12), _pp('parsley', 4)),
              "notes": "BED 1 - GREENS BED (Low-Maintenance)\n\nAll low-maintenance crops - plant once, harvest for months.\n\nKale (8): The ultimate set-and-forget green. Cold-hardy, pest-resistant, produces for 6+ months. Just harvest outer leaves weekly.\nSwiss Chard (12): Heat-tolerant, drought-tolerant, beautiful. Rainbow chard adds color. Cut outer stalks, inner ones keep growing.\nParsley (4): Corners - biennial that produces 2 years. Attracts beneficial insects. Almost impossible to kill.\n\nVolunteer effort: Water once/week if no rain. Harvest outer leaves Saturdays.\nExpected yield: 80-120 lbs over the season.", "volunteer": null, "vertical": false },

            { "id": "fnb-es-bed-2", "type": "raised-bed", "name": "ROOT CELLAR", "canvasX": 120, "canvasY": 400, "w": 4, "h": 8, "diameter": null,
              "plants": _merge(_pp('onion', 15), _pp('carrot', 10), _pp('beet', 10)),
              "notes": "BED 2 - ROOT CELLAR (Low-Maintenance)\n\nPlant in spring, mostly ignore until harvest. All store 2-5 months without refrigeration.\n\nOnion (15): Plant sets in March, harvest in August. Zero maintenance between. Stores 2-3 months.\nCarrot (10): Direct sow April, harvest September. Keep weeded until canopy fills in, then self-mulching. Stores 4-5 months in cool area.\nBeet (10): Direct sow April, harvest July-October. Dual purpose - eat greens while roots grow. Stores 3-4 months.\n\nVolunteer effort: Weed monthly until plants fill in. Water during dry spells. One big harvest day in fall.\nExpected yield: 40-60 lbs of storable produce.", "volunteer": null, "vertical": false },

            { "id": "fnb-es-bed-3", "type": "raised-bed", "name": "POTATO PATCH", "canvasX": 120, "canvasY": 760, "w": 4, "h": 8, "diameter": null,
              "plants": _pp('potato', 32),
              "notes": "BED 3 - POTATO PATCH (Low-Maintenance)\n\nThe easiest high-calorie crop. Plant, hill twice, harvest once.\n\nPotato (32): 10in spacing, 4 rows. Use certified seed potatoes. Hill soil around stems twice (May and June). Harvest when tops die back in August-September.\n\nVolunteer effort: Hill soil twice in spring. One harvest day in late summer. Stores 4-6 months.\nExpected yield: 60-100 lbs.", "volunteer": null, "vertical": false },

            { "id": "fnb-es-bed-4", "type": "raised-bed", "name": "BEAN MACHINE", "canvasX": 120, "canvasY": 1120, "w": 4, "h": 8, "diameter": null,
              "plants": _merge(_pp('green-beans', 24), _pp('nasturtium', 4)),
              "notes": "BED 4 - BEAN MACHINE (Low-Maintenance)\n\nBush beans are foolproof and produce fast. Nasturtium protects them.\n\nGreen Beans (24): Bush type, 6in spacing. Direct sow after last frost. Pick every 3-4 days once producing - the more you pick, the more they grow. Plant a second round in mid-June for fall harvest.\nNasturtium (4): Corners - trap crop for aphids and bean beetles. Edible flowers are a bonus donation.\n\nVolunteer effort: Water weekly. Pick beans every Saturday.\nExpected yield: 20-30 lbs per planting (40-60 total with succession).", "volunteer": null, "vertical": false },

            { "id": "fnb-es-bed-5", "type": "raised-bed", "name": "GARLIC & HERBS", "canvasX": 120, "canvasY": 1480, "w": 4, "h": 8, "diameter": null,
              "plants": _merge(_pp('garlic', 20), _pp('chive', 8), _pp('oregano', 4), _pp('basil', 6)),
              "notes": "BED 5 - GARLIC & HERBS (Low-Maintenance)\n\nGarlic is planted in fall and ignored until summer. Herbs are perennial or self-seeding.\n\nGarlic (20): Plant cloves October, harvest July. Zero work between. Stores 6-8 months. The ultimate lazy crop.\nChive (8): Perennial - plant once, harvest forever. Divide every 3 years. Edible flowers.\nOregano (4): Perennial - spreads on its own. Dry bundles for winter donations.\nBasil (6): Annual but low-maintenance in warm weather. Pinch flower buds to keep producing.\n\nVolunteer effort: Plant garlic one Saturday in October. Harvest one Saturday in July. Herbs harvest themselves.\nExpected yield: 15-25 lbs garlic + herbs all season.", "volunteer": null, "vertical": false }
        ],
        "volunteers": []
    },
    "plantingLog": {}, "harvests": [], "journal": {}, "completedTasks": {}, "harvestGoal": 175
};

// ---- FNB MAX STORAGE — No-fridge pantry optimized ----
const DEMO_FNB_MAX_STORAGE = {
    "version": 2, "exportDate": "2026-04-12T00:00:00.000Z",
    "app": "GardenSync // Food Not Bombs Canton", "isDemo": true,
    "state": {
        "containers": [
            { "id": "fnb-ms-bed-1", "type": "raised-bed", "name": "POTATO BED A", "canvasX": 120, "canvasY": 40, "w": 4, "h": 8, "diameter": null,
              "plants": _pp('potato', 32),
              "notes": "BED 1 - POTATO BED A (Max Storage)\n\nEarly and mid-season varieties for July-August harvest.\n\nPotato (32): Plant Red Norland (early, ready July) and Yukon Gold (mid, ready August). 10in spacing, 4 rows. Hill twice. Stores 4-6 months in cool dark area.\n\nStorage instructions: Cure 2 weeks in dark at 60-70F, then store at 40-50F. Do NOT wash before storage. Paper bags or burlap sacks, not plastic.\nExpected yield: 60-100 lbs.", "volunteer": null, "vertical": false },

            { "id": "fnb-ms-bed-2", "type": "raised-bed", "name": "POTATO BED B", "canvasX": 120, "canvasY": 400, "w": 4, "h": 8, "diameter": null,
              "plants": _pp('potato', 32),
              "notes": "BED 2 - POTATO BED B (Max Storage)\n\nLate-season varieties for September-October harvest.\n\nPotato (32): Plant Kennebec (late, ready September) and Katahdin (late, ready October). These store the longest - up to 6 months. Same spacing and hilling as Bed A.\n\nWhy two potato beds: Staggered harvest means fresh potatoes from July through October, and stored potatoes through March. That is nearly year-round calories from 2 beds.\nExpected yield: 60-100 lbs.", "volunteer": null, "vertical": false },

            { "id": "fnb-ms-bed-3", "type": "raised-bed", "name": "ALLIUM FORTRESS", "canvasX": 120, "canvasY": 760, "w": 4, "h": 8, "diameter": null,
              "plants": _merge(_pp('onion', 30), _pp('garlic', 10)),
              "notes": "BED 3 - ALLIUM FORTRESS (Max Storage)\n\nOnions and garlic - the foundation of every kitchen. Both store 3-8 months.\n\nOnion (30): Yellow storage onions (Stuttgarter, Copra). 4in spacing, 5 rows. Plant sets in March. Cure 2-3 weeks after harvest. Stores 2-3 months in mesh bags.\nGarlic (10): Hardneck varieties for Zone 6a (Music, German Extra Hardy). Plant October, harvest July. Stores 6-8 months. Each clove becomes a full bulb.\n\nStorage instructions: Both need dry, cool, well-ventilated area. Braid or mesh bag. Never refrigerate. Check monthly for sprouting.\nExpected yield: 30-50 lbs onion, 5-10 lbs garlic.", "volunteer": null, "vertical": false },

            { "id": "fnb-ms-bed-4", "type": "raised-bed", "name": "SQUASH & BEANS", "canvasX": 120, "canvasY": 1120, "w": 4, "h": 8, "diameter": null,
              "plants": _merge(_pp('butternut-squash', 3), _pp('green-beans', 16), _pp('nasturtium', 4)),
              "notes": "BED 4 - SQUASH & BEANS (Max Storage)\n\nButternut squash stores 3-6 months. Dried beans store indefinitely.\n\nButternut Squash (3): 36in spacing along back edge - vines sprawl over the side. Each plant = 4-8 squash (3-4 lbs each). Cure 2 weeks in sun.\nGreen Beans (16): Bush type in center rows. Let some pods dry on the vine for dried beans - stores indefinitely in jars. Fresh beans for summer donations.\nNasturtium (4): Corners - trap crop for squash bugs and vine borers. The most important companion for squash.\n\nStorage: Cured butternut in cool dry area. Dried beans in mason jars with bay leaf (deters weevils).\nExpected yield: 30-50 lbs squash, 15-25 lbs beans (fresh + dried).", "volunteer": null, "vertical": false },

            { "id": "fnb-ms-bed-5", "type": "raised-bed", "name": "GREENS & CARROTS", "canvasX": 120, "canvasY": 1480, "w": 4, "h": 8, "diameter": null,
              "plants": _merge(_pp('kale', 6), _pp('carrot', 10), _pp('beet', 10), _pp('parsley', 4)),
              "notes": "BED 5 - GREENS & CARROTS (Max Storage)\n\nThe fresh produce bed - because even a storage-focused garden needs some greens for weekly donations.\n\nKale (6): Cut-and-come-again for 6+ months. The hardiest green - survives frost, drought, and neglect. Fresh donation every Saturday.\nCarrot (10): Stores 4-5 months in cool sand or sawdust. Leave in ground until after first frost for sweeter flavor.\nBeet (10): Stores 3-4 months. Greens are harvestable while roots grow - dual purpose.\nParsley (4): Corners - biennial, attracts beneficial insects, adds nutrition to donations.\n\nStorage: Carrots in damp sand in cool area. Beets same method.\nExpected yield: 40-60 lbs root veg + weekly kale harvests.", "volunteer": null, "vertical": false }
        ],
        "volunteers": []
    },
    "plantingLog": {}, "harvests": [], "journal": {}, "completedTasks": {}, "harvestGoal": 325
};

// ---- CANTON CLIMATE DATA ----
const CANTON_CLIMATE = {
    zone: '6a',
    lastFrost: { month: 3, day: 18 },  // April 18 (0-indexed months)
    firstFrost: { month: 9, day: 28 },   // October 28
    growingSeason: 193,
    monthlyRainfall: {
        0: 2.5, 1: 2.3, 2: 3.1, 3: 3.4, 4: 4.1, 5: 5.4,
        6: 4.1, 7: 3.4, 8: 2.7, 9: 2.3, 10: 2.8, 11: 2.6
    },
    monthlyAvgHigh: {
        0: 34, 1: 37, 2: 48, 3: 60, 4: 70, 5: 79,
        6: 83, 7: 81, 8: 74, 9: 62, 10: 50, 11: 38
    },
    monthlyAvgLow: {
        0: 19, 1: 21, 2: 29, 3: 39, 4: 49, 5: 58,
        6: 62, 7: 60, 8: 53, 9: 42, 10: 33, 11: 24
    },
    annualRainfall: 42
};

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ---- CONTAINER TYPES ----
const CONTAINER_TYPES = {
    'raised-bed': {
        label: 'Raised Bed', shape: 'rect', icon: '\u{1F6CF}',
        defaultW: 5, defaultH: 10, minW: 2, maxW: 20, minH: 2, maxH: 30,
        description: 'Standard raised garden bed with wood frame',
        soilColor: '#1a1208', borderColor: '#6b5020', borderWidth: 3
    },
    'planter': {
        label: 'Planter Box', shape: 'rect', icon: '\u{1FAB4}',
        defaultW: 1, defaultH: 4, minW: 1, maxW: 8, minH: 1, maxH: 8,
        description: 'Compact rectangular planter box',
        soilColor: '#1c1409', borderColor: '#8a7040', borderWidth: 2
    },
    'pot-round': {
        label: 'Round Pot', shape: 'circle', icon: '\u{1FAD9}',
        defaultDiameter: 1.5, minDiameter: 0.5, maxDiameter: 4,
        description: 'Terracotta or ceramic round pot',
        soilColor: '#19110a', borderColor: '#a06030', borderWidth: 3
    },
    'grow-bag': {
        label: 'Grow Bag', shape: 'circle', icon: '\u{1F33F}',
        defaultDiameter: 1.5, minDiameter: 0.5, maxDiameter: 4,
        description: 'Fabric grow bag for vegetables',
        soilColor: '#1a1510', borderColor: '#706050', borderWidth: 3
    },
    'in-ground': {
        label: 'In-Ground Plot', shape: 'rect', icon: '\u{1F33E}',
        defaultW: 6, defaultH: 12, minW: 2, maxW: 30, minH: 2, maxH: 30,
        description: 'Direct in-ground planting area',
        soilColor: '#151008', borderColor: '#5a4a20', borderWidth: 3
    },
    'window-box': {
        label: 'Window Box', shape: 'rect', icon: '\u{1F338}',
        defaultW: 0.5, defaultH: 3, minW: 0.5, maxW: 2, minH: 1, maxH: 6,
        description: 'Narrow window-mounted planter',
        soilColor: '#1c1409', borderColor: '#7a6030', borderWidth: 2
    },
    'potato-tower': {
        label: 'Potato Tower', shape: 'circle', icon: '\u{1F954}',
        defaultDiameter: 2, minDiameter: 1, maxDiameter: 4,
        description: 'Vertical potato growing tower',
        soilColor: '#1a1510', borderColor: '#7a6840', borderWidth: 3
    }
};

// ---- CANVAS SCALE ----
const CANVAS_PX_PER_FOOT = 40;

// ---- GRID + PROXIMITY (used by placement + companion network) ----
const GRID_CELL_PX = 20;
const PROXIMITY_MAX_CELLS = 3.5;
const PROXIMITY_MAX_PX = GRID_CELL_PX * PROXIMITY_MAX_CELLS; // 70

