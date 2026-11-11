import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeHome } from './lib/claude/index.js';
import { listSources } from './lib/sources.js';
import { layout, empty } from './views/layout.js';

const here = dirname(fileURLToPath(import.meta.url));
export const app = express();

app.use(express.static(join(here, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, sources: listSources(), claudeHome: claudeHome() });
});

function queryLimit(originalUrl) {
  const values = new URL(originalUrl, 'http://127.0.0.1').searchParams.getAll('limit');
  if (!values.length) return 50;
  if (values.length !== 1 || !values[0] || /[^0-9]/.test(values[0])) return null;
  const limit = Number(values[0]);
  return limit >= 1 && limit <= 1000 ? limit : null;
}

app.get('/', (req, res) => {
  const limit = queryLimit(req.originalUrl);
  if (limit === null) {
    return res.status(400).type('html').send(layout({
      title: 'agent-ops',
      body: `<h1>Сесії</h1>${empty('Ліміт має бути цілим числом від 1 до 1000')}`,
      source: 'Claude Code',
      home: claudeHome(),
    }));
  }
  res.type('html').send(layout({
    title: 'agent-ops',
    body: `<h1>agent-ops</h1>
<p class="sub">Reading ${claudeHome()}</p>
${empty('No slice is wired up yet.')}`,
  }));
});

const PORT = Number(process.env.PORT || 4180);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`agent-ops on http://127.0.0.1:${PORT}  (CLAUDE_HOME=${claudeHome()})`);
  });
}
