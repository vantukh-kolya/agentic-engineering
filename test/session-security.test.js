import { startServer, fixtureHome, repoRoot } from './helpers.js';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { getSource } from '../lib/sources.js';
import { esc } from '../views/layout.js';

const server = await startServer();
after(() => server.close());

function syntheticHome(t) {
  const home = fs.mkdtempSync(join(tmpdir(), 'agent-ops-security-'));
  const project = join(home, 'projects', '-synthetic-project');
  fs.mkdirSync(join(project, 'main', 'subagents'), { recursive: true });
  fs.writeFileSync(join(project, 'main.jsonl'), 'SYNTHETIC_SECRET_A');
  fs.writeFileSync(join(project, 'main', 'subagents', 'nested.jsonl'), 'SYNTHETIC_NESTED');
  fs.writeFileSync(join(project, 'notes.txt'), 'SYNTHETIC_NOTES');
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

function snapshot(root) {
  const entries = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const path = join(dir, name);
      const stat = fs.lstatSync(path);
      entries.push({ path: path.slice(root.length), directory: stat.isDirectory(), size: stat.size, mtimeMs: stat.mtimeMs,
        contents: stat.isFile() ? fs.readFileSync(path).toString('base64') : null });
      if (stat.isDirectory()) walk(path);
    }
  }
  walk(root);
  return entries;
}

function watchSource(t, home) {
  const attempts = { reads: [], writes: [], outside: [] };
  const within = path => typeof path === 'string' && (resolve(path) === resolve(home) || resolve(path).startsWith(resolve(home) + sep));
  for (const method of ['openSync', 'readFileSync', 'createReadStream', 'readFile', 'open']) {
    const original = fs[method];
    t.mock.method(fs, method, (path, ...args) => {
      if (within(path)) {
        if (method === 'openSync' && /[wa+]/.test(String(args[0]))) attempts.writes.push(method);
        else attempts.reads.push(method);
        throw new Error('Synthetic content access denied');
      }
      return original(path, ...args);
    });
  }
  for (const method of ['writeFileSync', 'appendFileSync', 'truncateSync', 'unlinkSync', 'renameSync', 'mkdirSync', 'rmdirSync', 'rmSync', 'copyFileSync', 'linkSync', 'symlinkSync', 'chmodSync', 'chownSync', 'utimesSync']) {
    const original = fs[method];
    t.mock.method(fs, method, (...args) => {
      if (args.slice(0, 2).some(within)) {
        attempts.writes.push(method);
        throw new Error('Synthetic source write denied');
      }
      return original(...args);
    });
  }
  for (const method of ['readdirSync', 'lstatSync', 'statSync', 'realpathSync']) {
    const original = fs[method];
    t.mock.method(fs, method, (path, ...args) => {
      if (typeof path === 'string' && (path.endsWith(`${sep}projects`) || path.endsWith('.jsonl')) && !within(path)) {
        attempts.outside.push(path);
        throw new Error('Synthetic source isolation guard');
      }
      return original(path, ...args);
    });
  }
  syncBuiltinESMExports();
  return attempts;
}

test('index requests make zero content opens or writes and leave the entire source unchanged', async t => {
  const home = syntheticHome(t);
  const before = snapshot(home);
  const attempts = watchSource(t, home);
  const logs = [];
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, (...args) => logs.push(args));
  const response = await server.get('/');
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.deepEqual(attempts.reads, [], 'Runtime must make zero attempts to open source contents');
  assert.deepEqual(attempts.writes, [], 'Runtime must make zero attempts to write the source');
  assert.deepEqual(attempts.outside, []);
  assert.deepEqual(logs, []);
  assert.match(html, /Показано 1 із 1 сесій/);
  assert.doesNotMatch(html, /SYNTHETIC_SECRET|SYNTHETIC_NESTED|nested\.jsonl/);
  t.mock.restoreAll();
  syncBuiltinESMExports();
  assert.deepEqual(snapshot(home), before);
});

test('same-size transcript changes with preserved mtime produce identical HTML', async t => {
  const home = syntheticHome(t);
  const before = await server.text('/');
  const file = join(home, 'projects', '-synthetic-project', 'main.jsonl');
  const stat = fs.lstatSync(file);
  fs.writeFileSync(file, 'SYNTHETIC_SECRET_B');
  fs.utimesSync(file, stat.atime, stat.mtime);
  assert.equal(fs.lstatSync(file).size, stat.size);
  // Date conversion can round a submillisecond mtime: pin once before comparing requests.
  const pinned = await server.text('/');
  fs.writeFileSync(file, 'SYNTHETIC_SECRET_A');
  fs.utimesSync(file, stat.atime, stat.mtime);
  assert.equal(await server.text('/'), pinned);
  assert.doesNotMatch(before + pinned, /SYNTHETIC_SECRET/);
});

test('HTML escapes every source field and home while retaining the original CSP and shell', async t => {
  const marker = '\"><img data-agent-probe src=x onerror=window.__agentProbe=1>&';
  const source = getSource('claude');
  t.mock.method(source, 'home', () => marker);
  t.mock.method(source, 'listSessions', () => ({
    state: 'complete', sessions: [{ id: marker, projectKey: marker, projectPath: marker, sizeBytes: 123, mtimeMs: 0 }],
    skippedProjects: 0, skippedFiles: 0,
  }));
  const html = await server.text('/');
  assert.doesNotMatch(html, /<img|<script[^>]*>[^<]/);
  assert.ok(html.includes(`title="${esc(marker)}"`));
  assert.ok(html.includes(`Reading <code>${esc(marker)}</code>`));
  assert.match(html, /content="default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:"/);
  assert.match(html, /href="\/" aria-current="page"/);
  assert.match(html, /data-theme-toggle/);
});

test('source guards detect attempted operations even when the caller catches the refusal', t => {
  const home = syntheticHome(t);
  const attempts = watchSource(t, home);
  const file = join(home, 'projects', '-synthetic-project', 'main.jsonl');
  assert.throws(() => fs.readFileSync(file), /Synthetic content access denied/);
  assert.throws(() => fs.writeFileSync(file, 'attempt'), /Synthetic source write denied/);
  assert.equal(attempts.reads.length, 1);
  assert.equal(attempts.writes.length, 1);
});

test('child links are excluded by type without enumerating targets in HTTP requests', async t => {
  const home = syntheticHome(t);
  const project = join(home, 'projects', '-synthetic-project');
  const original = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (path, ...args) => {
    assert.ok(path === join(home, 'projects') || path === project, 'No nested or linked directory may be enumerated');
    const entries = original(path, ...args);
    return [...entries, { name: 'external.jsonl', isFile: () => false, isDirectory: () => false, isSymbolicLink: () => true }];
  });
  syncBuiltinESMExports();
  const html = await server.text('/');
  assert.match(html, /Показано 1 із 1 сесій/);
  assert.doesNotMatch(html, /перелік неповний|external\.jsonl/);
});

test('listener remains loopback-only and the health contract remains unchanged', async () => {
  const code = fs.readFileSync(join(repoRoot, 'server.js'), 'utf8');
  assert.match(code, /app\.listen\(PORT, '127\.0\.0\.1'/);
  assert.deepEqual(await server.json('/api/health'), {
    ok: true, sources: [{ id: 'claude', label: 'Claude Code' }], claudeHome: fixtureHome,
  });
});
