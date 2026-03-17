/* GardenSync — Live Weather (Open-Meteo API) */

// ---- LIVE WEATHER (Open-Meteo API) ----
const CANTON_COORDS = { lat: 40.7989, lon: -81.3784 };
const WMO_WEATHER_CODES = {
    0: { desc: 'Clear sky', icon: '\u2600\uFE0F' },
    1: { desc: 'Mainly clear', icon: '\u{1F324}\uFE0F' },
    2: { desc: 'Partly cloudy', icon: '\u26C5' },
    3: { desc: 'Overcast', icon: '\u2601\uFE0F' },
    45: { desc: 'Foggy', icon: '\u{1F32B}\uFE0F' },
    48: { desc: 'Depositing rime fog', icon: '\u{1F32B}\uFE0F' },
    51: { desc: 'Light drizzle', icon: '\u{1F326}\uFE0F' },
    53: { desc: 'Moderate drizzle', icon: '\u{1F326}\uFE0F' },
    55: { desc: 'Dense drizzle', icon: '\u{1F327}\uFE0F' },
    61: { desc: 'Slight rain', icon: '\u{1F327}\uFE0F' },
    63: { desc: 'Moderate rain', icon: '\u{1F327}\uFE0F' },
    65: { desc: 'Heavy rain', icon: '\u{1F327}\uFE0F' },
    66: { desc: 'Light freezing rain', icon: '\u{1F9CA}' },
    67: { desc: 'Heavy freezing rain', icon: '\u{1F9CA}' },
    71: { desc: 'Slight snow', icon: '\u{1F328}\uFE0F' },
    73: { desc: 'Moderate snow', icon: '\u{1F328}\uFE0F' },
    75: { desc: 'Heavy snow', icon: '\u2744\uFE0F' },
    77: { desc: 'Snow grains', icon: '\u{1F328}\uFE0F' },
    80: { desc: 'Slight rain showers', icon: '\u{1F326}\uFE0F' },
    81: { desc: 'Moderate rain showers', icon: '\u{1F327}\uFE0F' },
    82: { desc: 'Violent rain showers', icon: '\u{1F327}\uFE0F' },
    85: { desc: 'Slight snow showers', icon: '\u{1F328}\uFE0F' },
    86: { desc: 'Heavy snow showers', icon: '\u2744\uFE0F' },
    95: { desc: 'Thunderstorm', icon: '\u26C8\uFE0F' },
    96: { desc: 'Thunderstorm w/ slight hail', icon: '\u26C8\uFE0F' },
    99: { desc: 'Thunderstorm w/ heavy hail', icon: '\u26C8\uFE0F' },
};

function getWeatherInfo(code) {
    return WMO_WEATHER_CODES[code] || { desc: 'Unknown', icon: '\u2753' };
}

function getWindDirection(degrees) {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(degrees / 22.5) % 16];
}

async function fetchWeather() {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CANTON_COORDS.lat}&longitude=${CANTON_COORDS.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York&forecast_days=7`;

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Weather API error: ${resp.status}`);
        const data = await resp.json();
        renderWeatherDashboard(data);
        checkFrostAlerts(data);
        checkWateringAlert(data);
        // Cache the data
        localStorage.setItem('gardensync_weather_cache', JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (err) {
        console.error('Weather fetch failed:', err);
        // Try to load cached data
        const cached = localStorage.getItem('gardensync_weather_cache');
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            renderWeatherDashboard(data, timestamp);
            checkFrostAlerts(data);
            checkWateringAlert(data);
        } else {
            document.getElementById('weather-dashboard').innerHTML = `
                <div class="weather-current-card" style="text-align:center;padding:2rem;">
                    <p style="color:var(--red-accent);font-family:var(--font-mono);font-size:0.8rem;">
                        WEATHER DATA UNAVAILABLE \u2014 ${err.message}
                    </p>
                    <button onclick="fetchWeather()" class="tool-btn" style="margin-top:0.75rem;">RETRY</button>
                </div>
            `;
        }
    }
}

function renderWeatherDashboard(data, cachedTimestamp) {
    const current = data.current;
    const daily = data.daily;
    const weather = getWeatherInfo(current.weather_code);
    const DAY_NAMES = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

    let html = `
        <div class="weather-current-row">
            <div class="weather-current-card main-temp">
                <div class="weather-label">CURRENT CONDITIONS</div>
                <div style="display:flex;align-items:center;gap:0.75rem;">
                    <span class="weather-icon-large">${weather.icon}</span>
                    <div>
                        <div class="weather-big-value">${Math.round(current.temperature_2m)}<span class="weather-unit">\u00B0F</span></div>
                        <div class="weather-desc">${weather.desc.toUpperCase()}</div>
                    </div>
                </div>
                <div class="weather-detail-row">
                    <div class="weather-detail"><span>FEELS LIKE</span> ${Math.round(current.apparent_temperature)}\u00B0F</div>
                </div>
            </div>
            <div class="weather-current-card">
                <div class="weather-label">HUMIDITY & WIND</div>
                <div class="weather-detail-row" style="flex-direction:column;gap:0.75rem;margin-top:0.75rem;">
                    <div class="weather-detail" style="font-size:0.85rem;">\u{1F4A7} <span>HUMIDITY</span> ${current.relative_humidity_2m}%</div>
                    <div class="weather-detail" style="font-size:0.85rem;">\u{1F4A8} <span>WIND</span> ${Math.round(current.wind_speed_10m)} mph ${getWindDirection(current.wind_direction_10m)}</div>
                    <div class="weather-detail" style="font-size:0.85rem;">\u{1F327}\uFE0F <span>PRECIP</span> ${current.precipitation}" today</div>
                </div>
            </div>
            <div class="weather-current-card">
                <div class="weather-label">GARDEN STATUS</div>
                <div style="margin-top:0.75rem;">
                    ${getGardenStatus(current, daily)}
                </div>
            </div>
        </div>
        <div class="weather-forecast-card">
            <h3>7-DAY FORECAST</h3>
            <div class="forecast-grid">
                ${daily.time.map((date, i) => {
                    const d = new Date(date + 'T12:00:00');
                    const dayName = i === 0 ? 'TODAY' : DAY_NAMES[d.getDay()];
                    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                    const wx = getWeatherInfo(daily.weather_code[i]);
                    const low = Math.round(daily.temperature_2m_min[i]);
                    const high = Math.round(daily.temperature_2m_max[i]);
                    const precipProb = daily.precipitation_probability_max[i];
                    const frost = low <= 32;
                    return `
                        <div class="forecast-day ${frost ? 'frost-day' : ''}">
                            <div class="forecast-day-name">${dayName}</div>
                            <div class="forecast-day-date">${dateStr}</div>
                            <div class="forecast-icon">${wx.icon}</div>
                            <div class="forecast-temps">
                                <span class="forecast-high">${high}\u00B0</span>
                                <span class="forecast-low">${low}\u00B0</span>
                            </div>
                            ${precipProb > 0 ? `<div class="forecast-precip">\u{1F4A7} ${precipProb}%</div>` : ''}
                            ${frost ? `<div class="forecast-frost-warn">\u26A0 FROST</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        <div class="weather-updated">
            ${cachedTimestamp ? `CACHED DATA FROM ${new Date(cachedTimestamp).toLocaleTimeString()}` : `UPDATED ${new Date(current.time).toLocaleTimeString()}`}
            <button onclick="fetchWeather()">REFRESH</button>
        </div>
    `;

    document.getElementById('weather-dashboard').innerHTML = html;
}

function getGardenStatus(current, daily) {
    const temp = current.temperature_2m;
    const lines = [];

    // Temperature assessment
    if (temp <= 32) {
        lines.push(`<div style="color:var(--red-accent);font-weight:700;font-size:0.85rem;">\u2744\uFE0F FREEZING \u2014 Protect any exposed plants!</div>`);
    } else if (temp <= 40) {
        lines.push(`<div style="color:var(--amber);font-size:0.85rem;">\u{1F9CA} COLD \u2014 Not safe for tender crops</div>`);
    } else if (temp >= 60 && temp <= 85) {
        lines.push(`<div style="color:var(--emerald);font-size:0.85rem;">\u2705 IDEAL growing temperature</div>`);
    } else if (temp > 85) {
        lines.push(`<div style="color:var(--amber);font-size:0.85rem;">\u{1F525} HOT \u2014 Water deeply, mulch well</div>`);
    } else {
        lines.push(`<div style="color:var(--text-secondary);font-size:0.85rem;">\u{1F321}\uFE0F Cool conditions</div>`);
    }

    // Upcoming frost check
    const frostDays = daily.temperature_2m_min.filter(t => t <= 32).length;
    if (frostDays > 0) {
        lines.push(`<div style="color:var(--red-accent);font-size:0.8rem;margin-top:0.35rem;">\u26A0 ${frostDays} frost night${frostDays > 1 ? 's' : ''} in forecast</div>`);
    } else {
        lines.push(`<div style="color:var(--text-muted);font-size:0.8rem;margin-top:0.35rem;">\u2714 No frost in 7-day forecast</div>`);
    }

    // Growing season check
    const now = new Date();
    const lastFrost = new Date(now.getFullYear(), 3, 18);
    const firstFrost = new Date(now.getFullYear(), 9, 28);
    if (now >= lastFrost && now <= firstFrost) {
        const daysLeft = Math.ceil((firstFrost - now) / (1000 * 60 * 60 * 24));
        lines.push(`<div style="color:var(--emerald);font-size:0.8rem;margin-top:0.35rem;">\u{1F331} Growing season \u2014 ${daysLeft} days until first frost</div>`);
    } else if (now < lastFrost) {
        const daysUntil = Math.ceil((lastFrost - now) / (1000 * 60 * 60 * 24));
        lines.push(`<div style="color:var(--teal);font-size:0.8rem;margin-top:0.35rem;">\u23F3 ${daysUntil} days until growing season starts</div>`);
    } else {
        lines.push(`<div style="color:var(--text-muted);font-size:0.8rem;margin-top:0.35rem;">\u{1F342} Growing season has ended</div>`);
    }

    return lines.join('');
}

function checkFrostAlerts(data) {
    const banner = document.getElementById('frost-alert-banner');
    const daily = data.daily;
    const frostDays = [];

    daily.time.forEach((date, i) => {
        if (daily.temperature_2m_min[i] <= 32) {
            const d = new Date(date + 'T12:00:00');
            frostDays.push({
                date: d,
                low: Math.round(daily.temperature_2m_min[i]),
                dateStr: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            });
        }
    });

    if (frostDays.length === 0) {
        banner.classList.add('hidden');
        return;
    }

    const now = new Date();
    const lastFrost = new Date(now.getFullYear(), 3, 18);
    const firstFrost = new Date(now.getFullYear(), 9, 28);
    const inGrowingSeason = now >= lastFrost && now <= firstFrost;

    banner.classList.remove('hidden');
    banner.innerHTML = `
        <div class="frost-alert-title">\u26A0\uFE0F FROST ALERT \u2014 ${frostDays.length} NIGHT${frostDays.length > 1 ? 'S' : ''} BELOW FREEZING</div>
        <div class="frost-alert-detail">
            ${frostDays.map(d => `<strong>${d.dateStr}</strong>: Low of ${d.low}\u00B0F`).join(' &bull; ')}
            ${inGrowingSeason ? '<br><strong>ACTION NEEDED:</strong> Cover tender plants (tomatoes, peppers, basil, beans) or harvest before freeze. Hardy crops (kale, spinach, garlic) should be fine.' : ''}
        </div>
    `;
}

function checkWateringAlert(data) {
    const banner = document.getElementById('water-alert-banner');
    if (!banner) return;

    const daily = data.daily;
    const today = new Date();

    // Check precipitation over recent days (today + past 2 days from forecast)
    // Open-Meteo daily includes today as index 0
    let recentRain = 0;
    const daysToCheck = Math.min(3, daily.precipitation_sum.length);
    for (let i = 0; i < daysToCheck; i++) {
        recentRain += (daily.precipitation_sum[i] || 0);
    }

    // Check if rain is expected tomorrow
    const rainTomorrow = daily.precipitation_sum.length > 1 ? daily.precipitation_sum[1] : 0;
    const rainProbTomorrow = daily.precipitation_probability_max?.length > 1 ? daily.precipitation_probability_max[1] : 0;

    // Check what high-water plants are in the garden
    const allPlants = state.containers.flatMap(c => c.plants);
    const highWaterPlants = [];
    const medWaterPlants = [];
    allPlants.forEach(p => {
        const lib = PLANT_LIBRARY.find(l => l.id === p.plantId);
        if (!lib) return;
        if (lib.waterNeed === 'high' && !highWaterPlants.includes(lib.name)) highWaterPlants.push(lib.name);
        if (lib.waterNeed === 'medium' && !medWaterPlants.includes(lib.name)) medWaterPlants.push(lib.name);
    });

    if (allPlants.length === 0) { banner.classList.add('hidden'); return; }

    // Current temp  -  hot weather increases water need
    const currentTemp = data.current?.temperature_2m || 70;
    const isHot = currentTemp >= 85;

    // Determine if we should show alert
    const drySpell = recentRain < 0.15; // less than 0.15" in recent days
    const hasThirstyPlants = highWaterPlants.length > 0;
    const needsWater = drySpell && (hasThirstyPlants || isHot);

    if (!needsWater) {
        banner.classList.add('hidden');
        return;
    }

    // Build alert message
    const urgency = (isHot && drySpell) ? 'HIGH' : 'MODERATE';
    let detail = '';
    if (recentRain < 0.05) {
        detail += `No measurable rain in the past ${daysToCheck} days. `;
    } else {
        detail += `Only ${recentRain.toFixed(2)}" rain recently. `;
    }
    if (isHot) detail += `Current temp: ${Math.round(currentTemp)}\u00B0F. `;
    if (highWaterPlants.length > 0) {
        detail += `High-water plants: ${highWaterPlants.join(', ')}. `;
    }
    if (rainProbTomorrow >= 60 && rainTomorrow > 0.1) {
        detail += `Rain expected tomorrow (${rainProbTomorrow}% chance).`;
    }

    banner.classList.remove('hidden');
    banner.innerHTML = `
        <div class="water-alert-title">\u{1F4A7} WATER YOUR BEDS \u2014 ${urgency} PRIORITY</div>
        <div class="water-alert-detail">${detail}</div>
        <button class="water-alert-dismiss" onclick="this.parentElement.classList.add('hidden')">\u2715</button>
    `;
}

function initWeather() {
    // Check cache age - refresh if older than 30 minutes
    const cached = localStorage.getItem('gardensync_weather_cache');
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < 30 * 60 * 1000) {
            renderWeatherDashboard(data, timestamp);
            checkFrostAlerts(data);
            checkWateringAlert(data);
            return;
        }
    }
    fetchWeather();
}

// ---- DATA EXPORT / IMPORT ----
