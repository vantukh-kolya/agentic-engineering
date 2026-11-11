import { fixtureHome } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { sessionFiles } from './oracle.js';
import { listSessions } from '../lib/claude/sessions.js';

function temporaryHome(t) {
  const home = fs.mkdtempSync(join(tmpdir(), 'agent-ops-session-metadata-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

function writeSession(home, projectKey, filename, content = 'synthetic invalid JSON') {
  const project = join(home, 'projects', projectKey);
  fs.mkdirSync(project, { recursive: true });
  const path = join(project, filename);
  fs.writeFileSync(path, content);
  fs.utimesSync(path, new Date('2026-01-02T03:04:05Z'), new Date('2026-02-03T04:05:06Z'));
  return path;
}

function emptyResult() {
  return { state: 'complete', sessions: [], skippedProjects: 0, skippedFiles: 0 };
}

function sortRows(rows) {
  return rows.toSorted((a, b) => {
    const left = `${a.projectKey}/${a.id}`;
    const right = `${b.projectKey}/${b.id}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

function restoreFs(t) {
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
}

test('metadata matches all six main fixture sessions and the independent exact-depth oracle', () => {
  const projects = join(fixtureHome, 'projects');
  const files = sessionFiles(projects, { exactDepth: 2 });
  assert.equal(files.length, 6);
  const expected = files.map(path => {
    const projectKey = basename(dirname(path));
    const metadata = fs.lstatSync(path);
    return {
      id: basename(path, '.jsonl'),
      projectKey,
      projectPath: projectKey.replaceAll('-', '/'),
      sizeBytes: metadata.size,
      mtimeMs: metadata.mtimeMs,
    };
  });
  const result = listSessions(projects);
  assert.equal(result.state, 'complete');
  assert.equal(result.skippedProjects, 0);
  assert.equal(result.skippedFiles, 0);
  assert.deepEqual(sortRows(result.sessions), sortRows(expected));
  assert.equal(new Set(result.sessions.map(row => row.projectKey)).size, 3);
  assert.equal(new Set(result.sessions.map(row => `${row.projectKey}/${row.id}`)).size, 6);
});

test('configured trees preserve duplicate non-UUID ids across projects and exact metadata', t => {
  const home = temporaryHome(t);
  const first = writeSession(home, '-work-api-service', 'not-a-uuid.jsonl', 'дані');
  writeSession(home, '-work-other', 'not-a-uuid.jsonl', 'other synthetic bytes');
  const result = listSessions(join(home, 'projects'));
  assert.equal(result.state, 'complete');
  assert.equal(result.sessions.length, 2);
  assert.deepEqual(result.sessions.map(row => row.id), ['not-a-uuid', 'not-a-uuid']);
  const row = result.sessions.find(row => row.projectKey === '-work-api-service');
  assert.deepEqual(row, {
    id: 'not-a-uuid',
    projectKey: '-work-api-service',
    projectPath: '/work/api/service',
    sizeBytes: Buffer.byteLength('дані'),
    mtimeMs: fs.lstatSync(first).mtimeMs,
  });
  assert.equal(result.skippedProjects, 0);
  assert.equal(result.skippedFiles, 0);
});

test('only immediate regular lowercase jsonl files in project directories create rows', t => {
  const home = temporaryHome(t);
  writeSession(home, '-project', 'main.jsonl');
  writeSession(home, '-project', 'notes.txt');
  writeSession(home, '-project', 'backup.jsonl.bak');
  writeSession(home, '-project', 'upper.JSONL');
  const nested = join(home, 'projects', '-project', 'main', 'subagents');
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(join(nested, 'agent.jsonl'), 'synthetic subagent');
  fs.mkdirSync(join(home, 'projects', '-project', 'directory.jsonl'));
  fs.writeFileSync(join(home, 'projects', 'loose.jsonl'), 'synthetic root file');
  const result = listSessions(join(home, 'projects'));
  assert.deepEqual(result.sessions.map(row => row.id), ['main']);
  assert.equal(result.state, 'complete');
  assert.equal(result.skippedProjects, 0);
  assert.equal(result.skippedFiles, 0);
});

test('a missing projects root is a complete empty result without a fallback source', t => {
  const home = temporaryHome(t);
  assert.deepEqual(listSessions(join(home, 'projects')), emptyResult());
  assert.equal(fs.existsSync(join(home, 'projects')), false);
});

test('an empty projects root is a complete empty result', t => {
  const home = temporaryHome(t);
  fs.mkdirSync(join(home, 'projects'));
  assert.deepEqual(listSessions(join(home, 'projects')), emptyResult());
});

test('projects without main sessions do not create phantom rows', t => {
  const home = temporaryHome(t);
  writeSession(home, '-empty', 'notes.txt');
  fs.mkdirSync(join(home, 'projects', '-also-empty'));
  assert.deepEqual(listSessions(join(home, 'projects')), emptyResult());
});

test('child links and special files are excluded without following or counting them as failures', t => {
  const projects = join(temporaryHome(t), 'projects');
  const project = join(projects, '-regular');
  const entry = (name, type) => ({
    name,
    isDirectory: () => type === 'directory',
    isFile: () => type === 'file',
    isSymbolicLink: () => type === 'link',
  });
  const directories = new Map([
    [projects, [
      entry('-regular', 'directory'), entry('-external-project', 'link'),
      entry('-cycle', 'link'), entry('-broken', 'link'), entry('loose.jsonl', 'file'),
    ]],
    [project, [
      entry('main.jsonl', 'file'), entry('external.jsonl', 'link'),
      entry('broken.jsonl', 'link'), entry('nested', 'link'),
      entry('subagents', 'directory'), entry('pipe.jsonl', 'special'),
    ]],
  ]);
  const reads = [];
  const stats = [];
  restoreFs(t);
  t.mock.method(fs, 'readdirSync', (path, options) => {
    reads.push(path);
    assert.equal(options?.withFileTypes, true);
    assert.ok(directories.has(path), 'Only regular directories may be enumerated');
    return directories.get(path);
  });
  t.mock.method(fs, 'lstatSync', path => {
    stats.push(path);
    assert.equal(path, join(project, 'main.jsonl'));
    return { isFile: () => true, size: 123, mtimeMs: 456 };
  });
  t.mock.method(fs, 'statSync', () => assert.fail('Links must never be followed with stat'));
  syncBuiltinESMExports();
  assert.deepEqual(listSessions(projects), {
    state: 'complete',
    sessions: [{ id: 'main', projectKey: '-regular', projectPath: '/regular', sizeBytes: 123, mtimeMs: 456 }],
    skippedProjects: 0,
    skippedFiles: 0,
  });
  assert.deepEqual(reads, [projects, project]);
  assert.deepEqual(stats, [join(project, 'main.jsonl')]);
});

test('an entry that becomes a link before lstat is excluded from the inventory', t => {
  const home = temporaryHome(t);
  const file = writeSession(home, '-project', 'changed.jsonl');
  const original = fs.lstatSync;
  restoreFs(t);
  t.mock.method(fs, 'lstatSync', (path, ...args) => path === file
    ? { isFile: () => false, isSymbolicLink: () => true }
    : original(path, ...args));
  syncBuiltinESMExports();
  assert.deepEqual(listSessions(join(home, 'projects')), emptyResult());
});

test('unreadable contents and transcript changes never affect metadata or cause content opens', t => {
  const home = temporaryHome(t);
  const file = writeSession(home, '-project', 'main.jsonl', 'synthetic A');
  const projects = join(home, 'projects');
  const before = listSessions(projects);
  const metadata = fs.lstatSync(file);
  fs.writeFileSync(file, 'synthetic B');
  fs.utimesSync(file, metadata.atime, metadata.mtime);
  restoreFs(t);
  const contentReads = [];
  for (const method of ['openSync', 'readFileSync', 'createReadStream']) {
    t.mock.method(fs, method, () => {
      contentReads.push(method);
      assert.fail('Session contents must not be opened, even if reading is denied');
    });
  }
  syncBuiltinESMExports();
  assert.deepEqual(listSessions(projects), before);
  assert.deepEqual(contentReads, []);
});
