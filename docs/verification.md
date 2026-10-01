# Проверка реализации — 2026-10-01

## Функциональная проверка

- Production build: успешно.
- 27 автоматических тестов: model, local/HTTP repository, layout, SQLite reference schema (включая семь тестов удаления/восстановления задач).
- Браузер: библиотека → редактор → смена проекта → показ → создание задачи → редактирование статуса/дедлайна → общая доска.
- Проверены Markdown, явное сохранение перед показом, восстановление данных после перезагрузки.
- Удаление: проверены отмена, подтверждение из карточки в режиме показа, переход в «Удалённые», восстановление с прежним номером/статусом/сроком и Escape из подтверждения поверх формы задачи. Тестовая EVENT-13 после проверки восстановлена.
- Проверены desktop 1440×1000 и узкий viewport 390×844 (горизонтального переполнения документа нет). Desktop-first: на узком экране превью мало, свойства доступны ниже.
- В локальном браузере оставлены демонстрационная презентация «План встречи ACM» и задача «Проверить план встречи — демо», созданные при проверке.
- Реальная интеграция Worker/D1/Telegram не тестировалась: backend пока отсутствует.
- HTTP-сбои и конкуренция проверены unit-тестами с mocks. Хук React с журналом sessionStorage не имеет отдельного автоматического browser fault-injection теста.

## BeUniq — code-only

Автоматический статус: FAIL при пороге 20.
AI-slop 30; copy-slop 46; taste 11; design-quality 100 (повторный запуск после добавления удаления задач).
Это сырые оценки сканера, не скорректированный «PASS». 274 находки, 482 правила пропущено как недоказуемые статически.

Дизайн следует существующему Selected Style Profile. Добавлено тихое feedback на нажатие в редакторе; сохранены бело-синие поверхности, системный шрифт, отсутствие анимаций, utility rail и внешней рамки.

Оставшиеся находки отнесены к human-judgment. Значительная часть — ложные срабатывания: SQL test slide.run как pricing, CSS transform как рекламный слоган, CSS width:100% как marketing metric, Blob для JSON-экспорта как декоративный blob. Динамические inline styles необходимы для масштабирования и плотности. Фиксированные размеры внутри 1280×720 — координаты презентационного шаблона, который масштабируется целиком. Старые CSS-селекторы прежнего редактора пока сохранены; их наличие не доказывает использование в новом UI. Глобальный рефакторинг старой CSS только ради оценки не выполнялся.

### Репрезентативные находки по каждому rule ID

| Rule | Severity | Файл:строка | Evidence | Рекомендация сканера |
| --- | --- | --- | --- | --- |
| LP-PRC-005 | high | tests/schema.test.js:17 | slide.run("s1", 0, "title", null); | Address Undefined credits with product-specific, non-template design/copy. |
| CSS-001 | medium | src/components.jsx:595 | <span style={{ "--progress-width": `${progress}%` }} /> | Address Arbitrary-value overload with product-specific, non-template design/copy. |
| FX-004 | medium | src/presentations/presentations.css:2 | box-shadow: inset 0 0 0 1px #7e9fbf | Address Colored glow shadow with product-specific, non-template design/copy. |
| CLR-004 | medium | src/presentations/Presentations.jsx:10 | const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })); | Address Multiple blurred blobs with product-specific, non-template design/copy. |
| LAY-020 | medium | src/styles.css:15 | 3+ viewport-height section declarations. Found 6. | Reduce repeated Excessive viewport-height sections pattern. |
| TYP-005 | medium | src/styles.css:1225 | font-weight: 800; | Address Excessively bold headline with product-specific, non-template design/copy. |
| CSS-002 | medium | src/styles.css:1851 | border: 1px solid rgba(220, 233, 250, 0.28); | Address Utility-class wall with product-specific, non-template design/copy. |
| LP-PRF-004 | medium | src/presentations/presentations.css:5 | .deck-heading input { width: 100%; padding: 3px 0; border: 0; color: #21344b; background: transparent; | Address Round-number metric with product-specific, non-template design/copy. |
| LP-HERO-004 | medium | src/presentations/presentations.css:26 | set: 0 auto auto 0; width: 1280px; height: 720px; padding: 34px 44px; transform-origin: top left; color: #1c385a; background: #fff; font-family: "Seg | Address Reimagine headline with product-specific, non-template design/copy. |
| LP-LEX-001 | medium | src/presentations/presentations.css:26 | set: 0 auto auto 0; width: 1280px; height: 720px; padding: 34px 44px; transform-origin: top left; color: #1c385a; background: #fff; font-family: "Seg | Address Promotional cliche density with product-specific, non-template design/copy. |
| AST-005 | low | src/components.jsx:53 | backlog: { label: "Бэклог", tone: "slate", icon: Circle }, | Address Excessive Lucide-style icons with product-specific, non-template design/copy. |
| AST-020 | low | src/components.jsx:1225 | placeholder="Например, согласовать программу" | Address Asset filename fingerprints with product-specific, non-template design/copy. |
| placeholder-dead-links | low | src/components.jsx:1225 | placeholder="Например, согласовать программу" | Replace placeholders with real routes/actions or remove them. |
| TYP-001 | low | src/presentations/presentations.css:34 | .deck-kind-title h2 { color: #1a63a8; font-size: 70px; } | Address Oversized generic H1 with product-specific, non-template design/copy. |
| UI-002 | low | src/presentations/Presentations.jsx:146 | if (event.key === "ArrowRight" \|\| event.key === "ArrowLeft") { event.preventDefault(); const nextIn | Address Primary CTA with arrow icon with product-specific, non-template design/copy. |
| TASTE-PLT-002 | low | src/presentations/presentations.css:3 | header { display: flex; align-items: center; gap: 12px; padding: 18px 24px; border-bottom: | Prefer contextual separation only where floating UI overlaps content. |
| TASTE-TYP-002 | low | src/presentations/presentations.css:27 | 38px; display: flex; justify-content: space-between; color: #47769f; font-size: 16px; font-weight: 650; } | Prefer rem/clamp/system scale so layout respects user text size. |
| TASTE-FBK-001 | low | src/presentations/Presentations.jsx:58 | 28 pressable elements found without code-detectable active/pointer-down feedback. | Add subtle pointer-down feedback such as active:scale-[0.97] when appropriate. |

### Не доказано статическим аудитом

Для нового `src/presentations/IssueActions.jsx:24` сканер отметил AST-005 (low, «Excessive Lucide-style icons») на кнопке закрытия диалога и рекомендовал product-specific, non-template design/copy. Решение human-judgment: оставить стандартную Phosphor-иконку X с `aria-label`, согласованную с существующими окнами. Кнопки удаления и восстановления используют прежнюю систему компонентов; красный цвет ограничен опасным действием. Глобальный стиль ради сырой оценки не менялся.

Реальный контраст всех состояний, touch-targets, полноценная клавиатурная доступность модальных окон, cross-browser поведение и визуальная читаемость сотен длинных заголовков. Сценарий 120 задач проверяет полноту/пагинацию алгоритма, не утверждает идеальную читаемость всех карточек на маленьком экране. Презентации следует показывать на большом экране; длинные карточки открываются полностью по нажатию.
