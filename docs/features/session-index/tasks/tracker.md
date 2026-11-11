# Tracker — session-index

Стани: `todo` · `in_progress` · `blocked` · `review` · `done`.
Кроки: `SELECT` · `RED` · `GREEN` · `REFACTOR` · `GATE` · `REVIEW` · `COMMIT`; до старту `—`.
`implement` оновлює Status/Step у файлах задач, цю таблицю та status у tasks.json.

**Навчальний маршрут:** maintainer погодив [DEC-training-route](../spec.md#decision-and-edits-log) 2026-11-11: окремі `ux-flows`, `sequences`, `api`, `screens` пропущено; контракт і стани залишаються в SAD та задачах. Один агент виконує задачі послідовно з паузою після T1. Цей запис не змінює статусів і не означає початку реалізації.

**OQ-01 — контроль до приймання:** за рішенням maintainer від 2026-11-11 вимірювання виконуються після T6 на реалізованому індексі; до приймання maintainer погоджує затримку й обсяг (spec §8, SAD §11). OQ-01 залишається відкритим, але старт задач не блокує. `todo` означає, що виконання не починалось.

| # | Task | Layer | Owner | Estimate | Blocked by | Status | Step |
|---|---|---|---|---|---|---|---|
| T1 | [Збирати метадані основних сесій налаштованого джерела](read-session-metadata.md) | infra | maintainer | 5h | — | done | COMMIT |
| T2 | [Зберігати доступні рядки та розрізняти файлові збої](preserve-partial-results.md) | infra | maintainer | 5h | T1 | done | COMMIT |
| T3 | [Відхиляти помилковий limit перед обробкою індексу](validate-query-limit.md) | ports | maintainer | 3h | — | done | COMMIT |
| T4 | [Показувати повні метадані та підсумки обмеженого переліку](render-session-table.md) | ui | maintainer | 4h | — | done | COMMIT |
| T5 | [Розрізняти порожній, неповний і помилкові стани сторінки](render-session-states.md) | ui | maintainer | 3h | T4 | done | COMMIT |
| T6 | [Підключити індекс на головній зі спільним сортуванням і лімітом](wire-session-index.md) | wiring | maintainer | 5h | T2, T3, T5 | done | COMMIT |
| T7 | [Підтвердити приватність, недоторканність джерела й безпеку HTML](verify-index-privacy.md) | tests | maintainer | 4h | T6 | done | COMMIT |
| T8 | [Забезпечити читання повних значень у двох темах і на двох ширинах](verify-responsive-shell.md) | ui | maintainer | 3h | T6 | done | COMMIT |

**Total:** 8 задач, 32 години, приблизно 4 людино-дні; вимірювання OQ-01 після T6, очікування рішення maintainer до приймання та зовнішнє приймання в оцінку не включено. Усі оцінки — план, не фактичний час.

| Task | Context budget | Non-empty lines (Why–Acceptance criteria) |
|---|---|---|
| T1 | M | 85 |
| T2 | M | 58 |
| T3 | M | 50 |
| T4 | M | 77 |
| T5 | M | 80 |
| T6 | M | 90 |
| T7 | M | 76 |
| T8 | M | 64 |

Експорт у зовнішній issue tracker не виконувався; тіла задач готові для копіювання.

## Execution — 2026-11-11

T1 завершено через RED → GREEN → REFACTOR → GATE. `npm run verify`: exit 0, 12/12 (9 нових перевірок читача та 3 регресії оболонки), 0 skipped. Окремий integration-runner не запускався (`require_integration: never`); lint/vet — N/A. Деталі й фактичні обмеження — у [записі T1](read-session-metadata.md#execution-record--2026-11-11).

Погоджена пауза після T1 за DEC-training-route; T2–T8 залишаються `todo`, не dropped і не blocked. Обробка збоїв читання залишається T2, реєстрація читача й HTTP-підключення — T6. Фіча загалом ще не готова до приймання.

**T2:** GOOD red: 11/11 нових тестів падали; для недоступного кореня actual complete, expected unavailable. GREEN: усі 11 проходять. Розрізнено відсутній корінь і недоступний перелік; помилки проєктів/файлів дають partial з окремими лічильниками й збереженням попередніх рядків. Завершального stat проєкту немає. `npm run verify`: exit 0, 23/23, 0 skipped.

**T3:** GOOD red: порожній limit повертав 200 замість 400. GREEN: точна граматика, дублікати, межі 1/1000, початкові нулі й некоректні значення перевірені HTTP-тестами; ранню відмову до обходу остаточно перевіряє T6. `npm run verify`: exit 0, 26/26, 0 skipped.

**T4:** GOOD red: 5/5 тестів падали через відсутню sessionsView (undefined замість function). GREEN: таблиця показує всі чотири поля, UTC, початкову теку й похідний шлях; escaping, підсумки, ліміт і незмінність порядку перевірені. Перевикористано наявні компоненти канону без NEW-примітивів. `npm run verify`: exit 0, 31/31, 0 skipped.

**T5:** GOOD red: 5/5 нових тестів падали; complete без рядків не мав повідомлення Сесій поки немає. GREEN: complete/partial/unavailable/invalid-limit розрізняються, partial зберігає рядки й окремі лічильники; невідома загальна кількість не підміняється нулем, сирі діагностики не показуються. `npm run verify`: exit 0, 36/36, 0 skipped.

**T6:** GOOD red: 9/10 нових HTTP-тестів падали, перший — 0 рядків замість 6. GREEN: реєстр підключає читач, маршрут глобально сортує перед slice, зберігає health і повертає 200/400/503; ліміти 1/50/1000 перевірено на 1005 сесіях. Перший GATE: 45/46 через колізії імен лише за регістром на macOS; фікстуру виправлено без зміни очікуваного правила, повторний GATE 46/46. `npm run verify`: exit 0, 46/46, 0 skipped.

**T7:** Перший прогін 6/6 security-тестів зелений: T1–T6 вже забезпечують поведінку. За явним винятком checklist T7 і карти виконання §2 production-код не змінено. Додано контроль спроб, snapshot, escaping, CSP, ізоляції та лінків; справжній DOM Chrome: усі текстові порівняння true, 0 контрольних елементів, handler undefined. Деталі й маніфест у security-check.md; після T8 буде повтор зачеплених сценаріїв. `npm run verify`: exit 0, 52/52, 0 skipped.

**T8:** GOOD red у браузері: на запитаних 320 px layout 471 px, шлях client 254 / scroll 1147, overflow hidden. HTML-перевірка повних значень одразу зелена, дефект у CSS. GREEN: локальне перенесення таблиці й home; фінальна матриця 320/1280 light/dark пройшла, обидві теми збережено після reload, limit і всі стани перевірено в Chrome, безпеку T7 повторено. Деталі й SHA-256 у ui-check.md. `npm run verify`: exit 0, 53/53, 0 skipped.
