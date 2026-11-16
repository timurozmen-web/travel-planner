// POST /api/photo-used?id=<photo id> -> tells Unsplash a photo was chosen, as their API guidelines require.
export default async (req) => {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[\w-]{5,20}$/.test(id)) return Response.json({ ok: false }, { status: 400 });
  const key = Netlify.env.get('UNSPLASH_ACCESS_KEY');
  if (!key) return Response.json({ ok: false }, { status: 500 });
  const r = await fetch(`https://api.unsplash.com/photos/${id}/download`, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' } });
  return Response.json({ ok: r.ok });
};
export const config = { path: '/api/photo-used', method: 'POST' };
