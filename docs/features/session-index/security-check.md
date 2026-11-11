---
status: verified
updated_at: "2026-11-11"
---

# Security check — session-index

Це самоперевірка реалізації T7, не незалежне security review й не приймання maintainer. Size `S`, route `standard`.

## Candidate and harness

Кандидат: `9a4d5a6`, runtime без незакомічених змін; нові незакомічені файли — тести T7. Той самий агент скопіював поточні server/lib/views/public/package/scripts до власної тимчасової теки, підключив встановлені node_modules посиланням і створив 61 синтетичну сесію. Базові fixtures не змінено. Жодних нових залежностей.

- Тимчасова копія: `/var/folders/t3/7fyxmf0528gcyv1klw_qs_km0000gn/T/agent-ops-browser-o8SLZf/candidate"><img data-agent-probe src=x onerror=window.__agentProbe=1>&`.
- Джерело: `/var/folders/t3/7fyxmf0528gcyv1klw_qs_km0000gn/T/agent-ops-browser-o8SLZf/candidate"><img data-agent-probe src=x onerror=window.__agentProbe=1>&/fixtures/claude-home`.
- Команда: `npm run demo` з cwd копії (через тимчасовий Node launcher, без зміни runtime). Predemo вирівняв 61 файл; сервер слухав тільки `127.0.0.1:4180`.
- URL: `http://127.0.0.1:4180/?limit=1`.
- Середовище: macOS, Node `v26.13.0`, Google Chrome. Браузерний host недоступний; Chrome керовано через native CUA, DOM перевірено в його DevTools Console.

## Automated evidence

`npm run verify`: exit 0, **52/52**, 0 skipped, із preverify. Перший прогін 6/6 нових security-тестів зелений: потрібна поведінка вже реалізована T1–T6; production-код штучно не ламали. Це дозволено checklist T7 і картою виконання §2. Контрольний тест підтверджує, що спроби читання й запису фіксуються навіть при відмові без зміни диска.

| Перевірка | Фактичний результат |
|---|---|
| Runtime-відкриття вмісту джерела | 0 спроб; контролюються open/readFile/streams, включно зі спробами, які перехопив би caller |
| Runtime-запис | 0 спроб; контролюються створення, запис, видалення, переміщення, зміна прав і mtime |
| Snapshot до/після запиту | Склад, типи, байти та mtime збігаються; atime не є гарантією |
| Зміна синтетичного вмісту | За того самого розміру й зафіксованого mtime HTML незмінний |
| Ізоляція | 0 metadata-звернень до projects/JSONL поза налаштованим синтетичним джерелом; T6 додатково перевіряє порожнечу/недоступність без fallback |
| Вкладені файли й посилання | Не створюють рядків, не обходяться, не збільшують лічильники помилок; керовані типи працюють без symlink-прав Windows |
| Логи й винятки | Нових log/warn/error під час запиту немає; синтетичний вміст не присутній у HTML |
| Escaping | ID, projectKey, projectPath та home екрануються в тексті й атрибутах |
| CSP | Точний незмінний набір: `default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:` |
| Слухач / health | Збережено 127.0.0.1; health має лише ok/sources/claudeHome |

Окремого integration-runner немає (`require_integration: never`); файлові й HTTP-тести входять у verify. Lint/vet — N/A.

## Browser evidence — AC-14

У контрольних іменах основного файла, теки проєкту та шляху копії використано синтетичний маркер `"><img data-agent-probe src=x onerror=window.__agentProbe=1>&`. Похідний шлях утворився звичайним перетворенням дефісів на розділювачі. На сторінці видно чотири поля, початковий ключ, похідний шлях із позначкою «похідний» та home у футері.

У справжньому DOM Chrome перевірено:

```json
{"idText":true,"keyText":true,"pathText":true,"homeText":true,"elements":0,"handler":"undefined"}
```

`idText` і `keyText` — textContent точно збігається з title відповідного поля; `pathText` — видимий текст містить повний початковий title; `homeText` — футер містить буквальний маркер. `elements` — `document.querySelectorAll('[data-agent-probe]').length`; `handler` — `typeof window.__agentProbe`. Отже, дані не створили контрольного елемента й не запустили обробник. Це перевірка DOM, не висновок із самої CSP або HTTP-рядка.

## Manifest

SHA-256 поточних runtime-файлів копії:

| File | SHA-256 |
|---|---|
| `server.js` | `40c0b7357b3d4c3b23674cf80dfa176949309d16da123e0373de6ae7cdb34d8a` |
| `lib/claude/index.js` | `0b25c79e6fcabdfd7816c23f6c2294e50d9619c343206bea194b474d9035bbe7` |
| `lib/claude/sessions.js` | `a0ea929df3f5105f3e888096617b5c6ccfa521957e44043bec55e270cce947ae` |
| `views/sessions.js` | `20a7ba17f40fb49f762c01fedf3ffee178ecc59d97205898720fd341b76ce2db` |
| `views/layout.js` | `0e87559ddc87f04cc1d9999a8b6fd51352521a058372173134bec85fbcbfa063` |
| `public/style.css` | `ce17c1722e199b3fa1f63bfcb7c4c85983528462c30479d91e55194ac4df5284` |
| `public/theme.js` | `e965b397e647675754659c8868d1ccff6e0c34c0a28a857b9af25691cc7237dc` |

## Limits and follow-up

- Незалежне рев'ю й приймання maintainer ще попереду; самоперевірка їх не замінює.
- Перевірка на Windows/Linux локально не виконувалась; тести не залежать від chmod, shell-утиліт чи права створювати symlink.
- Після змін T8 потрібно повторити зачеплені браузерні перевірки на фінальному кандидатові й записати результат тут.
- Браузерний сценарій T7 завершено; власний demo і вкладка використовуються далі лише для T8, після якої прибираються.
