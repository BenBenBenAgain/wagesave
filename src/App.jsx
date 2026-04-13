import { useState, useEffect, useCallback } from "react";

const VENUE_PRESETS = {
  cafe: { laborPct: 0.28, avgHourlyRate: 28, label: "Café" },
  bar: { laborPct: 0.30, avgHourlyRate: 30, label: "Bar" },
  restaurant: { laborPct: 0.32, avgHourlyRate: 32, label: "Restaurant" },
};

const DAY_MULTIPLIERS = {
  Mon: 0.75, Tue: 0.80, Wed: 0.90, Thu: 0.95,
  Fri: 1.25, Sat: 1.30, Sun: 1.05,
};

const DEMAND_CURVES = {
  cafe: [0,0,0,0,0,0,0.4,0.9,1.0,0.8,0.7,0.8,0.9,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0,0,0,0],
  bar: [0,0,0,0,0,0,0,0,0,0,0,0,0.2,0.3,0.3,0.4,0.5,0.7,0.9,1.0,0.9,0.7,0.5,0.2],
  restaurant: [0,0,0,0,0,0,0,0,0,0,0,0.6,1.0,0.8,0.4,0.3,0.4,0.7,1.0,0.9,0.7,0.4,0.1,0],
};

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 === 0 ? 12 : i % 12;
  return `${h}${i < 12 ? "am" : "pm"}`;
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weatherMultiplierFromCode(code) {
  if (code >= 200 && code < 600) return { mult: 0.85, label: "🌧 Rain", key: "rain" };
  if (code >= 600 && code < 700) return { mult: 0.80, label: "🌨 Snow", key: "snow" };
  if (code >= 700 && code < 800) return { mult: 0.90, label: "🌫 Overcast", key: "neutral" };
  if (code === 800) return { mult: 1.15, label: "☀️ Clear", key: "sunny" };
  if (code > 800) return { mult: 1.00, label: "🌥 Cloudy", key: "neutral" };
  return { mult: 1.00, label: "🌥 Neutral", key: "neutral" };
}

function Stepper({ value, onChange, min = 0, max = 100, step = 1, prefix = "", suffix = "" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button onClick={() => onChange(Math.max(min, value - step))} style={{
        width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #2a2a2a",
        background: "transparent", color: "#fff", fontSize: 20, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "#2a2a2a"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >−</button>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 500, color: "#fff", minWidth: 90, textAlign: "center" }}>
        {prefix}{value}{suffix}
      </span>
      <button onClick={() => onChange(Math.min(max, value + step))} style={{
        width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #2a2a2a",
        background: "transparent", color: "#fff", fontSize: 20, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "#2a2a2a"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >+</button>
    </div>
  );
}

function Pill({ label, active, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? "6px 14px" : "8px 18px", borderRadius: 100,
      border: active ? "none" : "1.5px solid #2a2a2a",
      background: active ? "#e8ff47" : "transparent",
      color: active ? "#0a0a0a" : "#888",
      fontSize: small ? 12 : 13, fontWeight: 600, cursor: "pointer",
      fontFamily: "'DM Mono', monospace", letterSpacing: "0.03em",
      transition: "all 0.15s",
    }}>{label}</button>
  );
}

function BarChart({ staffPerHour, venueType }) {
  const curve = DEMAND_CURVES[venueType];
  const activeHours = curve.map((v, i) => ({ hour: i, intensity: v, staff: staffPerHour[i] || 0 }))
    .filter(h => h.intensity > 0);
  const maxStaff = Math.max(...activeHours.map(h => h.staff), 1);

  return (
    <div>
      <p style={{ fontSize: 11, letterSpacing: "0.12em", color: "#555", fontFamily: "'DM Mono', monospace", marginBottom: 14, textTransform: "uppercase" }}>
        Staff needed by hour
      </p>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
        {activeHours.map(({ hour, staff }) => (
          <div key={hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: "100%", height: `${(staff / maxStaff) * 68}px`,
              background: "#e8ff47", borderRadius: 3, minHeight: 4,
              transition: "height 0.4s cubic-bezier(.23,1,.32,1)",
            }} />
            <span style={{ fontSize: 9, color: "#444", fontFamily: "'DM Mono', monospace" }}>{HOURS[hour]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WageSave() {
  const [venueType, setVenueType] = useState("cafe");
  const [revenue, setRevenue] = useState(3000);
  const [day, setDay] = useState(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [actualStaff, setActualStaff] = useState(0);
  const [result, setResult] = useState(null);
  const [animated, setAnimated] = useState(false);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);

  const preset = VENUE_PRESETS[venueType];

  const MANUAL_WEATHER = [
    { key: "sunny", label: "☀️ Sunny", mult: 1.15 },
    { key: "neutral", label: "🌥 Neutral", mult: 1.0 },
    { key: "rain", label: "🌧 Rain", mult: 0.85 },
  ];

  const fetchWeather = useCallback((lat, lon) => {
    setWeatherLoading(true);
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=8c9686f901d9e2180d4328a24d2da88f&units=metric`)
      .then(r => r.json())
      .then(data => {
        if (data.cod !== 200) throw new Error(data.message);
        const info = weatherMultiplierFromCode(data.weather[0].id);
        setWeather({ ...info, temp: Math.round(data.main.temp), city: data.name });
        setWeatherLoading(false);
      })
      .catch(() => {
        setWeatherError("Couldn't load weather");
        setWeatherLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { setLocationDenied(true); return; }
    setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => { setLocationDenied(true); setWeatherLoading(false); },
      { timeout: 8000 }
    );
  }, [fetchWeather]);

  const effectiveWeatherMult = weather ? weather.mult : 1.0;

  function calculate() {
    const dayMult = DAY_MULTIPLIERS[day];
    const adjustedRevenue = revenue * dayMult * effectiveWeatherMult;
    const laborBudget = adjustedRevenue * preset.laborPct;
    const totalHours = laborBudget / preset.avgHourlyRate;
    const curve = DEMAND_CURVES[venueType];
    const curveSum = curve.reduce((a, b) => a + b, 0);
    const staffPerHour = curve.map(v => curveSum > 0 ? Math.round((v / curveSum) * totalHours) : 0);
    const peakHourIndex = curve.indexOf(Math.max(...curve));
    const recommendedPeak = staffPerHour[peakHourIndex];
    const recommendedTotal = Math.round(totalHours / 8);
    const diff = actualStaff > 0 ? actualStaff - recommendedTotal : 0;
    const waste = diff > 0 ? diff * 8 * preset.avgHourlyRate : 0;
    const shortage = diff < 0 ? Math.abs(diff) : 0;
    setResult({ recommendedPeak, recommendedTotal, diff, waste, shortage, laborBudget, staffPerHour, adjustedRevenue });
    setAnimated(false);
    setTimeout(() => setAnimated(true), 50);
  }

  useEffect(() => { setResult(null); }, [venueType, revenue, day, weather]);

  return (
    <div style={{ minHeight: "100vh", background: "#080808", fontFamily: "'DM Sans', sans-serif", color: "#fff", padding: "0 0 80px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=range] { -webkit-appearance: none; height: 2px; background: #2a2a2a; border-radius: 2px; outline: none; width: 100%; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #e8ff47; cursor: pointer; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .result-card { animation: fadeUp 0.5s cubic-bezier(.23,1,.32,1) forwards; }
        .spin { display: inline-block; animation: spin 1s linear infinite; }
      `}</style>

      <div style={{ padding: "40px 28px 0", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, letterSpacing: "0.18em", color: "#e8ff47", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>WageSave</span>
          <span style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono', monospace" }}>v1</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 300, lineHeight: 1.25, letterSpacing: "-0.02em" }}>
          Am I burning money<br />
          <span style={{ color: "#e8ff47", fontWeight: 600 }}>right now?</span>
        </h1>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "36px 28px 0" }}>

        {/* Weather strip */}
        <div style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: 12, padding: "14px 20px", marginBottom: 32 }}>
          {weatherLoading ? (
            <span style={{ fontSize: 13, color: "#555", fontFamily: "'DM Mono', monospace" }}>
              <span className="spin">◌</span>&nbsp; Detecting weather...
            </span>
          ) : weather ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{weather.label}</span>
                <span style={{ fontSize: 12, color: "#555", marginLeft: 10 }}>{weather.temp}°C · {weather.city}</span>
              </div>
              <span style={{ fontSize: 11, color: weather.mult > 1 ? "#e8ff47" : weather.mult < 1 ? "#ff5050" : "#555", fontFamily: "'DM Mono', monospace" }}>
                {weather.mult > 1 ? `+${Math.round((weather.mult - 1) * 100)}%` : weather.mult < 1 ? `${Math.round((weather.mult - 1) * 100)}%` : "no change"}
              </span>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono', monospace", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {weatherError || "Location blocked"} — set manually
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {MANUAL_WEATHER.map(w => (
                  <Pill key={w.key} label={w.label} small active={weather?.key === w.key} onClick={() => setWeather(w)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Venue Type */}
        <div style={{ marginBottom: 36 }}>
          <label style={{ fontSize: 11, letterSpacing: "0.12em", color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", display: "block", marginBottom: 12 }}>Venue type</label>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(VENUE_PRESETS).map(([key, { label }]) => (
              <Pill key={key} label={label} active={venueType === key} onClick={() => setVenueType(key)} />
            ))}
          </div>
        </div>

        {/* Revenue */}
        <div style={{ marginBottom: 36 }}>
          <label style={{ fontSize: 11, letterSpacing: "0.12em", color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", display: "block", marginBottom: 12 }}>Expected revenue today</label>
          <Stepper value={revenue} onChange={setRevenue} min={500} max={20000} step={100} prefix="$" />
          <input type="range" min={500} max={20000} step={100} value={revenue}
            onChange={e => setRevenue(Number(e.target.value))} style={{ marginTop: 16 }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono', monospace" }}>$500</span>
            <span style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono', monospace" }}>$20k</span>
          </div>
        </div>

        {/* Day */}
        <div style={{ marginBottom: 36 }}>
          <label style={{ fontSize: 11, letterSpacing: "0.12em", color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", display: "block", marginBottom: 12 }}>Day of week</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DAYS.map(d => <Pill key={d} label={d} active={day === d} onClick={() => setDay(d)} />)}
          </div>
        </div>

        {/* Actual staff */}
        <div style={{ marginBottom: 40, padding: 20, borderRadius: 12, border: "1px solid #1a1a1a", background: "#0e0e0e" }}>
          <label style={{ fontSize: 11, letterSpacing: "0.12em", color: "#555", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", display: "block", marginBottom: 12 }}>
            Actual staff rostered <span style={{ color: "#333" }}>— optional</span>
          </label>
          <Stepper value={actualStaff} onChange={setActualStaff} min={0} max={30} step={1} suffix=" staff" />
        </div>

        {/* CTA */}
        <button onClick={calculate} style={{
          width: "100%", padding: "18px 0", background: "#e8ff47", color: "#0a0a0a",
          border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
          fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
        >Calculate →</button>

        {/* Result */}
        {result && (
          <div className={animated ? "result-card" : ""} style={{ marginTop: 36, opacity: animated ? 1 : 0 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: 12, padding: 20 }}>
                <p style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Recommended</p>
                <p style={{ fontSize: 40, fontWeight: 300, color: "#e8ff47", lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>{result.recommendedTotal}</p>
                <p style={{ fontSize: 12, color: "#555", marginTop: 6 }}>staff total</p>
              </div>
              <div style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: 12, padding: 20 }}>
                <p style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Peak hour</p>
                <p style={{ fontSize: 40, fontWeight: 300, color: "#fff", lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>{result.recommendedPeak}</p>
                <p style={{ fontSize: 12, color: "#555", marginTop: 6 }}>staff at once</p>
              </div>
            </div>

            {actualStaff > 0 && (
              <div style={{
                background: result.diff > 0 ? "rgba(255,80,80,0.06)" : result.diff < 0 ? "rgba(80,200,120,0.06)" : "rgba(232,255,71,0.06)",
                border: `1px solid ${result.diff > 0 ? "#ff505033" : result.diff < 0 ? "#50c87833" : "#e8ff4733"}`,
                borderRadius: 12, padding: 24, marginBottom: 12,
              }}>
                {result.diff > 0 ? (
                  <>
                    <p style={{ fontSize: 13, color: "#ff5050", fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>⚠️ OVERSTAFFED BY {result.diff}</p>
                    <p style={{ fontSize: 32, fontWeight: 600, color: "#ff5050", fontFamily: "'DM Mono', monospace" }}>−${result.waste.toLocaleString()}</p>
                    <p style={{ fontSize: 13, color: "#666", marginTop: 6 }}>potential wage waste today</p>
                  </>
                ) : result.diff < 0 ? (
                  <>
                    <p style={{ fontSize: 13, color: "#50c878", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>✓ UNDERSTAFFED BY {result.shortage}</p>
                    <p style={{ fontSize: 13, color: "#666" }}>You may be leaving revenue on the table.</p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: "#e8ff47", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>✓ STAFFING LOOKS RIGHT</p>
                    <p style={{ fontSize: 13, color: "#666" }}>You're on target. No action needed.</p>
                  </>
                )}
              </div>
            )}

            <div style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: 12, padding: 20, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Labour budget</p>
                  <p style={{ fontSize: 22, fontWeight: 500, color: "#fff", fontFamily: "'DM Mono', monospace" }}>${Math.round(result.laborBudget).toLocaleString()}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Target %</p>
                  <p style={{ fontSize: 22, fontWeight: 500, color: "#e8ff47", fontFamily: "'DM Mono', monospace" }}>{preset.laborPct * 100}%</p>
                </div>
              </div>
            </div>

            <div style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: 12, padding: 20 }}>
              <BarChart staffPerHour={result.staffPerHour} venueType={venueType} />
            </div>

            <p style={{ fontSize: 11, color: "#2a2a2a", textAlign: "center", marginTop: 20, fontFamily: "'DM Mono', monospace" }}>
              {preset.label} · ${preset.avgHourlyRate}/hr · {weather?.city || "manual weather"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
