import { useState } from "react";

const COLORS = {
  green: "#22c55e", greenBg: "#f0fdf4", greenBorder: "#bbf7d0",
  red: "#ef4444", redBg: "#fef2f2", redBorder: "#fecaca",
  blue: "#3b82f6", blueBg: "#eff6ff", blueBorder: "#bfdbfe",
  amber: "#f59e0b", amberBg: "#fffbeb", amberBorder: "#fde68a",
  purple: "#8b5cf6", purpleBg: "#f5f3ff", purpleBorder: "#ddd6fe",
  teal: "#14b8a6", tealBg: "#f0fdfa", tealBorder: "#99f6e4",
  slate: "#64748b",
};

const BED_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#8b5cf6", "#3b82f6"];
const BED_NAMES = [
  "Greens Powerhouse",
  "Tomato & Pepper HQ",
  "Underground Vault",
  "Calorie Central",
  "Storage & Protein"
];

const GOOD_PLANTS = [
  { name: "Kale", bed: 1, why: "Cut-and-come-again for months, frost-hardy, #2 most requested by food banks, 0.57 lb/sqft", yield: "60-100 lbs (bed total)", storage: "1-2 wks (fridge)", maint: "Low", inLibrary: true },
  { name: "Swiss Chard", bed: 1, why: "Continuous harvest Mar-Nov, heat + cold tolerant, high vitamin K/A/C", yield: "Part of bed total", storage: "1-2 wks (fridge)", maint: "Low", inLibrary: true },
  { name: "Collard Greens", bed: 1, why: "Improves after frost, months of harvest, high calcium + folate", yield: "Part of bed total", storage: "1-2 wks (fridge)", maint: "Low", inLibrary: false },
  { name: "Leaf Lettuce", bed: 1, why: "Fast spring/fall crop, interplants between slow growers", yield: "Succession crop", storage: "1-2 wks (fridge)", maint: "Low", inLibrary: true },
  { name: "Spinach", bed: 1, why: "Cool-season powerhouse, iron + folate, succession sowable", yield: "Succession crop", storage: "1-2 wks (fridge)", maint: "Low-Med", inLibrary: true },
  { name: "Determinate Tomatoes", bed: 2, why: "#1 most requested produce, no pruning needed, concentrated harvest", yield: "32-60 lbs", storage: "2-14 days (room temp)", maint: "Medium", inLibrary: true },
  { name: "Sweet Peppers", bed: 2, why: "High demand, expensive for clients to buy, holds 1-2 wks on plant", yield: "12-24 lbs", storage: "2-3 wks (fridge)", maint: "Medium", inLibrary: true },
  { name: "Basil", bed: 2, why: "Repels thrips/whitefly on tomatoes (Iowa State research), herbs hard for food banks to source", yield: "3-12 lbs", storage: "1-2 wks", maint: "Low", inLibrary: true },
  { name: "Onions (bulb)", bed: 3, why: "0.92 lb/sqft, stores 6-9 months NO fridge, universally needed", yield: "~9 lbs", storage: "6-9 months (room temp!)", maint: "Low", inLibrary: true },
  { name: "Carrots", bed: 3, why: "0.69 lb/sqft, stores 5-6 months, can overwinter in ground under mulch", yield: "~8 lbs", storage: "5-6 months (fridge)", maint: "Low-Med", inLibrary: true },
  { name: "Beets", bed: 3, why: "Dual harvest (roots + greens), stores 4-10 months, flexible timing", yield: "~5 lbs + greens", storage: "4-10 months (fridge)", maint: "Low", inLibrary: true },
  { name: "Potatoes", bed: 4, why: "HIGHEST caloric yield (700 cal/sqft), stores 2-9 months, universal staple", yield: "20-48 lbs", storage: "2-9 months (cool/dark)", maint: "Low", inLibrary: true },
  { name: "Garlic", bed: 4, why: "Plant Oct, zero care until July harvest, stores 6-8 months, high value", yield: "~5 lbs", storage: "6-8 months (room temp!)", maint: "Very Low", inLibrary: true },
  { name: "Butternut Squash", bed: 5, why: "Only squash resistant to vine borer, stores 3-6 months NO fridge", yield: "20-30 lbs", storage: "3-6 months (room temp!)", maint: "Low-Med", inLibrary: false },
  { name: "Bush Beans", bed: 5, why: "Only garden protein source, 50-day maturity, 3 successions, fixes nitrogen", yield: "15-25 lbs", storage: "8-12 days (fridge)", maint: "Low", inLibrary: true },
  { name: "Parsley", bed: 1, why: "Biennial, months of harvest, attracts beneficial insects, hard for food banks to get", yield: "Continuous", storage: "1-2 wks", maint: "Very Low", inLibrary: true },
  { name: "Cilantro", bed: 5, why: "Attracts parasitic wasps, must succession sow every 3 wks", yield: "Small batches", storage: "1-2 wks", maint: "Low", inLibrary: true },
  { name: "Chives", bed: 3, why: "Perennial, early pollinator food, deters aphids + Japanese beetles", yield: "Continuous", storage: "1 wk", maint: "Very Low", inLibrary: true },
  { name: "Marigolds", bed: 2, why: "Research-backed pest deterrent for tomatoes, nematode suppression", yield: "N/A (companion)", storage: "N/A", maint: "Very Low", inLibrary: true },
  { name: "Nasturtiums", bed: 5, why: "Trap crop for squash bugs (SARE research), edible flowers", yield: "N/A (companion)", storage: "N/A", maint: "Very Low", inLibrary: true },
];

const BAD_PLANTS = [
  { name: "Zucchini / Summer Squash", reason: "Squash vine borer devastation in NE Ohio, requires DAILY harvest, food banks say oversized zucchini is #1 unwanted donation", severity: "high" },
  { name: "Corn", reason: "Terrible yield per sqft in raised beds, needs block planting for pollination, raccoon magnet", severity: "high" },
  { name: "Eggplant", reason: "Flea beetles + Colorado potato beetle, needs consistent heat Ohio can't guarantee", severity: "high" },
  { name: "Indeterminate Tomatoes", reason: "Weekly suckering, tall staking, high disease pressure -- use determinates instead for same yield, less work", severity: "medium" },
  { name: "Celery", reason: "Constant moisture demands, terrible yield per sqft, bolts easily", severity: "high" },
  { name: "Melons / Watermelon", reason: "Space hogs, cucumber beetle vector for bacterial wilt, hard to judge ripeness for volunteers", severity: "high" },
  { name: "Cucumbers", reason: "1-3 day harvest window, bacterial wilt via cucumber beetles, needs daily checking", severity: "medium" },
  { name: "Fennel", reason: "Documented allelopathy -- inhibits growth of nearby plants", severity: "high" },
];

const SCENARIOS = [
  {
    id: "full",
    name: "Full Research Plan",
    icon: "📋",
    desc: "The complete 5-bed plan from the deep research -- optimized for yield, storage life, volunteer labor, and food bank needs.",
    beds: [
      { name: "Greens Powerhouse", plants: "Kale (6), Swiss Chard (12), Collards (4), Lettuce (16), Spinach (18), Parsley (4)", est: "60-100 lbs" },
      { name: "Tomato & Pepper HQ", plants: "Det. Tomatoes (4), Sweet Peppers (4), Basil (6), Marigolds (4), Alyssum (6)", est: "50-80 lbs" },
      { name: "Underground Vault", plants: "Onions (160 sets), Carrots (150), Beets (72), Chives (4)", est: "80-120 lbs" },
      { name: "Calorie Central", plants: "Potatoes (24-32), then Fall Kale (8) + Garlic (80 cloves)", est: "35-73 lbs" },
      { name: "Storage & Protein", plants: "Butternut Squash (2), Bush Beans (144, 3 sowings), Cilantro, Dill, Oregano, Nasturtiums", est: "40-65 lbs" },
    ],
    total: "400-600 lbs/season",
    pros: "Maximum total yield, 60% storage crops, research-backed companion planting, 3-season production",
    cons: "Most complex, needs some plants not yet in GardenSync library (collards, butternut, alyssum)"
  },
  {
    id: "easy",
    name: "Easy Start (Low Maintenance)",
    icon: "🌱",
    desc: "Only the lowest-maintenance crops. Perfect if volunteer commitment is uncertain or this is Year 1.",
    beds: [
      { name: "Greens Bed", plants: "Kale (8), Swiss Chard (12), Parsley (4)", est: "40-60 lbs" },
      { name: "Root Cellar", plants: "Onions (100 sets), Carrots (100), Beets (50)", est: "50-80 lbs" },
      { name: "Potato Patch", plants: "Potatoes (32)", est: "20-48 lbs" },
      { name: "Bean Machine", plants: "Bush Beans (144, 3 sowings), Nasturtiums (4)", est: "15-25 lbs" },
      { name: "Garlic & Herbs", plants: "Garlic (80), Chives (8), Oregano (4), Basil (6)", est: "5-10 lbs" },
    ],
    total: "130-225 lbs/season",
    pros: "All crops are low/very low maintenance, everything in current plant library, great for unreliable volunteer schedule",
    cons: "Lower total yield, no tomatoes/peppers (the #1 most requested items), less variety"
  },
  {
    id: "storage",
    name: "Max Storage (Food Bank Priority)",
    icon: "🏪",
    desc: "Prioritizes crops that store 1-9 months WITHOUT refrigeration -- ideal for pantries with no cold storage.",
    beds: [
      { name: "Potato Bed A", plants: "Potatoes (32), then Fall Garlic (40 cloves)", est: "20-48 lbs potatoes" },
      { name: "Potato Bed B", plants: "Potatoes (32), then Fall Kale (8)", est: "20-48 lbs potatoes" },
      { name: "Allium Fortress", plants: "Onions (200 sets), Garlic (40 cloves in fall)", est: "15-20 lbs" },
      { name: "Squash & Beans", plants: "Butternut Squash (3), Bush Beans (96, 2 sowings)", est: "30-45 lbs" },
      { name: "Greens + Carrots", plants: "Kale (6), Carrots (100), Beets (50), Parsley (4)", est: "30-50 lbs" },
    ],
    total: "250-400 lbs/season (70%+ shelf-stable)",
    pros: "Maximum no-fridge storage life, potatoes are calorie kings, onions/garlic last nearly a year",
    cons: "No tomatoes/peppers, less nutritional variety in greens, double potato beds need disease rotation next year"
  }
];

function Badge({ color, children }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 9999,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
      background: color === "green" ? COLORS.greenBg : color === "red" ? COLORS.redBg : color === "amber" ? COLORS.amberBg : color === "blue" ? COLORS.blueBg : color === "purple" ? COLORS.purpleBg : COLORS.tealBg,
      color: color === "green" ? COLORS.green : color === "red" ? COLORS.red : color === "amber" ? COLORS.amber : color === "blue" ? COLORS.blue : color === "purple" ? COLORS.purple : COLORS.teal,
      border: `1px solid ${color === "green" ? COLORS.greenBorder : color === "red" ? COLORS.redBorder : color === "amber" ? COLORS.amberBorder : color === "blue" ? COLORS.blueBorder : color === "purple" ? COLORS.purpleBorder : COLORS.tealBorder}`,
    }}>{children}</span>
  );
}

function GardenLayout({ scenario }) {
  const beds = scenario ? scenario.beds : SCENARIOS[0].beds;
  return (
    <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>5x Raised Beds (4'x8' each) + Water Barrel</span>
      </div>
      <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 16 }}>Canton Food Not Bombs -- 160 sqft total growing space</div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* Water barrel */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 50 }}>
          <div style={{
            width: 44, height: 56, borderRadius: 8, background: "linear-gradient(180deg, #3b82f6, #1d4ed8)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, border: "2px solid #1e40af"
          }}>🪣</div>
          <span style={{ fontSize: 10, color: COLORS.slate, textAlign: "center" }}>Water<br/>Barrel</span>
        </div>
        {/* 5 beds in a row */}
        <div style={{ display: "flex", gap: 8, flex: 1, overflowX: "auto" }}>
          {beds.map((bed, i) => (
            <div key={i} style={{
              flex: "1 1 0", minWidth: 120, background: "#fff", borderRadius: 8,
              border: `2px solid ${BED_COLORS[i]}20`, overflow: "hidden"
            }}>
              <div style={{
                background: `${BED_COLORS[i]}15`, padding: "6px 10px",
                borderBottom: `1px solid ${BED_COLORS[i]}20`,
                display: "flex", alignItems: "center", gap: 6
              }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: BED_COLORS[i] }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>Bed {i + 1}</span>
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>{bed.name}</div>
                <div style={{ fontSize: 10, color: COLORS.slate, lineHeight: 1.5 }}>{bed.plants}</div>
                <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: BED_COLORS[i] }}>{bed.est}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {scenario && (
        <div style={{ marginTop: 12, display: "flex", gap: 12, fontSize: 11 }}>
          <div style={{ flex: 1, background: COLORS.greenBg, borderRadius: 8, padding: "8px 12px", border: `1px solid ${COLORS.greenBorder}` }}>
            <span style={{ fontWeight: 700, color: COLORS.green }}>Total Est. Yield:</span> {scenario.total}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FNBGardenPlan() {
  const [tab, setTab] = useState("good");
  const [selectedScenario, setSelectedScenario] = useState(0);

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", maxWidth: 960, margin: "0 auto", padding: 16, color: "#1e293b" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 24 }}>🥕</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Canton Food Not Bombs -- Garden Plan</h1>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: COLORS.slate }}>
          5 raised beds (4'x8'), Zone 6a, volunteer-managed, optimized for food bank donation
        </p>
      </div>

      {/* Good vs Bad tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { id: "good", label: "Plant These", icon: "✅", count: GOOD_PLANTS.length },
          { id: "bad", label: "Avoid These", icon: "🚫", count: BAD_PLANTS.length },
          { id: "scenarios", label: "Demo Scenarios", icon: "🗺️", count: SCENARIOS.length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid",
            borderColor: tab === t.id ? "#3b82f6" : "#e2e8f0",
            background: tab === t.id ? "#eff6ff" : "#fff",
            color: tab === t.id ? "#1d4ed8" : "#64748b",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6
          }}>
            <span>{t.icon}</span> {t.label}
            <span style={{
              background: tab === t.id ? "#3b82f6" : "#e2e8f0",
              color: tab === t.id ? "#fff" : "#64748b",
              borderRadius: 99, padding: "1px 7px", fontSize: 11, fontWeight: 700
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* GOOD PLANTS TABLE */}
      {tab === "good" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                {["Crop", "Bed", "Why It's Good for FNB", "Est. Yield", "Storage Life", "Maint.", "In GardenSync?"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: COLORS.slate, borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GOOD_PLANTS.map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                  <td style={{ padding: "7px 10px", fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "7px 10px" }}>
                    <Badge color={["green", "red", "amber", "purple", "blue"][p.bed - 1]}>Bed {p.bed}: {BED_NAMES[p.bed - 1]}</Badge>
                  </td>
                  <td style={{ padding: "7px 10px", maxWidth: 280, lineHeight: 1.4 }}>{p.why}</td>
                  <td style={{ padding: "7px 10px", fontWeight: 500 }}>{p.yield}</td>
                  <td style={{ padding: "7px 10px" }}>
                    {p.storage.includes("month") ? <Badge color="green">{p.storage}</Badge> : <Badge color="amber">{p.storage}</Badge>}
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    <Badge color={p.maint === "Very Low" ? "green" : p.maint === "Low" ? "green" : p.maint === "Low-Med" ? "amber" : "amber"}>{p.maint}</Badge>
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "center" }}>
                    {p.inLibrary ? <span style={{ color: COLORS.green }}>✓</span> : <span style={{ color: COLORS.red, fontWeight: 600 }}>needs add</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* BAD PLANTS TABLE */}
      {tab === "bad" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#fef2f2" }}>
                {["Crop", "Severity", "Why to Avoid at FNB"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: COLORS.red, borderBottom: "2px solid " + COLORS.redBorder }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BAD_PLANTS.map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #fef2f2", background: i % 2 === 0 ? "#fff" : "#fffbfb" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <Badge color={p.severity === "high" ? "red" : "amber"}>
                      {p.severity === "high" ? "DO NOT PLANT" : "USE CAUTION"}
                    </Badge>
                  </td>
                  <td style={{ padding: "8px 10px", lineHeight: 1.4 }}>{p.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 16, padding: 12, background: COLORS.amberBg, borderRadius: 8, border: `1px solid ${COLORS.amberBorder}`, fontSize: 12 }}>
            <strong style={{ color: COLORS.amber }}>Also avoid planting near each other:</strong> Tomatoes + Potatoes (share blight), Alliums (onion/garlic) + Beans (suppresses nitrogen fixation), Fennel + anything. Check for black walnut trees within 80ft (juglone kills tomatoes, peppers, potatoes).
          </div>
        </div>
      )}

      {/* SCENARIOS */}
      {tab === "scenarios" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {SCENARIOS.map((s, i) => (
              <button key={s.id} onClick={() => setSelectedScenario(i)} style={{
                flex: 1, padding: "12px 14px", borderRadius: 10, border: "2px solid",
                borderColor: selectedScenario === i ? "#3b82f6" : "#e2e8f0",
                background: selectedScenario === i ? "#eff6ff" : "#fff",
                cursor: "pointer", textAlign: "left"
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: selectedScenario === i ? "#1d4ed8" : "#334155" }}>{s.name}</div>
                <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 2 }}>{s.total}</div>
              </button>
            ))}
          </div>

          <GardenLayout scenario={SCENARIOS[selectedScenario]} />

          <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5, color: "#475569" }}>
            <p style={{ margin: "0 0 6px" }}>{SCENARIOS[selectedScenario].desc}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <div style={{ flex: 1, background: COLORS.greenBg, borderRadius: 8, padding: "8px 12px", border: `1px solid ${COLORS.greenBorder}` }}>
                <div style={{ fontWeight: 700, color: COLORS.green, fontSize: 11, marginBottom: 2 }}>PROS</div>
                {SCENARIOS[selectedScenario].pros}
              </div>
              <div style={{ flex: 1, background: COLORS.amberBg, borderRadius: 8, padding: "8px 12px", border: `1px solid ${COLORS.amberBorder}` }}>
                <div style={{ fontWeight: 700, color: COLORS.amber, fontSize: 11, marginBottom: 2 }}>CONS</div>
                {SCENARIOS[selectedScenario].cons}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: 12, background: COLORS.blueBg, borderRadius: 8, border: `1px solid ${COLORS.blueBorder}`, fontSize: 12 }}>
            <strong style={{ color: COLORS.blue }}>Next step:</strong> Once you pick which scenarios to include, I'll code them as importable Demo Gardens in GardenSync alongside the existing 8 demos. Each will create 5 raised beds (4'x8') with the water barrel note, pre-place all plants with proper companion spacing, and include volunteer slots and planting log entries.
          </div>
        </div>
      )}
    </div>
  );
}
