// /api/fx -> { base: 'GBP', rates: { JPY: 192.3, ... }, at, source }
// Live rates from ExchangeRate-API's open endpoint (refreshed daily), with the ECB rates via Frankfurter as a fallback.
// Cached at the CDN for 6 hours.
export default async () => {
  const tries = [
    async () => { const r = await fetch('https://open.er-api.com/v6/latest/GBP'); const j = await r.json(); if (j.result !== 'success') throw new Error('er-api'); return { rates: j.rates, at: (j.time_last_update_unix || 0) * 1000, source: 'ExchangeRate-API', link: 'https://www.exchangerate-api.com' }; },
    async () => { const r = await fetch('https://api.frankfurter.app/latest?from=GBP'); const j = await r.json(); if (!j.rates) throw new Error('frankfurter'); return { rates: { GBP: 1, ...j.rates }, at: Date.parse(j.date), source: 'European Central Bank via Frankfurter', link: 'https://www.frankfurter.app' }; },
  ];
  for (const t of tries) {
    try { const d = await t(); return Response.json({ base: 'GBP', ...d }, { headers: { 'Cache-Control': 'public, max-age=3600', 'Netlify-CDN-Cache-Control': 'public, s-maxage=21600, durable' } }); } catch {}
  }
  return Response.json({ error: 'No rates available right now' }, { status: 502 });
};
export const config = { path: '/api/fx' };
