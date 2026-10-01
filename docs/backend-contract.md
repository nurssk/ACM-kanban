# ACM frontend → Cloudflare Worker / D1

Версия контракта 1; snapshot 2; 2026-10-01. HTTP-адаптер реализован; Worker, auth, D1 и Telegram НЕ реализованы и НЕ развёрнуты. [Reference SQL](cloudflare-schema.sql).

## Подключение

В `.env.local` после реализации API:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api/v1
```

Перезапустить Vite/пересобрать deployment. Предпочтителен same-origin `/api/v1` за Worker. Dev proxy настраивает backend-разработчик: текущий Vite сам не проксирует `/api`. Для отдельного origin нужны credentials CORS только для разрешённых origin, HTTPS и соответствующая cookie-политика. Никаких секретов в `VITE_*`: они публичны в браузере.

Адаптер использует `credentials: include`, JSON, timeout 15 секунд. Авторизация — серверная session cookie HttpOnly/Secure с подходящим SameSite. Worker проверяет Origin/CSRF для мутаций. Login-flow подключается вместе с выбранным провайдером: пока 401 отображается как ошибка, экрана входа нет.

UI работает с одним пространством из сессии. Клиентский actorId не является полномочием. Worker определяет пользователя/workspace из сессии, проверяет совпадение и права; сам назначает автора, время, номера и версии. Telegram webhook — отдельная аутентифицированная интеграция того же доменного сервиса.

## GET `/api/v1/workspace`

200: `{ "snapshot": WorkspaceSnapshot }`; `Cache-Control: no-store`. Возвращать только доступные текущему участнику данные. Начальная версия возвращает полный набор доступных задач/комментариев/слайдов. Нельзя молча обрезать issues, иначе презентация окажется неполной. Для больших объёмов нужна отдельная версия paginated API.

```ts
type WorkspaceSnapshot = {
  schemaVersion: 2;
  workspaceId: string;
  revision: number; // монотонно растёт при успешных изменениях
  currentUserId: string;
  members: Member[];
  projects: Project[];
  issues: Issue[];
  presentations: Presentation[];
  events: ChangeEvent[]; // допустимо последнее окно истории, НЕ источник бота
  receipts: string[]; // API может возвращать []; полные receipts только на сервере
};
type Meta = {
  id: string; workspaceId: string; version: number;
  createdAt: string; updatedAt: string;
  createdBy: string; updatedBy: string; archivedAt: string | null;
};
type Member = { id: string; name: string; initials: string; tone: string };
type Project = Meta & {
  code: string; name: string; summary: string; lead: string;
  members: string[]; target: string | null; accent: string;
};
type Status = "backlog" | "planned" | "progress" | "review" | "done";
type Issue = Meta & {
  identifier: string; projectId: string; title: string; description: string;
  status: Status; priority: "high" | "medium" | "low";
  assignee: string | null; due: string | null; labels: string[];
  comments: { id: string; author: string; text: string; createdAt: string }[];
};
type Slide = {
  id: string; kind: "title" | "text" | "tickets";
  title: string; body: string; notes: string;
  projectId: string | null; statuses: Status[]; assigneeId: string | null;
};
type Presentation = Meta & {
  title: string; owner: string; templateId: "acm-standard-v1"; slides: Slide[];
};
type ChangeEvent = {
  id: string; commandId: string; workspaceId: string;
  type: string; entityId: string; entityVersion: number; projectId: string | null;
  actorId: string; occurredAt: string; commentId?: string | null;
  changes: Record<string, { before: unknown; after: unknown }>;
};
```

due/target: `YYYY-MM-DD|null`. Время: UTC ISO 8601. Слайды упорядочены массивом; SQL position отображается в этот порядок. `projectId/statuses/assigneeId` — запрос к живым задачам, не их копия. projectId обязателен для tickets, для других типов null. Недоступный проект не подменять другим и не раскрывать его задачи.

Маппинг SQL → API: workspace_id→workspaceId, assignee_id→assignee, due_on→due, target_on→target, lead_id→lead, owner_id→owner, template_id→templateId. JSON-поля распаковать в массивы; comments присоединить в issue.comments, project_members в project.members. Не включать auth_subject, Telegram IDs, outbox и секреты. Роли проверяются сервером. Скрытие кнопок не заменяет permissions; безопасный capabilities для UI можно добавить позже.

## POST `/api/v1/commands`

Заголовки: `Content-Type: application/json`, `Idempotency-Key: <command.id>`.

```json
{
  "id": "391a23af-f678-4e23-8679-d311fb50fd35",
  "type": "issue.update",
  "entityId": "stable-issue-id",
  "expectedVersion": 4,
  "actorId": "member-id",
  "data": { "status": "review", "due": "2026-10-10" }
}
```

Успех 200: `{ "snapshot": WorkspaceSnapshot }`, согласованный snapshot после commit, возможно более новой revision. Повтор подтверждённой команды тоже возвращает актуальное состояние, не повторяя запись. Сервер должен обеспечивать read-after-write с учётом настроек согласованности D1.

| type | data | Версия |
| --- | --- | --- |
| issue.create | title, description?, projectId, status, priority, assignee?, due? | Новый entityId; без expectedVersion |
| issue.update | title, description, status, priority, assignee, due, labels (частично) | expectedVersion обязателен |
| issue.comment | id комментария, text | expectedVersion; версия задачи +1 |
| issue.archive | {} | expectedVersion; soft delete через archivedAt |
| issue.restore | {} | expectedVersion; снятие archivedAt, только в действующем проекте |
| project.create | code, name, summary, lead, members?, target?, accent? | Новый ID; code уникален |
| project.update | name, summary, lead, members, target (частично) | expectedVersion |
| presentation.create | title, slides | Новый ID; owner/templateId задаёт сервер |
| presentation.update | title и/или slides | expectedVersion всей презентации |
| presentation.archive | {} | expectedVersion; soft archive |
| presentation.restore | {} | expectedVersion |

Запрещено менять issue.id/identifier/projectId обычным update. Перенос между проектами — отдельная будущая команда. Удаление и восстановление задач реализованы во фронтенде презентаций. Архивация проектов, attachments и членство клуба через текущий UI не реализованы.

`issue.archive` не удаляет строку, а задаёт archivedAt, увеличивает version/revision и записывает событие. ID, identifier, поля и комментарии сохраняются; номер не переиспользуется. Удалённая задача исключается из активных списков/слайдов/поиска. Update и comment до восстановления запрещены. `issue.restore` возвращает прежний статус/исполнителя/срок; архивный проект не допускает восстановление. Обе команды используют те же CAS/idempotency правила, что issue.update. Snapshot должен включать доступные архивные задачи: иначе раздел «Удалённые» не сможет их восстановить.

На сервере удаление должно транзакционно отменять reminder jobs и ещё не отправленные уведомления задачи, увеличивая reminder_generation. Восстановление пересчитывает только актуальные будущие напоминания, не воспроизводит исторические сообщения. Действующий consumer всегда повторно проверяет archivedAt перед отправкой. Эти серверные операции пока описаны контрактом, не реализованы фронтендом.

### Ошибки

```json
{ "error": { "code": "CONFLICT", "message": "Запись изменена другим участником." } }
```

400/422 VALIDATION; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND; 409 CONFLICT для устаревшей версии/занятого ID/того же ключа с другим payload; 429 RATE_LIMITED — отказ до записи (Retry-After рекомендуется). Любые 5xx фронтенд считает неопределённым результатом и повторяет тот же ID.

Конфликт не означает last-write-wins: обновить snapshot, сравнить черновик. Невалидный snapshot после «успеха» тоже вызывает повтор с прежним ключом, поэтому контракт ответа обязателен.

## Атомарность

1. Проверить сессию, workspace, права, размер и whitelist полей. Новые IDs — UUID; legacy ID вроде WEB-24 допустимы.
2. Найти receipt по workspace/command ID и canonical request hash. Тот же actor/intent → вернуть актуальное состояние. Другой payload → 409. Проверять retry до expectedVersion, иначе команда конфликтует сама с собой.
3. Проверить CAS version=expectedVersion. Для issue.create атомарно выделить номер из projects.next_issue_number, не MAX+1 из клиентского snapshot.
4. Одним транзакционным D1 batch: изменить сущности, увеличить версии/revision, записать receipt, change_event и необходимые outbox/reminder записи.
5. После commit вернуть snapshot. Отдельный dispatcher отправляет outbox в Queue.

Важно: UPDATE с WHERE version=?, изменивший 0 строк, сам по себе НЕ ошибка. После него нельзя безусловно фиксировать receipt/outbox. Нужен атомарный guard, вызывающий rollback при провале CAS (например, проверяемый SQL trigger), либо эквивалентная доказанная условная схема. Предварительный SELECT вне транзакции недостаточен. Reference SQL описывает таблицы/ограничения, но не реализует command processor.

Презентация — единая версионируемая сущность: замена/перестановка всех slides вместе с version+1 в одной транзакции. Нельзя показывать промежуточный пустой дек. Issues при этом не затрагиваются.

Валидация: 1–100 слайдов, уникальные IDs, только три типа; title ≤300, body/notes ≤20000; ≥1 допустимого статуса; реальные календарные даты; все member/project ссылки из текущего workspace. SQL CHECK даты проверяет только форму строки, календарь — сервер. Ограничить размер команды (например 3 MB) и длину описаний/labels. Для истории участников деактивировать, а не удалять. Локальная валидация не является security boundary.

## Telegram

Закрытая вкладка не мешает боту: фронтенд не инициирует доставку. Web, bot и scheduler используют общую таблицу задач/доменный сервис, не копии презентаций или localStorage.

### Привязка

Backend выдаёт одноразовый короткоживущий link token для авторизованного member ID, хранит hash. Пользователь запускает бота и подтверждает opt-in; webhook проверяет token/expiry и связывает Telegram user/chat с member ID. Не доверять chat ID/username из браузера. Bot token — Worker secret; webhook проверяет secret token. Права и opt-in проверяются перед отправкой; отказ от уведомлений обязателен.

### Outbox

issue.create/update/comment содержат event ID, command ID, версию, project ID, actor, before/after; commentId ссылается на комментарий. Локальный журнал — демонстрация формата, не работающая очередь уведомлений.

Сервер в транзакции создаёт запись на каждого получателя с уникальным ключом `event:<eventId>:<recipientId>:<rule>`. Dispatcher отправляет в Queue только ID outbox. Периодический повторный проход pending записей восстанавливает сбой между commit и enqueue. Consumer получает lease, проверяет состояние/права/opt-in, формирует текст из доверенных данных БД, отправляет и фиксирует provider message ID/sent_at, затем ack.

Временные ошибки: backoff/retry. Постоянные: failed/disable link. Превышение попыток: dead-letter и операторский разбор. Секреты/личную переписку не логировать.

At-least-once очередь не даёт exactly-once Telegram. Падение после реальной отправки, но до sent_at, остаётся неоднозначным. Для timeout/неопределённого ответа использовать uncertain и согласованную политику ручной проверки/повтора с риском дубликата. Не обещать отсутствие всех дублей.

### Напоминания

due_on — дата в IANA timezone клуба (дефолт Asia/Almaty). Предлагаемые правила: за день и в день срока в 09:00 местного времени; это ещё не активные сообщения.

reminder_generation увеличивается при изменении срока/исполнителя/архивации. Старые jobs отменяются, новые создаются транзакционно. Cron выбирает scheduled_at в UTC, атомарно создаёт outbox `reminder:<jobId>:<recipientId>` и отмечает job обработанной. Consumer повторно проверяет generation, дату, исполнителя, opt-in, архив и статус: готовым задачам не отправлять. Поздние события не должны возвращать старый срок/назначение.

### Ссылки

При загрузке страницы фронтенд открывает `https://APP_ORIGIN/?issue=<encoded stable issue.id>` или `?presentation=<encoded id>`. Backend всё равно проверяет доступ; URL не является разрешением. В боте нужен публичный origin deployment, не localhost и не URL API. WEB-25 — текст сообщения, не ключ маршрута.

## Миграция

1. Настройки локального приложения → Скачать резервную копию. Нужен полный snapshot v2, не JSON одной презентации.
2. Backend-импорт выполняет администратор вне публичного command endpoint: проверить workspace, пользователей, ссылки, дубли, даты и размеры. Seed-имена не аккаунты; auth subjects сопоставляются отдельно.
3. Сохранить IDs/identifier; next_issue_number больше максимального импортированного. Даты без года мигрировались в 2026 — проверить до включения напоминаний.
4. Не отправлять исторические уведомления при импорте; client events — недоверенная история, не новые outbox jobs.
5. Проверить counts/hash и восстановление D1 в отдельную среду, затем переключать браузеры на API.

Локальный restore делает дополнительную копию прежнего snapshot в браузере, но это не замена скачанному бэкапу. Импорт в API-режиме намеренно недоступен. В production определить retention и защищённую процедуру удаления персональных данных, не каскадное удаление задач через презентации.

## Приёмка backend

- Два клиента меняют одну версию: один commit, другому 409, без лишнего event/outbox.
- Одновременное создание: разные номера, каждый UUID один раз.
- Потерянный после commit ответ: retry без дублей. Тот же ключ с другим payload отклоняется; чужие receipts не раскрываются.
- Ошибка вставки события/outbox откатывает задачу/receipt.
- Удаление слайда/архив деки/дублирование не меняют issues.
- Удаление задачи скрывает её во всех активных представлениях, сохраняет комментарии/номер и переживает reload. Восстановление возвращает ту же запись; stale delete/restore отклоняется, номер не переиспользуется.
- 0, 1, 12, 13, 120+ тикетов: все подходящие задачи достижимы.
- Смена срока/исполнителя и done отменяют старые напоминания; timezone/DST без жёсткого смещения.
- Queue retry не создаёт второй outbox; проверены падения dispatcher/consumer.
- Проверены реальные 401/403/429/503, offline и невалидный ответ через Worker, не только mocks.
- Snapshot не раскрывает приватные проекты, Telegram IDs, auth subjects, секреты.
- Backup/restore реально проверен.

## Источники

[D1 Worker API и batch](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/). Подтверждают выбор механизмов; доставка Telegram и авторизация требуют отдельной реализации.
