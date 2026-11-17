// /api/weather?lat=&lng=&start=YYYY-MM-DD&end=YYYY-MM-DD
// Forecast from Open-Meteo for days within the next 16; for later dates, "typical" weather:
// the same calendar days averaged over the three most recent years in Open-Meteo's archive.
// Weather data by Open-Meteo.com (CC BY 4.0).
const DAY = 864e5;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum';

async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error('Open-Meteo ' + r.status); return r.json(); }

export default async (req) => {
  const u = new URL(req.url).searchParams;
  const lat = +u.get('lat'), lng = +u.get('lng'), start = u.get('start') || '', end = u.get('end') || '';
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return Response.json({ error: 'Bad request' }, { status: 400 });
  const s = Date.parse(start), e = Date.parse(end), n = Math.round((e - s) / DAY) + 1;
  if (!(n >= 1 && n <= 31)) return Response.json({ error: 'Up to 31 days' }, { status: 400 });
  const today = Date.parse(iso(Date.now())), lastForecast = today + 15 * DAY;
  const loc = `latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&timezone=auto`;
  const days = [];
  for (let i = 0; i < n; i++) days.push({ date: iso(s + i * DAY) });
  try {
    // Forecast for whatever part of the range is close enough.
    if (s <= lastForecast && e >= today - DAY) {
      const fs = iso(Math.max(s, today)), fe = iso(Math.min(e, lastForecast));
      const f = await getJSON(`https://api.open-meteo.com/v1/forecast?${loc}&daily=${DAILY},precipitation_probability_max&start_date=${fs}&end_date=${fe}`);
      f.daily.time.forEach((d, i) => { const x = days.find((y) => y.date === d); if (x) Object.assign(x, { src: 'forecast', hi: f.daily.temperature_2m_max[i], lo: f.daily.temperature_2m_min[i], rain: f.daily.precipitation_sum[i], wet: (f.daily.precipitation_probability_max?.[i] ?? null) != null ? f.daily.precipitation_probability_max[i] / 100 : (f.daily.precipitation_sum[i] >= 1 ? 1 : 0), code: f.daily.weather_code[i] }); });
    }
    // Typical weather for days without a forecast.
    const need = days.filter((d) => !d.src);
    if (need.length) {
      const archiveEnd = today - 7 * DAY, yr = new Date(s).getUTCFullYear(), years = [];
      for (let y = yr; years.length < 3 && y > yr - 8; y--) { const ys = Date.UTC(y, new Date(s).getUTCMonth(), new Date(s).getUTCDate()); if (ys + (n - 1) * DAY <= archiveEnd) years.push(ys); }
      const runs = await Promise.all(years.map((ys) => getJSON(`https://archive-api.open-meteo.com/v1/archive?${loc}&daily=${DAILY}&start_date=${iso(ys)}&end_date=${iso(ys + (n - 1) * DAY)}`).catch(() => null)));
      const ok = runs.filter(Boolean);
      need.forEach((d) => {
        const i = Math.round((Date.parse(d.date) - s) / DAY), hi = [], lo = [], rain = [];
        ok.forEach((r) => { if (r.daily.temperature_2m_max[i] != null) { hi.push(r.daily.temperature_2m_max[i]); lo.push(r.daily.temperature_2m_min[i]); rain.push(r.daily.precipitation_sum[i] || 0); } });
        if (!hi.length) return;
        const avg = (a) => a.reduce((p, x) => p + x, 0) / a.length;
        Object.assign(d, { src: 'typical', hi: avg(hi), lo: avg(lo), rain: avg(rain), wet: rain.filter((x) => x >= 1).length / rain.length, years: hi.length });
      });
    }
  } catch (err) { return Response.json({ error: String(err.message || err) }, { status: 502 }); }
  const anyForecast = days.some((d) => d.src === 'forecast');
  return Response.json({ days, source: 'Open-Meteo.com' }, { headers: { 'Cache-Control': 'public, max-age=3600', 'Netlify-CDN-Cache-Control': `public, s-maxage=${anyForecast ? 10800 : 2592000}, durable` } });
};

export const config = { path: '/api/weather', rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
