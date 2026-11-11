import { startServer } from './helpers.js';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';

const server = await startServer();
after(() => server.close());

test('missing and valid decimal limits are accepted, including leading zeros', async () => {
  for (const query of ['', '?limit=1', '?limit=50', '?limit=1000', '?limit=0001', '?limit=001000']) {
    assert.equal((await server.get(`/${query}`)).status, 200, query);
  }
});

test('invalid limits return a helpful 400 page without a session list', async () => {
  const queries = [
    'limit', 'limit=', 'limit=abc', 'limit=0', 'limit=1001', 'limit=-1',
    'limit=%2B1', 'limit=+1', 'limit=%201', 'limit=1%20', 'limit=1.0',
    'limit=1.5', 'limit=1e2', 'limit=0x10', 'limit=NaN', 'limit=Infinity',
    'limit=１', 'limit=1%0A', 'limit=1&limit=1', 'limit=&limit=1',
    'limit=1&limit=', 'limit[]=1', 'limit%5Bx%5D=1',
  ];
  // Bracketed names are unrelated parameters; only exact "limit" is interpreted.
  for (const query of queries.filter(query => !query.includes('[') && !query.includes('%5B'))) {
    const response = await server.get(`/?${query}`);
    const html = await response.text();
    assert.equal(response.status, 400, query);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(html, /Ліміт має бути цілим числом від 1 до 1000/);
    assert.match(html, /Content-Security-Policy/);
    assert.match(html, /data-theme-toggle/);
    assert.doesNotMatch(html, /<table/);
  }
});

test('unrelated query parameters do not impersonate or duplicate limit', async () => {
  for (const query of ['limit[]=1', 'limit%5Bx%5D=1', 'other=1&limit=2', 'other=1&other=2']) {
    assert.equal((await server.get(`/?${query}`)).status, 200, query);
  }
});
