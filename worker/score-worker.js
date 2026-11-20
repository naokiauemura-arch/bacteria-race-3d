/* Bacteria Race 3D — shared time table.
 *
 * Runs on Cloudflare Workers with one KV namespace bound as SCORES.
 * The page sends a finished time; this keeps the best 100 for each
 * course + mode + CPU setting and answers with where the run lands.
 *
 * Endpoints
 *   GET  /top?b=<bucket>          -> {n, top:[{t,s,d}, ...]}
 *   POST /score  {b,t,s}          -> {ok, rank, n, top:[...]}
 *   GET  /                        -> a one-line health check
 *
 * Nothing here identifies a player. Only the time, the three-letter
 * species tag and the date are stored.
 */

const COURSES = ['chip', 'gut', 'soil', 'squid', 'vent'];
const MODES   = ['battle', 'measured'];
const SPECIES = ['Cj', 'Ci', 'Ba', 'Se', 'Vf', 'Va', 'Fj', 'Bs'];
const KEEP    = 100;          // how many times to keep per table
const T_MIN   = 4;            // seconds; below this nobody finished honestly
const T_MAX   = 900;

// Pages allowed to talk to this Worker.
const ALLOWED = [
  /^https:\/\/naokiauemura-arch\.github\.io$/,
  /^https:\/\/[a-z0-9-]+\.frame\.claudeusercontent\.com$/,
  /^https:\/\/claude\.ai$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
];
function cors(origin) {
  const ok = origin && ALLOWED.some(re => re.test(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}
const json = (body, origin, status) => new Response(JSON.stringify(body), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) }
});

// bucket looks like "gut|measured|1"
function parseBucket(b) {
  if (typeof b !== 'string' || b.length > 32) return null;
  const p = b.split('|');
  if (p.length !== 3) return null;
  if (!COURSES.includes(p[0])) return null;
  if (!MODES.includes(p[1])) return null;
  if (!/^[0-3]$/.test(p[2])) return null;
  return 'lb:' + b;
}

// A light brake on one address hammering the endpoint. Lives in the isolate,
// so it is not exact — it only exists to stop accidental loops.
// Names are typed by players, so keep them short and strip anything that could
// confuse the page that displays them.
function cleanName(n) {
  return String(n == null ? '' : n).replace(/[\u0000-\u001f<>&"']/g, '').trim().slice(0, 12);
}

const seen = new Map();
function tooFast(ip) {
  const now = Date.now(), last = seen.get(ip) || 0;
  if (now - last < 3000) return true;
  seen.set(ip, now);
  if (seen.size > 5000) seen.clear();
  return false;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });

    if (url.pathname === '/' ) return json({ ok: true, service: 'bacteria-race-scores' }, origin);

    if (url.pathname === '/top' && request.method === 'GET') {
      const key = parseBucket(url.searchParams.get('b'));
      if (!key) return json({ error: 'bad bucket' }, origin, 400);
      const list = JSON.parse(await env.SCORES.get(key) || '[]');
      return json({ n: list.length, top: list }, origin);
    }

    if (url.pathname === '/score' && request.method === 'POST') {
      if (!origin || !ALLOWED.some(re => re.test(origin))) return json({ error: 'origin' }, origin, 403);
      const ip = request.headers.get('CF-Connecting-IP') || 'x';
      if (tooFast(ip)) return json({ error: 'slow down' }, origin, 429);

      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, origin, 400); }

      const key = parseBucket(body.b);
      const t = Number(body.t);
      const s = body.s;
      if (!key) return json({ error: 'bad bucket' }, origin, 400);
      if (!(t >= T_MIN && t <= T_MAX)) return json({ error: 'bad time' }, origin, 400);
      if (!SPECIES.includes(s)) return json({ error: 'bad species' }, origin, 400);

      const list = JSON.parse(await env.SCORES.get(key) || '[]');
      const row = { t: +t.toFixed(2), s: s, n: cleanName(body.n), d: Date.now() };
      list.push(row);
      list.sort((a, b2) => a.t - b2.t);
      const rank = list.indexOf(row) + 1;
      const kept = list.slice(0, KEEP);

      // Only spend a KV write when the run actually belongs in the table.
      if (rank <= KEEP) await env.SCORES.put(key, JSON.stringify(kept));

      return json({ ok: true, rank: rank, n: list.length, kept: rank <= KEEP, top: kept.slice(0, 10) }, origin);
    }

    return json({ error: 'not found' }, origin, 404);
  }
};
