import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const KEY = 'test-key';
let base = '';
let failures = 0;
const check = (name: string, cond: boolean, extra?: any) => {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + JSON.stringify(extra)}`);
};
async function api(method: string, path: string, body?: any, headers: Record<string, string> = {}, key: string | null = KEY) {
  const h: Record<string, string> = { 'content-type': 'application/json', ...headers };
  if (key) h['x-api-key'] = key;
  const r = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await r.text();
  let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json, headers: r.headers };
}

(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pg-'));
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port: 54329, persistent: false });
  await pg.initialise(); await pg.start();
  process.env.DATABASE_URL = 'postgres://postgres:pw@127.0.0.1:54329/postgres';
  process.env.API_KEY = KEY;
  const { createApp } = await import('../src/main');
  const app = await createApp();
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', 'localhost');

  const future = (h: number) => new Date(Date.now() + h * 3600e3).toISOString().replace(/\.\d+Z/, 'Z');
  const slots = [
    { id: 's1', provider: 'Dr Ade', start: future(48), end: future(48.5) },
    { id: 's2', provider: 'Dr Ade', start: future(24), end: future(24.5) },
    { id: 's3', provider: 'Dr Bello', start: future(30), end: future(30.5) },
    { id: 'past', provider: 'Dr Ade', start: future(-2), end: future(-1.5) },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, provider: 'Dr Pat', start: future(100 + i), end: future(100.5 + i) })),
  ];

  // L2 auth
  check('no key -> 401', (await api('GET', '/slots', undefined, {}, null)).status === 401);
  check('wrong key -> 401', (await api('GET', '/slots', undefined, {}, 'nope')).status === 401);
  check('reset needs key', (await api('POST', '/reset', { slots }, {}, null)).status === 401);
  check('401 shape', typeof (await api('GET', '/slots', undefined, {}, null)).json.error === 'string');
  check('static page public', (await fetch(base + '/')).status === 200);

  // L1
  check('reset 200', (await api('POST', '/reset', { slots })).status === 200);
  let r = await api('GET', '/slots');
  check('slots sorted by start', r.json.slots.map((s: any) => s.id).join() === 'past,s2,s3,s1,p0,p1,p2,p3,p4,p5,p6,p7', r.json.slots.map((s: any) => s.id));
  check('slot fields + raw date preserved', r.json.slots.find((s: any) => s.id === 's1').start === slots[0].start && r.json.slots[0].available === true);
  check('provider filter', (await api('GET', '/slots?provider=Dr%20Bello')).json.slots.length === 1);
  check('provider exact', (await api('GET', '/slots?provider=dr%20bello')).json.slots.length === 0);

  r = await api('POST', '/bookings', { slot_id: 's1', name: '  Ada Obi ', email: '  ADA@Example.com ' });
  check('book 201', r.status === 201 && r.json.status === 'confirmed' && r.json.name === 'Ada Obi' && r.json.email === 'ada@example.com', r);
  const id = r.json.id;
  check('get booking', (await api('GET', `/bookings/${id}`)).json.id === id);
  check('get unknown 404', (await api('GET', '/bookings/nope')).status === 404);
  check('slot now unavailable', (await api('GET', '/slots')).json.slots.find((s: any) => s.id === 's1').available === false);

  // L2 validation
  const v = (b: any) => api('POST', '/bookings', b).then((x) => x.status);
  check('missing slot_id 400', (await v({ name: 'a', email: 'x1@y.com' })) === 400);
  check('missing name 400', (await v({ slot_id: 's2', email: 'x2@y.com' })) === 400);
  check('blank name 400', (await v({ slot_id: 's2', name: '   ', email: 'x3@y.com' })) === 400);
  check('missing email 400', (await v({ slot_id: 's2', name: 'a' })) === 400);
  check('bad email 400', (await v({ slot_id: 's2', name: 'a', email: 'nope' })) === 400);
  check('non-string name 400', (await v({ slot_id: 's2', name: 5, email: 'x4@y.com' })) === 400);
  check('unknown slot 404', (await v({ slot_id: 'zzz', name: 'a', email: 'x5@y.com' })) === 404);
  check('past slot 400', (await v({ slot_id: 'past', name: 'a', email: 'x6@y.com' })) === 400);
  check('malformed JSON 400', (await api('POST', '/bookings', '{bad')).status === 400);
  check('empty body 400', (await api('POST', '/bookings', '')).status === 400);

  // L3
  r = await api('POST', '/bookings', { slot_id: 's1', name: 'Bob', email: 'bob@example.com' });
  check('double book 409', r.status === 409 && typeof r.json.error === 'string', r);
  const race = await Promise.all(Array.from({ length: 50 }, (_, i) => api('POST', '/bookings', { slot_id: 's2', name: 'R' + i, email: `race${i}@example.com` })));
  const c = (s: number) => race.filter((x) => x.status === s).length;
  check('50 simultaneous: exactly one 201, 49 x 409', c(201) === 1 && c(409) === 49, { 201: c(201), 409: c(409) });
  const cancel = await api('DELETE', `/bookings/${id}`);
  check('cancel 200 cancelled', cancel.status === 200 && cancel.json.status === 'cancelled', cancel);
  check('cancel again 409', (await api('DELETE', `/bookings/${id}`)).status === 409);
  check('cancel unknown 404', (await api('DELETE', '/bookings/nope')).status === 404);
  check('slot freed', (await api('GET', '/slots')).json.slots.find((s: any) => s.id === 's1').available === true);
  r = await api('POST', '/bookings', { slot_id: 's1', name: 'Bob', email: 'bob@example.com' });
  check('rebook freed slot 201', r.status === 201, r);
  check('get cancelled still readable', (await api('GET', `/bookings/${id}`)).json.status === 'cancelled');

  // L4 idempotency
  const body = { slot_id: 's3', name: 'Idem', email: 'idem@example.com' };
  const a1 = await api('POST', '/bookings', body, { 'Idempotency-Key': 'k1' });
  const a2 = await api('POST', '/bookings', body, { 'Idempotency-Key': 'k1' });
  check('same key same body: same status+id', a1.status === 201 && a2.status === 201 && a1.json.id === a2.json.id, [a1, a2]);
  const a3 = await api('POST', '/bookings', { ...body, name: 'Other' }, { 'Idempotency-Key': 'k1' });
  check('same key diff body 422', a3.status === 422, a3);
  check('no duplicate booking created', (await api('GET', '/bookings?email=idem@example.com')).json.bookings.length === 1);
  const conc = await Promise.all(Array.from({ length: 10 }, () => api('POST', '/bookings', { slot_id: 'p0', name: 'C', email: 'conc@example.com' }, { 'Idempotency-Key': 'kc' })));
  check('10 concurrent same key: one id, all 201', new Set(conc.map((x) => x.json.id)).size === 1 && conc.every((x) => x.status === 201), conc.map((x) => x.status));
  const e1 = await api('POST', '/bookings', { slot_id: 's3', name: 'Z', email: 'z@example.com' }, { 'Idempotency-Key': 'k409' });
  const e2 = await api('POST', '/bookings', { slot_id: 's3', name: 'Z', email: 'z@example.com' }, { 'Idempotency-Key': 'k409' });
  check('409 replays as 409', e1.status === 409 && e2.status === 409);

  // pagination
  for (let i = 0; i < 5; i++) await api('POST', '/bookings', { slot_id: `p${i + 1}`, name: 'P', email: 'Pager@Example.com' });
  let seen: string[] = []; let cur: string | null = null; let pages = 0;
  do {
    const p: any = await api('GET', `/bookings?email=PAGER@example.com&limit=2${cur ? '&cursor=' + cur : ''}`);
    seen.push(...p.json.bookings.map((b: any) => b.slot_id)); cur = p.json.next_cursor; pages++;
  } while (cur && pages < 10);
  check('paging: 3 pages, 5 items oldest first, null end', pages === 3 && seen.join() === 'p1,p2,p3,p4,p5', { pages, seen });
  check('limit 0 -> 400', (await api('GET', '/bookings?email=a@b.com&limit=0')).status === 400);
  check('limit 51 -> 400', (await api('GET', '/bookings?email=a@b.com&limit=51')).status === 400);
  check('limit abc -> 400', (await api('GET', '/bookings?email=a@b.com&limit=abc')).status === 400);
  check('limit 50 ok', (await api('GET', '/bookings?email=a@b.com&limit=50')).status === 200);
  check('email required', (await api('GET', '/bookings')).status === 400);
  check('bad cursor 400', (await api('GET', '/bookings?email=a@b.com&cursor=!!')).status === 400);
  const none = await api('GET', '/bookings?email=nobody@x.com');
  check('empty list', none.json.bookings.length === 0 && none.json.next_cursor === null);

  // L5 rate limit
  const rl: any[] = [];
  for (let i = 0; i < 7; i++) rl.push(await api('POST', '/bookings', { slot_id: 'nope', name: 'S', email: 'spam@example.com' }));
  check('attempts 1-5 pass through (404), 6th+ 429', rl.slice(0, 5).every((x) => x.status === 404) && rl[5].status === 429 && rl[6].status === 429, rl.map((x) => x.status));
  const ra = Number(rl[5].headers.get('retry-after'));
  check('Retry-After whole seconds 1..60', Number.isInteger(ra) && ra >= 1 && ra <= 60, ra);
  check('429 shape', typeof rl[5].json.error === 'string');
  check('other email unaffected', (await api('POST', '/bookings', { slot_id: 'nope', name: 'S', email: 'other@example.com' })).status === 404);
  const burst = await Promise.all(Array.from({ length: 20 }, () => api('POST', '/bookings', { slot_id: 'nope', name: 'S', email: 'burst@example.com' })));
  check('20 parallel: exactly 5 pass, 15 x 429', burst.filter((x) => x.status === 404).length === 5 && burst.filter((x) => x.status === 429).length === 15);
  check('case-insensitive limit', (await api('POST', '/bookings', { slot_id: 'nope', name: 'S', email: 'SPAM@example.com' })).status === 429);

  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  await app.close(); await pg.stop();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
