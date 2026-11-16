// /api/ai — Claude for the web version, through Netlify AI Gateway (no key stored in the repo).
// GET  -> { ok } so the page knows whether to show the Claude buttons.
// POST { prompt, tier: 'quick' | 'default' } -> streamed plain text of Claude's answer.
import Anthropic from '@anthropic-ai/sdk';

const MODELS = { quick: 'claude-haiku-5-5', default: 'claude-sonnet-5-5' };

export default async (req) => {
  const ready = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_BASE_URL);
  if (req.method === 'GET') return Response.json({ ok: ready });
  if (!ready) return Response.json({ error: 'AI Gateway is not active on this site' }, { status: 503 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Send JSON' }, { status: 400 }); }
  const prompt = String(body?.prompt || '').slice(0, 12000);
  if (!prompt) return Response.json({ error: 'Empty prompt' }, { status: 400 });
  const model = Netlify.env.get('PLANNER_MODEL') || MODELS[body.tier] || MODELS.default;
  const client = new Anthropic();
  const stream = client.messages.stream({ model, max_tokens: 6000, messages: [{ role: 'user', content: prompt }] });
  const enc = new TextEncoder();
  const out = new ReadableStream({
    async start(ctrl) {
      try {
        stream.on('text', (t) => ctrl.enqueue(enc.encode(t)));
        await stream.finalMessage();
      } catch (e) {
        ctrl.enqueue(enc.encode(`\n[[error:${String(e?.message || e).slice(0, 200)}]]`));
      }
      ctrl.close();
    },
  });
  return new Response(out, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
};

export const config = {
  path: '/api/ai',
  method: ['GET', 'POST'],
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
