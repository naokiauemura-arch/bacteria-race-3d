/* Bacteria Race 3D — shared times and online rooms.
 *
 * Two jobs in one Worker:
 *   1. the time table, kept in KV (binding SCORES)
 *   2. online races: one Durable Object per room, players talk over WebSockets
 *
 * Nothing stored here identifies a player: a time, a species tag, a date,
 * and whatever nickname someone types into the lobby.
 */

const COURSES = ['chip', 'gut', 'soil', 'squid', 'vent'];
const MODES   = ['battle', 'measured'];
const SPECIES = ['Cj', 'Ci', 'Ba', 'Se', 'Vf', 'Va', 'Fj', 'Bs'];
const KEEP    = 100;
const T_MIN   = 4;
const T_MAX   = 900;
const MAX_PLAYERS = 8;

const ALLOWED = [
  /^https:\/\/naokiauemura-arch\.github\.io$/,
  /^https:\/\/[a-z0-9-]+\.frame\.claudeusercontent\.com$/,
  /^https:\/\/claude\.ai$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
];
const allowed = o => !!o && ALLOWED.some(re => re.test(o));
function cors(origin) {
  return {
    'Access-Control-Allow-Origin': allowed(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}
const json = (body, origin, status) => new Response(JSON.stringify(body), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) }
});

function parseBucket(b) {
  if (typeof b !== 'string' || b.length > 32) return null;
  const p = b.split('|');
  if (p.length !== 3) return null;
  if (!COURSES.includes(p[0]) || !MODES.includes(p[1]) || !/^[0-3]$/.test(p[2])) return null;
  return 'lb:' + b;
}
async function addScore(env, bucket, time, species, name) {
  const key = parseBucket(bucket);
  if (!key) return { error: 'bad bucket' };
  const t = Number(time);
  if (!(t >= T_MIN && t <= T_MAX)) return { error: 'bad time' };
  if (!SPECIES.includes(species)) return { error: 'bad species' };
  const list = JSON.parse(await env.SCORES.get(key) || '[]');
  const row = { t: +t.toFixed(2), s: species, n: cleanName(name), d: Date.now() };
  list.push(row);
  list.sort((a, b) => a.t - b.t);
  const rank = list.indexOf(row) + 1;
  const kept = list.slice(0, KEEP);
  if (rank <= KEEP) await env.SCORES.put(key, JSON.stringify(kept));
  return { ok: true, rank, n: list.length, kept: rank <= KEEP, top: kept.slice(0, 10) };
}

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
    if (url.pathname === '/') return json({ ok: true, service: 'bacteria-race' }, origin);

    // ---- online rooms ----
    if (url.pathname.startsWith('/room/')) {
      const code = url.pathname.slice(6).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      if (code.length < 3) return json({ error: 'bad room' }, origin, 400);
      const id = env.ROOM.idFromName(code);
      return env.ROOM.get(id).fetch(request);
    }

    // ---- time table ----
    if (url.pathname === '/top' && request.method === 'GET') {
      const key = parseBucket(url.searchParams.get('b'));
      if (!key) return json({ error: 'bad bucket' }, origin, 400);
      const list = JSON.parse(await env.SCORES.get(key) || '[]');
      return json({ n: list.length, top: list }, origin);
    }
    if (url.pathname === '/score' && request.method === 'POST') {
      if (!allowed(origin)) return json({ error: 'origin' }, origin, 403);
      if (tooFast(request.headers.get('CF-Connecting-IP') || 'x')) return json({ error: 'slow down' }, origin, 429);
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, origin, 400); }
      const res = await addScore(env, body.b, body.t, body.s, body.n);
      return json(res, origin, res.error ? 400 : 200);
    }
    return json({ error: 'not found' }, origin, 404);
  }
};

/* ================= one room ================= */
export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.players = new Map();   // id -> {ws, sp, name, ready, fin}
    this.host = null;
    this.set = { course: 'chip', mode: 'battle', diff: 1 };
    this.phase = 'lobby';       // lobby | race
    this.next = 1;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket')
      return new Response(JSON.stringify({ players: this.players.size, phase: this.phase }),
        { headers: { 'Content-Type': 'application/json' } });
    if (this.players.size >= MAX_PLAYERS) return new Response('room full', { status: 503 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const id = 'p' + (this.next++);
    this.players.set(id, { ws: server, sp: null, name: '', ready: false, fin: null, last: 0 });
    if (!this.host) this.host = id;

    server.addEventListener('message', ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      this.onMessage(id, m);
    });
    const bye = () => this.drop(id);
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);

    this.send(id, { t: 'you', id, host: this.host === id });
    this.broadcastRoom();
    return new Response(null, { status: 101, webSocket: client });
  }

  send(id, msg) {
    const p = this.players.get(id);
    if (!p) return;
    try { p.ws.send(JSON.stringify(msg)); } catch (e) {}
  }
  all(msg, except) {
    const s = JSON.stringify(msg);
    for (const [id, p] of this.players) {
      if (id === except) continue;
      try { p.ws.send(s); } catch (e) {}
    }
  }
  roster() {
    return [...this.players].map(([id, p]) =>
      ({ id, sp: p.sp, name: p.name, ready: p.ready, host: id === this.host, fin: p.fin }));
  }
  broadcastRoom() {
    this.all({ t: 'room', players: this.roster(), set: this.set, phase: this.phase });
  }
  drop(id) {
    if (!this.players.has(id)) return;
    this.players.delete(id);
    if (this.host === id) this.host = this.players.keys().next().value || null;
    if (!this.players.size) { this.phase = 'lobby'; return; }
    this.all({ t: 'left', id });
    this.broadcastRoom();
  }

  onMessage(id, m) {
    const p = this.players.get(id);
    if (!p) return;
    switch (m.t) {
      case 'join': {
        p.name = String(m.name || '').slice(0, 12);
        if (SPECIES.includes(m.sp) && !this.taken(m.sp, id)) p.sp = m.sp;
        else p.sp = this.freeSpecies();
        this.broadcastRoom();
        break;
      }
      case 'sp': {                           // pick a cell nobody else has
        if (SPECIES.includes(m.sp) && !this.taken(m.sp, id)) { p.sp = m.sp; this.broadcastRoom(); }
        break;
      }
      case 'ready': { p.ready = !!m.v; this.broadcastRoom(); break; }
      case 'set': {                          // only the host chooses the course
        if (id !== this.host || this.phase !== 'lobby') break;
        if (COURSES.includes(m.course)) this.set.course = m.course;
        if (MODES.includes(m.mode)) this.set.mode = m.mode;
        if (/^[0-3]$/.test(String(m.diff))) this.set.diff = +m.diff;
        this.broadcastRoom();
        break;
      }
      case 'start': {
        if (id !== this.host || this.phase !== 'lobby') break;
        this.phase = 'race';
        for (const q of this.players.values()) { q.fin = null; q.ready = false; }
        this.all({ t: 'go', set: this.set, seed: Math.floor(Math.random() * 1e9),
                   players: this.roster(), host: this.host });
        break;
      }
      case 's': {                            // position, ten times a second
        const now = Date.now();
        if (now - p.last < 40) break;        // ignore anything faster than that
        p.last = now;
        this.all({ t: 's', id, d: m.d, x: m.x, f: m.f, b: m.b }, id);
        break;
      }
      case 'cs': { if (id === this.host) this.all({ t: 'cs', a: m.a }, id); break; }
      case 'hit': { this.all({ t: 'hit', from: id, to: m.to, k: m.k, sp: m.sp }, id); break; }
      case 'fin': {
        const time = Number(m.time);
        if (!(time >= T_MIN && time <= T_MAX)) break;
        p.fin = +time.toFixed(2);
        this.all({ t: 'fin', id, time: p.fin });
        // a finished online run also goes into the shared time table
        addScore(this.env, this.set.course + '|' + this.set.mode + '|' + this.set.diff,
                 p.fin, p.sp, p.name);
        if ([...this.players.values()].every(q => q.fin != null)) this.endRace();
        break;
      }
      case 'done': {                          // gave up or timed out
        p.fin = p.fin ?? null;
        if ([...this.players.values()].every(q => q.fin !== undefined && q.fin !== null)) this.endRace();
        break;
      }
      case 'back': { this.phase = 'lobby'; this.broadcastRoom(); break; }
      case 'ping': { this.send(id, { t: 'pong', c: m.c, now: Date.now() }); break; }
    }
  }
  taken(sp, exceptId) {
    for (const [id, p] of this.players) if (id !== exceptId && p.sp === sp) return true;
    return false;
  }
  freeSpecies() { return SPECIES.find(s => !this.taken(s, null)) || null; }
  endRace() {
    this.phase = 'lobby';
    this.all({ t: 'res', players: this.roster() });
  }
}
