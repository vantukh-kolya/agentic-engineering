import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listSessions } from '../lib/claude/sessions.js';

function tree(t) {
  const home = fs.mkdtempSync(join(tmpdir(), 'agent-ops-errors-'));
  const root = join(home, 'projects');
  for (const project of ['-a', '-b']) {
    fs.mkdirSync(join(root, project), { recursive: true });
    for (const file of ['first.jsonl', 'second.jsonl']) {
      fs.writeFileSync(join(root, project, file), 'synthetic');
    }
  }
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  return root;
}

function failOperation(t, method, shouldFail) {
  const original = fs[method];
  t.mock.method(fs, method, (path, ...args) => {
    if (shouldFail(path)) throw new Error('Synthetic filesystem refusal');
    return original(path, ...args);
  });
  syncBuiltinESMExports();
}

test('an existing root whose enumeration fails is unavailable rather than empty', t => {
  const root = tree(t);
  failOperation(t, 'readdirSync', path => path === root);
  assert.deepEqual(listSessions(root), {
    state: 'unavailable', sessions: [], skippedProjects: 0, skippedFiles: 0,
  });
});

test('an error inspecting the failed root never becomes a successful empty inventory', t => {
  const root = tree(t);
  failOperation(t, 'readdirSync', path => path === root);
  failOperation(t, 'lstatSync', path => path === root);
  assert.equal(listSessions(root).state, 'unavailable');
});

test('a projects root that is a regular file is unavailable', t => {
  const root = tree(t);
  const file = join(root, '-a', 'first.jsonl');
  assert.equal(listSessions(file).state, 'unavailable');
});

test('one unreadable project leaves the other project available and counts the project once', t => {
  const root = tree(t);
  failOperation(t, 'readdirSync', path => path === join(root, '-a'));
  const result = listSessions(root);
  assert.equal(result.state, 'partial');
  assert.equal(result.skippedProjects, 1);
  assert.equal(result.skippedFiles, 0);
  assert.deepEqual(result.sessions.map(row => row.projectKey), ['-b', '-b']);
});

test('all unreadable projects produce a partial result with zero available sessions', t => {
  const root = tree(t);
  failOperation(t, 'readdirSync', path => path !== root);
  assert.deepEqual(listSessions(root), {
    state: 'partial', sessions: [], skippedProjects: 2, skippedFiles: 0,
  });
});

test('a project disappearing after root enumeration is counted once without a file skip', t => {
  const root = tree(t);
  const original = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (path, ...args) => {
    const entries = original(path, ...args);
    if (path === root) fs.rmSync(join(root, '-a'), { recursive: true });
    return entries;
  });
  syncBuiltinESMExports();
  const result = listSessions(root);
  assert.equal(result.state, 'partial');
  assert.equal(result.sessions.length, 2);
  assert.equal(result.skippedProjects, 1);
  assert.equal(result.skippedFiles, 0);
});

test('a failed main-file lstat preserves other rows and counts only the file', t => {
  const root = tree(t);
  failOperation(t, 'lstatSync', path => path === join(root, '-a', 'second.jsonl'));
  const result = listSessions(root);
  assert.equal(result.state, 'partial');
  assert.equal(result.sessions.length, 3);
  assert.equal(result.skippedProjects, 0);
  assert.equal(result.skippedFiles, 1);
  assert.ok(result.sessions.some(row => row.projectKey === '-a' && row.id === 'first'));
});

test('a file disappearing after enumeration has the same partial-file semantics', t => {
  const root = tree(t);
  const original = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (path, ...args) => {
    const entries = original(path, ...args);
    if (path === join(root, '-a')) fs.unlinkSync(join(path, 'second.jsonl'));
    return entries;
  });
  syncBuiltinESMExports();
  const result = listSessions(root);
  assert.equal(result.state, 'partial');
  assert.equal(result.sessions.length, 3);
  assert.equal(result.skippedProjects, 0);
  assert.equal(result.skippedFiles, 1);
});

test('a project lost after a successful row retains that row and is not counted as a file', t => {
  const root = tree(t);
  const original = fs.lstatSync;
  t.mock.method(fs, 'lstatSync', (path, ...args) => {
    const metadata = original(path, ...args);
    if (path === join(root, '-a', 'first.jsonl')) fs.rmSync(join(root, '-a'), { recursive: true });
    return metadata;
  });
  syncBuiltinESMExports();
  const result = listSessions(root);
  assert.equal(result.state, 'partial');
  assert.equal(result.sessions.length, 3);
  assert.ok(result.sessions.some(row => row.projectKey === '-a' && row.id === 'first'));
  assert.equal(result.skippedProjects, 1);
  assert.equal(result.skippedFiles, 0);
});

test('an inaccessible project detected after a row retains it and counts the project once', t => {
  const root = tree(t);
  failOperation(t, 'lstatSync', path => path === join(root, '-a') || path === join(root, '-a', 'second.jsonl'));
  const result = listSessions(root);
  assert.equal(result.state, 'partial');
  assert.equal(result.sessions.length, 3);
  assert.equal(result.skippedProjects, 1);
  assert.equal(result.skippedFiles, 0);
});

test('project and file failures have separate counters and never expose raw errors', t => {
  const root = tree(t);
  failOperation(t, 'readdirSync', path => path === join(root, '-b'));
  failOperation(t, 'lstatSync', path => path === join(root, '-a', 'second.jsonl'));
  const result = listSessions(root);
  assert.equal(result.state, 'partial');
  assert.equal(result.sessions.length, 1);
  assert.equal(result.skippedProjects, 1);
  assert.equal(result.skippedFiles, 1);
  assert.doesNotMatch(JSON.stringify(result), /Synthetic|Error|stack/);
});
