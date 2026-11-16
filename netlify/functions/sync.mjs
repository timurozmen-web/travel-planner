// /api/sync — keeps one person's trips in Netlify Blobs under a private sync code.
// The code (sent as the x-sync-code header) is the only key; it is hashed before use.
// GET -> { json, at } or 404.  PUT { json, at } -> { ok, at }.
import { getStore } from '@netlify/blobs';

const hashOf = async (code) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('jp1:' + code)))].map((b) => b.toString(16).padStart(2, '0')).join('');

export default async (req) => {
  const code = req.headers.get('x-sync-code') || '';
  if (!/^[A-Za-z0-9-]{16,64}$/.test(code)) return Response.json({ error: 'Bad sync code' }, { status: 400 });
  const store = getStore({ name: 'planner-sync', consistency: 'strong' });
  const key = await hashOf(code);
  if (req.method === 'GET') {
    const doc = await store.get(key, { type: 'json' });
    return doc ? Response.json(doc, { headers: { 'cache-control': 'no-store' } }) : Response.json({ error: 'Nothing saved for this code yet' }, { status: 404 });
  }
  const text = await req.text();
  if (text.length > 4_000_000) return Response.json({ error: 'Too large' }, { status: 413 });
  let doc; try { doc = JSON.parse(text); } catch { return Response.json({ error: 'Send JSON' }, { status: 400 }); }
  if (typeof doc?.json !== 'string') return Response.json({ error: 'Missing json' }, { status: 400 });
  const at = Number(doc.at) || Date.now();
  await store.setJSON(key, { json: doc.json, packs: typeof doc.packs === 'string' ? doc.packs : '', at });
  return Response.json({ ok: true, at });
};

export const config = { path: '/api/sync', method: ['GET', 'PUT'], rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
