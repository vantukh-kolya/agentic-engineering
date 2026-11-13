---
slug: session-index
date: "2026-11-13"
triage: regression
acs: [AC-05]
commit: null
recurrence_of: none
---

# Виправлення F2: відхиляти масивоподібний limit

## Межі та початковий стан

Погоджено лише F2 зі [звіту review](../_review/review-2026-11-13.md). Інші знахідки та spec не змінено; коміт залишено користувачу.

- `FEATURE_BASE_COMMIT`: `8e71dde10b0d98ffc4423ad6602b75c3726c0fd9`.
- `CANDIDATE_COMMIT` і початковий HEAD: `427ba275026692d59111e5c71b71288e5cbae670`.
- Початковий `git status --short`: лише `?? docs/features/session-index/_review/`. Наявний звіт збережено без редагування.
- Прочитано AGENTS.md, правила JavaScript і тестів, AC-05 та inline Test plan, SAD і T3 (`tasks/validate-query-limit.md`). Це порушення чинної вимоги, а не зміна контракту.

## Симптом і причина

`GET /?limit[]=1` та `GET /?limit%5Bx%5D=1` повертали HTTP 200 із типовим лімітом 50 та таблицею замість HTTP 400 без таблиці й без виклику читача сесій.

У `server.js` функція `queryLimit()` читала лише точний ключ через `searchParams.getAll('limit')`. Декодовані ключі `limit[]` і `limit[x]` не потрапляли до результату, тому спрацьовувала гілка відсутнього параметра. Наявний тест вилучав ці випадки з invalid-набору та окремо очікував для них HTTP 200.

## RED — до зміни runtime

У `test/session-limit.test.js` прибрано фільтр bracket-форм і хибне очікування 200. Кожний invalid-випадок виконується підтестом, щоб падіння першого не приховувало другий. У `test/session-index.test.js` обидві форми додано до наявної перевірки відсутності виклику reader.

1. `node scripts/pin-fixture-mtimes.mjs && node --test --test-reporter=spec test/session-limit.test.js test/session-index.test.js` у sandbox: exit 1, 2 файлові тести впали до assertions через `TypeError: Cannot read properties of null (reading 'port')` у `test/helpers.js:16`. Вирівнювання mtime виконалося для 6 фікстур. Цей збій середовища не є доказом дефекту.
2. Повтор `node --test --test-reporter=spec test/session-limit.test.js test/session-index.test.js` поза sandbox: exit 1, tests 36, pass 32, fail 4, skipped 0; duration 534.370209 ms. **GOOD RED**: обидва bracket-підтести впали на очікуваному HTTP-контракті:

```text
test/session-limit.test.js:26:14
assert.equal(response.status, 400, query);

AssertionError [ERR_ASSERTION]: limit[]=1
200 !== 400

AssertionError [ERR_ASSERTION]: limit%5Bx%5D=1
200 !== 400
```

Додатково тест `invalid limits reject requests before invoking the registered reader` виявив виклик reader: його захисний `assert.fail('Reader invoked for invalid limit')` (`test/session-index.test.js:177`) спричинив HTTP 500; assertion у рядку 179 отримав `500 !== 400`. Чотири fail у підсумку включають два bracket-підтести, їхній батьківський тест та перевірку reader; це не чотири окремі дефекти.

## Мінімальна правка та GREEN

`queryLimit()` перевіряє декодовані імена query-параметрів і повертає `null` для ключів із префіксом `limit[` перед типовим значенням 50. Наявна гілка маршруту відповідає 400 до `source.listSessions()`. Граматика скалярного limit збережена.

Після `node scripts/pin-fixture-mtimes.mjs` (exit 0, 6 фікстур) повторено ту саму цільову команду поза sandbox: **exit 0, tests 36, pass 36, fail 0, skipped 0**, duration 508.50025 ms.

Перевірено:

- Обидва bracket-запити: 400, HTML із точним поясненням, без таблиці; сумарно нуль викликів reader у тесті ранньої відмови.
- Відсутній limit: перші 50 із синтетичних 1005 сесій; валідні 1, 1000 і початкові нулі зберігають поведінку.
- Сторонні параметри ігноруються, включно з `other[]=1` і `other%5Bx%5D=1&limit=2`.

## Повні ворота

`npm run verify` поза sandbox на macOS, Node `v26.13.0`: **exit 0, tests 76, pass 76, fail 0, cancelled 0, skipped 0, todo 0**, duration 593.596417 ms. `preverify` вирівняв mtime 6 фікстур. Кількість включає 53 батьківські/самостійні тести та 23 підтести валідації.

Тести використовували лише синтетичні `fixtures/claude-home/` та тимчасові дерева; `test/helpers.js` задає `CLAUDE_HOME`. `npm start` і особисту домашню теку агента не використовували. Окремих lint/vet-команд у репозиторії немає; їх не запускали. Demo та браузерну перевірку не запускали.

## Spec та інші знахідки

Spec не потребує правки: AC-05, inline Test plan (масивоподібний параметр → відмова без обходу), SAD §6/§8 і T3 вже задають потрібну поведінку. Інші знахідки зі звіту не виправлялися. Наявний review не оновлювався; цей запис фіксує лише виконане виправлення F2.
