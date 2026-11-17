// /api/share — read-only trip links.
// POST {doc}                          -> { id, token }   create a link
// PUT  ?id=  (x-share-token) {doc}    -> { ok }          update it with the latest trip
// DELETE ?id= (x-share-token)         -> { ok }          stop sharing
// GET  ?id=                           -> { doc, at }     what a viewer sees
// GET  /api/cal/<id>.ics               -> the trip as a calendar people can subscribe to
import { getStore } from '@netlify/blobs';

const rand = (n, A = 'abcdefghijkmnpqrstuvwxyz23456789') => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => A[b % A.length]).join('');
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('jps:' + s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

export default async (req, context) => {
  const store = getStore({ name: 'planner-shares', consistency: 'strong' });
  if (context.params?.cal) {
    const cid = context.params.cal.replace(/\.ics$/, '');
    const rec = /^[a-z0-9]{10}$/.test(cid) ? await store.get(cid, { type: 'json' }) : null;
    if (!rec?.ics) return new Response('Not found', { status: 404 });
    return new Response(rec.ics, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'public, max-age=900' } });
  }
  const id = new URL(req.url).searchParams.get('id') || '';
  if (req.method === 'GET') {
    if (!/^[a-z0-9]{10}$/.test(id)) return Response.json({ error: 'Bad link' }, { status: 400 });
    const rec = await store.get(id, { type: 'json' });
    return rec ? Response.json({ doc: rec.doc, at: rec.at }, { headers: { 'cache-control': 'no-store' } }) : Response.json({ error: 'This trip is no longer shared' }, { status: 404 });
  }
  const read = async () => { const t = await req.text(); if (t.length > 3_000_000) throw new Error('Too large'); const j = JSON.parse(t); if (typeof j?.doc !== 'string') throw new Error('Missing doc'); return { doc: j.doc, ics: typeof j.ics === 'string' ? j.ics : '' }; };
  if (req.method === 'POST') {
    let body; try { body = await read(); } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    const newId = rand(10), token = rand(32);
    await store.setJSON(newId, { ...body, tokenHash: await sha(token), at: Date.now() });
    return Response.json({ id: newId, token });
  }
  if (!/^[a-z0-9]{10}$/.test(id)) return Response.json({ error: 'Bad link' }, { status: 400 });
  const rec = await store.get(id, { type: 'json' });
  if (!rec) return Response.json({ error: 'Not found' }, { status: 404 });
  if (rec.tokenHash !== await sha(req.headers.get('x-share-token') || '')) return Response.json({ error: 'Not yours' }, { status: 403 });
  if (req.method === 'DELETE') { await store.delete(id); return Response.json({ ok: true }); }
  let body; try { body = await read(); } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
  await store.setJSON(id, { ...rec, ...body, at: Date.now() });
  return Response.json({ ok: true });
};

export const config = { path: ['/api/share', '/api/cal/:cal'], method: ['GET', 'POST', 'PUT', 'DELETE'], rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
