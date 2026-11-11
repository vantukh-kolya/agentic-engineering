import { esc } from './layout.js';

function limitControls({ limit, availableCount }) {
  const choices = new Set([1, 50, 100, 1000, limit]);
  if (availableCount > 0 && availableCount <= 1000) choices.add(availableCount);
  const links = [...choices].sort((a, b) => a - b).map(value => {
    const current = value === limit ? ' aria-current="true"' : '';
    const label = value === availableCount ? `Усі ${value}` : value;
    return `<a href="/?limit=${esc(value)}"${current}>${esc(label)}</a>`;
  }).join('');
  return `<div class="toolbar"><span class="label">Кількість рядків</span><div class="segmented" role="group" aria-label="Кількість рядків">${links}</div></div>`;
}

function sessionRow({ id, projectKey, projectPath, sizeBytes, mtimeMs }) {
  const modified = new Date(mtimeMs).toISOString();
  return `<tr>
<td data-label="ID сесії"><code class="id" title="${esc(id)}">${esc(id)}</code></td>
<td data-label="Проєкт"><div class="project"><span class="project-name" title="${esc(projectKey)}">${esc(projectKey)}</span></div><div class="project-path" title="${esc(projectPath)}">${esc(projectPath)} <span>(похідний)</span></div></td>
<td class="num" data-label="Розмір, байти">${esc(sizeBytes)}</td>
<td data-label="Змінено (UTC)"><time datetime="${esc(modified)}">${esc(modified)}</time></td>
</tr>`;
}

// The route has already selected the rows and computed the presentation totals.
export function sessionsView(model) {
  const { sessions, visibleCount, availableCount, limit } = model;
  const truncated = visibleCount < availableCount
    ? `<p class="sub">Ліміт: ${esc(limit)}. Показано лише найсвіжіші сесії; змініть кількість рядків, щоб побачити більше.</p>` : '';
  return `<section class="session-index">
<h1>Сесії</h1>
<p class="sub">Показано ${esc(visibleCount)} із ${esc(availableCount)} сесій.</p>
${truncated}
${limitControls(model)}
<div class="table-wrap"><table>
<thead><tr><th scope="col">ID сесії</th><th scope="col">Проєкт</th><th scope="col" class="num">Розмір, байти</th><th scope="col">Змінено (UTC)</th></tr></thead>
<tbody>${sessions.map(sessionRow).join('')}</tbody>
</table></div>
</section>`;
}
