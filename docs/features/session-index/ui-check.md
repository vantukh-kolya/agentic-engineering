---
status: verified
updated_at: "2026-11-11"
---

# UI check — session-index

Фактична самоперевірка T8, size `S`, route `standard`. Незалежне рев'ю та приймання maintainer не виконані.

## Candidate and setup

- Кандидат: `1942865` + поточна зміна `public/style.css`; новий тест `test/session-readable.test.js`. Runtime-копія містить саме ці байти, а не лише HEAD. Інші runtime-файли тотожні T7.
- URL: `http://127.0.0.1:4180/` і `/?limit=1`, `/?limit=61`, `/?limit=0`, `/api/health`.
- Запуск: лише `npm run demo` у власній тимчасовій копії; встановлені node_modules використано посиланням. Нових залежностей і змін базових fixtures немає.
- Браузер: Google Chrome 157, DevTools Responsive (наявна конфігурація емуляції повідомляє Android 16 / Pixel 10); host для прямого керування вкладками недоступний, тому використано native CUA. Це браузерна емуляція CSS viewport, не фізичний телефон. Повний текст перевірено через accessibility tree, скриншоти й DOM Console.
- Копія: `/var/folders/t3/7fyxmf0528gcyv1klw_qs_km0000gn/T/agent-ops-browser-o8SLZf/candidate"><img data-agent-probe src=x onerror=window.__agentProbe=1>&`.
- Джерело: `/var/folders/t3/7fyxmf0528gcyv1klw_qs_km0000gn/T/agent-ops-browser-o8SLZf/candidate"><img data-agent-probe src=x onerror=window.__agentProbe=1>&/fixtures/claude-home`.
- Основне дерево: 61 сесія у 2 проєктах, одна з довгими ID/ключем/похідним шляхом та спеціальними символами; звичайні рядки session-000…session-059. Спеціальний рядок має 58 байтів і UTC `2026-11-02T00:00:00.000Z`.
- Порожній сценарій: окремий demo-процес із порожньою projects. Початкове синтетичне дерево збережено лише в тимчасовій теці й після сценарію повернуто.
- Partial/unavailable: окремі demo-процеси з тимчасовим preload через `NODE_OPTIONS=--import=file:///private/tmp/session-index-browser-preload.mjs`. Обгортка readdirSync відмовляє лише на точних шляхах копії; активна лише для scripts/demo.mjs, не для npm/predemo чи контрольного читання. Production-код не змінювався, готовий результат читача не підставлявся.

## RED and change

HTML-тест повних довгих значень одразу зелений: дані вже не губилися в HTML. Реальний RED був у браузері: після вибору 320 px layout мав innerWidth/pageWidth 471 px; project-path — clientWidth 254, scrollWidth 1147, overflow hidden, text-overflow ellipsis, white-space nowrap. Довгий шлях читався лише через title, що порушує QG-4.

Виправлено лише відображення: для індексу — фіксований layout таблиці, перенесення даних і повних проєктних значень, перенос групи limit; у футері — перенесення довгого home. Перевикористано наявні класи й токени; NEW-примітивів немає, палітри/тема/CSP не змінені. CSS-тести, які повторювали б реалізацію, не додавалися.

## Width and theme matrix — US-01, US-02, US-06

| CSS viewport | Theme | DOM innerWidth / page width | project-path client/scroll | Чотири поля |
|---|---|---|---|---|
| 320 | dark, спершу system, потім explicit | 320 / 320 | 254 / 254 | Усі 4 без горизонтального переповнення; повні ID, ключ, похідний шлях, байти й UTC доступні переносом та вертикальним прокручуванням |
| 320 | light | 320 / 320 | 254 / 254 | Усі 4 клітинки scrollWidth ≤ clientWidth; оглянуто нижню частину рядка, «похідний», 58 байтів, повний UTC і home |
| 1280 | light | 1280 / 1280 | 236 / 236 | Усі 4 клітинки scrollWidth ≤ clientWidth; текст переноситься в колонках, title не є єдиним способом читання |
| 1280 | dark | 1280 / 1280 | 236 / 236 | Ті самі повні поля й геометрія; джерело й поточна навігація видимі |

Наявний перемикач натиснуто у браузері: system-dark → light → reload (dataset і localStorage light), далі dark → reload (dataset і localStorage dark). Збереження теми підтверджено після обох перезавантажень. Заголовок/бренд agent-ops, Dashboard і бейдж Claude Code лишилися.

## Interaction and states — US-03, US-04

| Сценарій / дія | Спостереження браузера |
|---|---|
| `/`, основне дерево | «Показано 50 із 61 сесій», пояснення ліміту 50, найсвіжіший спеціальний рядок перший |
| `/?limit=1` | Один найсвіжіший рядок; підсумок 1 із 61 і пояснення ліміту 1 |
| Натискання «Усі 61» | URL став `?limit=61`; DOM містить 61 рядок, спеціальний рядок перший, session-059 останній; «Показано 61 із 61 сесій», пояснення обрізання зникло |
| `/?limit=0` | У Chrome зафіксовано HTTP 400, точне «Ліміт має бути цілим числом від 1 до 1000», таблиці немає |
| Partial із рядком | HTTP 200; «Показано 1 із 1 доступних сесій», загальна кількість невідома; пропущено проєктів 1, файлів 0; спеціальний рядок залишився |
| Partial без рядків (відмовляють обидва проєкти) | «Показано 0 із 0 доступних сесій», загальна невідома; пропущено проєктів 2, файлів 0; «Доступних сесій не знайдено; перелік неповний», без таблиці та успішної порожнечі |
| Unavailable (відмовляє перелік projects) | У Chrome зафіксовано HTTP 503, «Не вдалося прочитати джерело сесій», без таблиці й успішних нульових підсумків |
| Повний порожній результат | «Показано 0 із 0 сесій», «Сесій поки немає», без таблиці та попередження про неповноту |
| `/api/health` | JSON ok=true, sources=[{id:claude,label:Claude Code}], claudeHome дорівнює джерелу копії; нових полів немає |

За потреби повний текст рядка читався вертикальним прокручуванням. Одне scroll-звернення CUA завершилося noWindowsAvailable; після повторного отримання й Raise вікна Chrome керування відновлено, фінальні перевірки виконано. Це збій harness, не результат перевірки фічі.

## Privacy and final repeat — US-05

[Звіт T7](security-check.md) містить початковий доказ. Після CSS-зміни повторено контроль на фінальній копії в обох темах/ширинах: ID і projectKey textContent точно збігаються з title, projectPath містить повний підпис, home містить буквальний маркер. `document.querySelectorAll('[data-agent-probe]').length === 0`, `typeof window.__agentProbe === 'undefined'`. Дані не створили контрольного елемента й не запустили обробник. Точні CSP-директиви та локальну прив'язку додатково підтверджує автоматичний gate.

## Runtime manifest

SHA-256 фінальних runtime-файлів копії (звірено з робочим деревом):

| File | SHA-256 |
|---|---|
| `server.js` | `40c0b7357b3d4c3b23674cf80dfa176949309d16da123e0373de6ae7cdb34d8a` |
| `lib/claude/index.js` | `0b25c79e6fcabdfd7816c23f6c2294e50d9619c343206bea194b474d9035bbe7` |
| `lib/claude/sessions.js` | `a0ea929df3f5105f3e888096617b5c6ccfa521957e44043bec55e270cce947ae` |
| `views/sessions.js` | `20a7ba17f40fb49f762c01fedf3ffee178ecc59d97205898720fd341b76ce2db` |
| `views/layout.js` | `0e87559ddc87f04cc1d9999a8b6fd51352521a058372173134bec85fbcbfa063` |
| `public/style.css` | `ca3eab93f77c70850829f4864970bd39a071b7e0642b3c339da1374db04cd312` |
| `public/theme.js` | `e965b397e647675754659c8868d1ccff6e0c34c0a28a857b9af25691cc7237dc` |

## Gate and limits

- `node --test --test-reporter=spec test/session-readable.test.js` після pin-fixture-mtimes — exit 0, 1/1. Це перевірка повного HTML, не заміна браузера.
- Фінальний `npm run verify` з preverify — exit 0, **53/53**, 0 skipped; Node v26.13.0, macOS. Окрема integration-команда не запускалась (require_integration never); lint/vet — N/A.
- Початковий localStorage для теми був null; відновлено null і системну тему. Ширину емулятора відновлено до попередніх 563 px, device toolbar і DevTools закрито; закрито тільки власну тестову вкладку. Власний demo зупинено, тимчасова копія прибрана після звірки маніфесту.
- Фізичний телефон, інші браузери й ОС не перевірялися. Автоматичні тести призначені для CI 22/24/26 на Linux/macOS/Windows, локально пройдено лише Node 26/macOS.
- Рішення про приймання залишається maintainer; OQ-01 про поріг швидкодії окремо, вимірювання не є числовою гарантією.
