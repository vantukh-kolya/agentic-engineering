import { startServer, fixtureHome } from './helpers.js';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join, basename, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { sessionFiles } from './oracle.js';
import { getSource } from '../lib/sources.js';
import { esc } from '../views/layout.js';

const server = await startServer();
after(() => server.close());
const ids = html => [...html.matchAll(/<code class="id"[^>]*>([^<]*)<\/code>/g)].map(match => match[1]);

function homeFor(t) {
  const home = fs.mkdtempSync(join(tmpdir(), 'agent-ops-http-'));
  const previous = process.env.CLAUDE_HOME;
  process.env.CLAUDE_HOME = home;
  t.after(() => {
    process.env.CLAUDE_HOME = previous;
    t.mock.restoreAll();
    syncBuiltinESMExports();
    fs.rmSync(home, { recursive: true, force: true });
  });
  return home;
}

function session(home, project, id, timestamp) {
  const dir = join(home, 'projects', project);
  fs.mkdirSync(dir, { recursive: true });
  const path = join(dir, `${id}.jsonl`);
  fs.writeFileSync(path, 'synthetic');
  const date = new Date(timestamp);
  fs.utimesSync(path, date, date);
}

test('the root lists all six main fixtures with exact metadata and the registered source', async () => {
  const html = await server.text('/');
  const files = sessionFiles(join(fixtureHome, 'projects'), { exactDepth: 2 });
  assert.equal(ids(html).length, 6);
  for (const file of files) {
    const stat = fs.lstatSync(file);
    assert.ok(html.includes(basename(file, '.jsonl')));
    assert.ok(html.includes(basename(dirname(file))));
    assert.ok(html.includes(String(stat.size)));
    assert.ok(html.includes(new Date(stat.mtimeMs).toISOString()));
  }
  assert.match(html, /class="source">Claude Code/);
  assert.ok(html.includes(esc(fixtureHome)));
  assert.equal(typeof getSource('claude').listSessions, 'function');
});

test('global sort precedes limits 1, 50 and 1000 on a tree larger than 1000 sessions', async t => {
  const home = homeFor(t);
  for (let i = 0; i < 1005; i++) {
    session(home, i % 2 ? '-A' : '-z', `session-${String(i).padStart(4, '0')}`, 1700000000000 + i * 1000);
  }
  const expected = Array.from({ length: 1005 }, (_, i) => `session-${String(1004 - i).padStart(4, '0')}`);
  for (const [query, limit] of [['', 50], ['?limit=1', 1], ['?limit=0001', 1], ['?limit=1000', 1000]]) {
    const response = await server.get(`/${query}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.deepEqual(ids(html), expected.slice(0, limit));
    assert.ok(html.includes(`Показано ${limit} із 1005 сесій`));
    assert.ok(html.includes(`Ліміт: ${limit}`));
    assert.deepEqual(ids(await server.text(`/${query}`)), expected.slice(0, limit));
  }
});

test('equal mtimes sort by case-sensitive project keys and then session ids', async t => {
  const home = homeFor(t);
  // Distinct suffixes keep the case-order scenario valid on case-insensitive filesystems.
  for (const project of ['-alpha', '-Zulu', '-AlphaUpper']) {
    for (const id of ['alpha', 'Zulu', 'AlphaUpper']) session(home, project, `${project}-${id}`, 1700000000000);
  }
  const expected = [
    '-AlphaUpper-AlphaUpper', '-AlphaUpper-Zulu', '-AlphaUpper-alpha',
    '-Zulu-AlphaUpper', '-Zulu-Zulu', '-Zulu-alpha',
    '-alpha-AlphaUpper', '-alpha-Zulu', '-alpha-alpha',
  ];
  assert.deepEqual(ids(await server.text('/')), expected);
  assert.deepEqual(ids(await server.text('/?limit=2')), expected.slice(0, 2));
});

test('missing and empty configured sources never fall back to the fixture source', async t => {
  const home = homeFor(t);
  for (const createProjects of [false, true]) {
    if (createProjects) fs.mkdirSync(join(home, 'projects'));
    const response = await server.get('/');
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Сесій поки немає/);
    assert.match(html, /Показано 0 із 0 сесій/);
    assert.deepEqual(ids(html), []);
    assert.ok(html.includes(esc(home)));
    assert.ok(!html.includes(fixtureHome));
  }
});

test('root enumeration failure is HTTP 503 without successful zero totals or fallback', async t => {
  const home = homeFor(t);
  fs.mkdirSync(join(home, 'projects'));
  const original = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (path, ...args) => {
    if (path === join(home, 'projects')) throw new Error('Synthetic root refusal');
    return original(path, ...args);
  });
  syncBuiltinESMExports();
  const response = await server.get('/');
  const html = await response.text();
  assert.equal(response.status, 503);
  assert.match(html, /Не вдалося прочитати джерело сесій/);
  assert.doesNotMatch(html, /<table|Показано|Сесій поки немає|Synthetic|stack/);
  assert.ok(!html.includes(fixtureHome));
});

test('partial project access is HTTP 200 with accessible rows and honest counts', async t => {
  const home = homeFor(t);
  session(home, '-a', 'kept', 1700000000000);
  session(home, '-b', 'denied', 1700000000000);
  const original = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (path, ...args) => {
    if (path === join(home, 'projects', '-b')) throw new Error('Synthetic project refusal');
    return original(path, ...args);
  });
  syncBuiltinESMExports();
  const response = await server.get('/');
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.deepEqual(ids(html), ['kept']);
  assert.match(html, /Показано 1 із 1 доступних сесій/);
  assert.match(html, /Пропущено проєктів: 1/);
  assert.match(html, /Пропущено файлів: 0/);
  assert.match(html, /Загальна кількість сесій джерела невідома/);
});

test('all projects denied still yields HTTP 200 partial rather than a source error', async t => {
  const home = homeFor(t);
  session(home, '-a', 'unavailable', 1700000000000);
  const original = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (path, ...args) => {
    if (path === join(home, 'projects', '-a')) throw new Error('Synthetic project refusal');
    return original(path, ...args);
  });
  syncBuiltinESMExports();
  const response = await server.get('/');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Доступних сесій не знайдено; перелік неповний/);
  assert.match(html, /Показано 0 із 0 доступних сесій/);
  assert.doesNotMatch(html, /Сесій поки немає|<table/);
});

test('a project lost after a row keeps that row in global sorting and limiting', async t => {
  const home = homeFor(t);
  session(home, '-a', 'first', 1700000002000);
  session(home, '-a', 'second', 1700000000000);
  session(home, '-b', 'other', 1700000001000);
  const original = fs.lstatSync;
  t.mock.method(fs, 'lstatSync', (path, ...args) => {
    const result = original(path, ...args);
    if (path === join(home, 'projects', '-a', 'first.jsonl')) fs.rmSync(join(home, 'projects', '-a'), { recursive: true });
    return result;
  });
  syncBuiltinESMExports();
  const html = await server.text('/?limit=1');
  assert.deepEqual(ids(html), ['first']);
  assert.match(html, /Показано 1 із 2 доступних сесій/);
  assert.match(html, /Пропущено проєктів: 1/);
  assert.match(html, /Пропущено файлів: 0/);
});

test('invalid limits reject requests before invoking the registered reader', async t => {
  const source = getSource('claude');
  assert.equal(typeof source.listSessions, 'function');
  const spy = t.mock.method(source, 'listSessions', () => assert.fail('Reader invoked for invalid limit'));
  for (const query of ['limit=', 'limit=0', 'limit=1&limit=1', 'limit[]=1', 'limit%5Bx%5D=1']) {
    assert.equal((await server.get(`/?${query}`)).status, 400);
  }
  assert.equal(spy.mock.callCount(), 0);
});

test('health retains exactly its existing keys even for an unavailable configured source', async t => {
  const home = homeFor(t);
  assert.deepEqual(await server.json('/api/health'), {
    ok: true, sources: [{ id: 'claude', label: 'Claude Code' }], claudeHome: home,
  });
});
