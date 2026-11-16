// /api/upload — stores a resized photo for a trip stop. Needs a sync code so random visitors can't fill the store.
// POST (image body, x-sync-code header) -> { id, url }.  GET /api/upload/:id serves it.
import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const store = getStore('planner-photos');
  if (req.method === 'GET') {
    const id = context.params.id || '';
    if (!/^[a-z0-9]{20}$/.test(id)) return new Response('Not found', { status: 404 });
    const entry = await store.getWithMetadata(id, { type: 'arrayBuffer' });
    if (entry === null) return new Response('Not found', { status: 404 });
    return new Response(entry.data, { headers: { 'content-type': entry.metadata?.type || 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
  }
  const code = req.headers.get('x-sync-code') || '';
  if (!/^[A-Za-z0-9-]{16,64}$/.test(code)) return Response.json({ error: 'Turn on sync to upload photos' }, { status: 400 });
  const type = req.headers.get('content-type') || '';
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(type)) return Response.json({ error: 'Images only' }, { status: 415 });
  const buf = await req.arrayBuffer();
  if (buf.byteLength > 4_000_000) return Response.json({ error: 'Photo too large' }, { status: 413 });
  const id = [...crypto.getRandomValues(new Uint8Array(20))].map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  await store.set(id, buf, { metadata: { type } });
  return Response.json({ id, url: '/api/upload/' + id });
};

export const config = { path: ['/api/upload', '/api/upload/:id'], method: ['GET', 'POST'], rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
