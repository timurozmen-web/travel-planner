// GET /api/photos?q=Tokyo%20Japan -> up to 8 landscape Unsplash photos with photographer credit.
// Needs UNSPLASH_ACCESS_KEY (Functions scope). Cached at the CDN for a week to stay inside Unsplash rate limits.
export default async (req) => {
  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 80);
  if (!q) return Response.json({ photos: [] }, { status: 400 });
  const key = Netlify.env.get('UNSPLASH_ACCESS_KEY');
  if (!key) return Response.json({ error: 'UNSPLASH_ACCESS_KEY is not set' }, { status: 500 });
  const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=8&orientation=landscape&content_filter=high`, {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
  });
  if (!r.ok) return Response.json({ error: `Unsplash answered ${r.status}` }, { status: 502 });
  const j = await r.json();
  const photos = (j.results || []).map((p) => ({
    id: p.id, url: p.urls.regular, thumb: p.urls.small, color: p.color, alt: p.alt_description || '',
    name: p.user?.name || 'Unsplash', profile: p.user?.links?.html || 'https://unsplash.com', link: p.links?.html || 'https://unsplash.com',
  }));
  return Response.json({ photos }, { headers: { 'Cache-Control': 'public, max-age=3600', 'Netlify-CDN-Cache-Control': 'public, s-maxage=604800, durable' } });
};
export const config = { path: '/api/photos' };
