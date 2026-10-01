# ACM Kanban

Локальный MVP Club OS для ACM @ NU: проекты, задачи, исполнители, дедлайны и презентации с живыми слайдами задач. Интерфейс сделан в светлой сине-белой стилистике ACM и рассчитан на работу клуба с единым списком задач.

## Возможности

- проекты и общая доска задач;
- статусы, приоритеты, исполнители, комментарии и календарные дедлайны;
- поиск и разделы «Входящие» / «Мои задачи»;
- библиотека презентаций: создание, открытие, дублирование, архивирование и восстановление;
- один шаблон презентации `acm-standard-v1` и три вида слайдов: заголовок, информация, задачи проекта;
- живой слайд задач: один проект, фильтры статуса и исполнителя, создание и редактирование задач прямо на слайде;
- автоматическая плотность карточек и страницы для больших списков;
- soft delete задач с подтверждением и восстановлением через «Удалённые»;
- JSON-экспорт презентации и резервное копирование workspace;
- локальный репозиторий сейчас и HTTP-адаптер для будущего Cloudflare Worker / D1.

Презентация не копирует тикеты. Слайд хранит только `projectId` и фильтры, поэтому доска, презентация и будущий Telegram-бот используют одну задачу.

## Быстрый старт

Требуется Node.js 18+ и npm.

```bash
npm install
npm run dev
```

После запуска Vite покажет локальный адрес, обычно `http://localhost:5173/`. Если порт занят, будет выбран следующий свободный порт.

```bash
npm test          # автоматические тесты модели, репозитория и раскладки
npm run build     # production-сборка в dist/
npm run preview   # просмотр собранной версии
```

По умолчанию приложение работает в локальном режиме и сохраняет данные в `localStorage` браузера. Демоданные загружаются из `src/components.jsx` при первом запуске.

## Режимы хранения

Локальный режим включён по умолчанию. Для API создайте `.env.local` на основе [.env.example](.env.example):

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api/v1
```

После изменения `.env.local` перезапустите Vite. Переменные `VITE_*` видны в браузере — секреты, токены Cloudflare и Telegram туда добавлять нельзя.

В API-режиме фронтенд ожидает `GET /api/v1/workspace` и `POST /api/v1/commands`. Команды передаются с заголовком `Idempotency-Key`; записи защищены `expectedVersion`. Полный контракт Worker, правила прав, outbox и Telegram описаны в [docs/backend-contract.md](docs/backend-contract.md). Reference-схема D1 находится в [docs/cloudflare-schema.sql](docs/cloudflare-schema.sql) и не применяется автоматически.

## Как устроен код

```text
src/
├── main.jsx                         # точка входа React и подключение CSS
├── WorkspaceApp.jsx                 # маршрутизация экранов и orchestration команд
├── components.jsx                   # общий shell, sidebar, формы, IssueSheet и seed-данные
├── styles.css                       # общие стили приложения
├── presentations/
│   ├── Presentations.jsx            # библиотека, редактор, canvas и режим показа
│   ├── IssueActions.jsx             # удаление и восстановление задач в презентации
│   ├── layout.js                    # фильтрация, сортировка, плотность и pagination тикетов
│   └── presentations.css            # стили 16:9-слайда и редактора
└── data/
    ├── model.js                     # snapshot, валидация, миграции и applyCommand
    ├── repository.js                # localStorage- и HTTP-репозитории
    └── useWorkspace.js              # загрузка, отправка команд, retry и конфликты

tests/
├── workspace.test.js                # поведение данных, задач, презентаций и репозиториев
└── schema.test.js                   # проверка reference SQL-ограничений
```

### Точка входа и экран приложения

`src/main.jsx` монтирует `WorkspaceApp` и подключает общие стили. `src/WorkspaceApp.jsx` получает snapshot из `useWorkspace`, выбирает текущий экран, открывает формы задач и переводит действия UI в команды модели.

Общие компоненты и seed-данные находятся в `src/components.jsx`. Не дублируйте формы задач для презентаций: canvas вызывает callbacks `onCreateTask`, `onOpenIssue`, `onDeleteIssue` и использует те же `TaskModal` / `IssueSheet`.

### Слой данных

Главная структура — `snapshot` со списками `members`, `projects`, `issues`, `presentations`, `events` и `receipts`. Изменения проходят через команды в `src/data/model.js`:

```text
issue.create / issue.update / issue.comment
issue.archive / issue.restore
presentation.create / presentation.update
presentation.archive / presentation.restore
project.create / project.update
```

Каждая сущность имеет `id`, `version`, временные поля и `archivedAt`. `issue.id` — стабильный технический ключ для API и бота, `identifier` (`WEB-25`) — только читаемый номер. Версии используются для CAS-конфликтов; повтор команды с тем же ID идемпотентен.

`repository.js` разделяет доменную модель и транспорт. Локальный репозиторий пишет snapshot одним JSON-записыванием под ключом `club-os-workspace-v2`. HTTP-репозиторий отправляет те же команды на Worker. `useWorkspace.js` отвечает за загрузку, состояние busy/error, журнал неподтверждённой HTTP-команды в `sessionStorage`, повтор отправки и обновление snapshot.

### Презентации

Подробное описание для разработчиков — в [docs/presentations.md](docs/presentations.md). Коротко:

- `PresentationLibrary` показывает активные и архивные деки;
- `PresentationEditor` хранит черновик, автосохраняет изменения и проверяет `version`;
- `SlideCanvas` одинаково используется в редакторе и в режиме показа;
- слайд `tickets` связан ровно с одним проектом через `projectId`;
- `ticketLayout()` исключает архивные задачи, применяет фильтры и делит длинные колонки на страницы;
- удаление задачи — soft delete: запись и комментарии остаются, задача исчезает из активных представлений и восстанавливается командой `issue.restore`.

Markdown разрешён только в информационном слайде и обрабатывается ограниченным рендерером. HTML и произвольный JSX не исполняются. Keystatic и внешняя CMS в проекте не используются.

## Данные и миграции

Текущий формат snapshot — `schemaVersion: 2`. При первом запуске старые ключи `club-os-projects`, `club-os-issues`, `club-os-presentations` и `club-os-slides` мигрируются в общий snapshot. Повреждённые данные не заменяются демоданными.

В интерфейсе настроек доступны экспорт JSON и восстановление из JSON. Перед восстановлением локальный репозиторий сохраняет текущий snapshot в backup-ключе. `localStorage` — только прототип для одного браузера, не общая база и не источник данных для Telegram.

## Документация

- [production.md](production.md) — продуктовая схема, хранение и план production-этапа.
- [docs/presentations.md](docs/presentations.md) — устройство редактора презентаций и живых слайдов.
- [docs/backend-contract.md](docs/backend-contract.md) — контракт Cloudflare Worker / D1 / Telegram.
- [docs/cloudflare-schema.sql](docs/cloudflare-schema.sql) — reference SQL-схема.
- [docs/verification.md](docs/verification.md) — результаты тестов и ручной браузерной проверки.
- [PRODUCT.md](PRODUCT.md) — продуктовые ограничения и аудитория.
- [DESIGN.md](DESIGN.md) — цветовая система, компоненты и выбранный стиль.

## Рабочий процесс для разработчика

1. Перед изменением модели прочитать `src/data/model.js` и существующие тесты.
2. Не хранить копии задач внутри презентаций — добавлять только ссылки и фильтры слайда.
3. Все изменения данных проводить через `applyCommand` и `useWorkspace.execute`, не писать напрямую в `localStorage` из UI.
4. Для новой команды обновить валидацию, события, HTTP-контракт и тесты.
5. После изменений запускать `npm test`, `npm run build` и проверять `git diff --check`.
6. При изменении UI сохранить светлый ACM-стиль и проверить редактор, режим показа и узкий viewport.

## Текущий статус

Это локальный MVP. Авторизация, серверные права, Worker/D1, очередь уведомлений и Telegram-бот пока подготовлены контрактом, но не реализованы в этом репозитории. Следующий production-шаг — подключить Worker к существующему HTTP-адаптеру, перенести snapshot с сохранением стабильных ID и добавить серверную обработку outbox/напоминаний.
