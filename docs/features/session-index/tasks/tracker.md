# Tracker — session-index

Стани: `todo` · `in_progress` · `blocked` · `review` · `done`.
Кроки: `SELECT` · `RED` · `GREEN` · `REFACTOR` · `GATE` · `REVIEW` · `COMMIT`; до старту `—`.
`implement` оновлює Status/Step у файлах задач, цю таблицю та status у tasks.json.

**Передумова всіх задач:** відкрите OQ-01 (spec §8, SAD §11; строк до tasks). `todo` означає, що виконання не починалось, а не дозвіл обійти цю передумову.

| # | Task | Layer | Owner | Estimate | Blocked by | Status | Step |
|---|---|---|---|---|---|---|---|
| T1 | [Збирати метадані основних сесій налаштованого джерела](read-session-metadata.md) | infra | maintainer | 5h | — | todo | — |
| T2 | [Зберігати доступні рядки та розрізняти файлові збої](preserve-partial-results.md) | infra | maintainer | 5h | T1 | todo | — |
| T3 | [Відхиляти помилковий limit перед обробкою індексу](validate-query-limit.md) | ports | maintainer | 3h | — | todo | — |
| T4 | [Показувати повні метадані та підсумки обмеженого переліку](render-session-table.md) | ui | maintainer | 4h | — | todo | — |
| T5 | [Розрізняти порожній, неповний і помилкові стани сторінки](render-session-states.md) | ui | maintainer | 3h | T4 | todo | — |
| T6 | [Підключити індекс на головній зі спільним сортуванням і лімітом](wire-session-index.md) | wiring | maintainer | 5h | T2, T3, T5 | todo | — |
| T7 | [Підтвердити приватність, недоторканність джерела й безпеку HTML](verify-index-privacy.md) | tests | maintainer | 4h | T6 | todo | — |
| T8 | [Забезпечити читання повних значень у двох темах і на двох ширинах](verify-responsive-shell.md) | ui | maintainer | 3h | T6 | todo | — |

**Total:** 8 задач, 32 години, приблизно 4 людино-дні без очікування рішення OQ-01 та зовнішнього приймання. Усі оцінки — план, не фактичний час.

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
