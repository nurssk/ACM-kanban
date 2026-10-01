export const SCHEMA_VERSION = 2;
export const WORKSPACE_ID = "acm-nu";
export const STATUS_IDS = ["backlog", "planned", "progress", "review", "done"];
export const ACTIVE_STATUSES = ["planned", "progress", "review"];
export const newId = () => crypto.randomUUID();
export class DataError extends Error {
  constructor(message, code = "VALIDATION") { super(message); this.code = code; }
}
const assert = (test, message, code) => { if (!test) throw new DataError(message, code); };
const cleanText = (value, label, max = 300) => {
  assert(typeof value === "string" && value.trim() && value.length <= max, `${label}: укажите текст до ${max} символов.`);
  return value.trim();
};
const monthNumbers = { янв: "01", фев: "02", мар: "03", апр: "04", май: "05", июн: "06", июл: "07", авг: "08", сен: "09", окт: "10", ноя: "11", дек: "12" };
export function normalizeDate(value) {
  if (!value) return null;
  const old = String(value).match(/^(\d{1,2})\s+([а-я]{3})$/i);
  const date = old && monthNumbers[old[2]] ? `2026-${monthNumbers[old[2]]}-${old[1].padStart(2, "0")}` : value;
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date, "Некорректная дата.");
  return date;
}
export function makeSlide(kind, projectId = null) {
  return { id: newId(), kind, title: kind === "title" ? "Новая презентация" : kind === "tickets" ? "Задачи проекта" : "Новый слайд", body: "", notes: "", projectId: kind === "tickets" ? projectId : null, statuses: [...ACTIVE_STATUSES], assigneeId: null };
}
export function normalizeSlide(slide, fallbackProjectId) {
  const legacyProject = typeof slide.body === "string" && slide.body.match(/<TicketBoard\s[^>]*project=["']([^"']+)["']/)?.[1];
  return { id: slide.id || newId(), kind: slide.kind, title: slide.title ?? "", body: slide.kind === "tickets" ? "" : slide.body ?? "", notes: slide.notes ?? "", projectId: slide.kind === "tickets" ? (slide.projectId || legacyProject || fallbackProjectId || null) : null, statuses: slide.statuses ?? [...ACTIVE_STATUSES], assigneeId: slide.assigneeId ?? null };
}
export function migrateWorkspace(legacy, now = new Date().toISOString()) {
  const meta = (item) => ({ ...item, workspaceId: WORKSPACE_ID, version: item.version || 1, createdAt: item.createdAt || now, updatedAt: Number.isNaN(Date.parse(item.updatedAt)) ? now : item.updatedAt || now, createdBy: item.createdBy || item.owner || item.lead || "nursultan", updatedBy: item.updatedBy || item.owner || item.lead || "nursultan" });
  const snapshot = {
    schemaVersion: SCHEMA_VERSION, workspaceId: WORKSPACE_ID, revision: 0,
    currentUserId: "nursultan", members: legacy.members,
    projects: legacy.projects.map((item) => ({ ...meta(item), target: normalizeDate(item.target), members: item.members ?? legacy.members.map((member) => member.id), archivedAt: null })),
    issues: legacy.issues.map((item) => ({ ...meta(item), identifier: item.identifier || item.id, due: normalizeDate(item.due), assignee: item.assignee || null, createdBy: item.createdBy || "nursultan", updatedBy: item.updatedBy || "nursultan", archivedAt: null, comments: (item.comments || []).map((comment) => ({ ...comment, id: String(comment.id), createdAt: comment.createdAt || now })) })),
    presentations: legacy.presentations.map((item) => ({ ...meta(item), templateId: "acm-standard-v1", archivedAt: null, slides: item.slides.map((slide) => normalizeSlide(slide, item.projectId)) })),
    events: [], receipts: [],
  };
  validateSnapshot(snapshot);
  return snapshot;
}
export function validateSnapshot(state) {
  assert(state && state.schemaVersion === SCHEMA_VERSION, "Неподдерживаемая версия данных.");
  assert(typeof state.workspaceId === "string" && Number.isInteger(state.revision) && state.revision >= 0, "Некорректная версия пространства.");
  for (const name of ["members", "projects", "issues", "presentations", "events", "receipts"]) assert(Array.isArray(state[name]), `Отсутствует список ${name}.`);
  for (const name of ["members", "projects", "issues", "presentations"]) {
    assert(state[name].every((item) => typeof item.id === "string" && item.id), `Некорректный ID ${name}.`);
    assert(new Set(state[name].map((item) => item.id)).size === state[name].length, `Повторяющиеся ID ${name}.`);
  }
  const memberIds = new Set(state.members.map((item) => item.id));
  for (const member of state.members) cleanText(member.name, "Имя участника");
  assert(memberIds.has(state.currentUserId), "Текущий участник отсутствует.");
  const projectIds = new Set(state.projects.map((item) => item.id));
  for (const collection of [state.projects, state.issues, state.presentations]) for (const item of collection) {
    assert(item.workspaceId === state.workspaceId && Number.isInteger(item.version) && item.version > 0, "Некорректная принадлежность или версия записи.");
    assert(typeof item.createdAt === "string" && !Number.isNaN(Date.parse(item.createdAt)) && typeof item.updatedAt === "string" && !Number.isNaN(Date.parse(item.updatedAt)), "Некорректное время записи.");
  }
  for (const project of state.projects) {
    cleanText(project.name, "Название проекта"); cleanText(project.code, "Код проекта", 12);
    assert(memberIds.has(project.lead) && Array.isArray(project.members) && project.members.every((id) => memberIds.has(id)), "Некорректные участники проекта.");
    normalizeDate(project.target);
  }
  assert(new Set(state.projects.map((item) => item.code)).size === state.projects.length, "Код проекта уже занят.");
  assert(new Set(state.issues.map((item) => item.identifier)).size === state.issues.length, "Повторяется номер задачи.");
  for (const issue of state.issues) {
    cleanText(issue.title, "Название задачи"); cleanText(issue.identifier, "Номер задачи");
    assert(projectIds.has(issue.projectId), "Проект задачи не найден.");
    assert(STATUS_IDS.includes(issue.status) && ["high", "medium", "low"].includes(issue.priority), "Некорректный статус или приоритет.");
    assert(issue.assignee === null || memberIds.has(issue.assignee), "Исполнитель не найден.");
    assert(typeof issue.description === "string" && Array.isArray(issue.comments) && Array.isArray(issue.labels), "Некорректные поля задачи.");
    assert(issue.labels.every((label) => typeof label === "string"), "Некорректные метки задачи.");
    assert(new Set(issue.comments.map((comment) => comment.id)).size === issue.comments.length, "Повторяются ID комментариев.");
    for (const comment of issue.comments) { cleanText(comment.text, "Комментарий", 10000); assert(typeof comment.id === "string" && comment.id && memberIds.has(comment.author), "Некорректный ID или автор комментария."); }
    normalizeDate(issue.due);
  }
  for (const presentation of state.presentations) {
    cleanText(presentation.title, "Название презентации");
    assert(memberIds.has(presentation.owner), "Владелец презентации не найден.");
    assert(presentation.templateId === "acm-standard-v1", "Неизвестный шаблон.");
    assert(Array.isArray(presentation.slides) && presentation.slides.length > 0 && presentation.slides.length <= 100, "В презентации должно быть от 1 до 100 слайдов.");
    assert(new Set(presentation.slides.map((slide) => slide.id)).size === presentation.slides.length, "Повторяются ID слайдов.");
    for (const slide of presentation.slides) {
      assert(typeof slide.id === "string" && ["title", "text", "tickets"].includes(slide.kind), "Неизвестный тип слайда.");
      assert(typeof slide.title === "string" && slide.title.length <= 300 && typeof slide.body === "string" && slide.body.length <= 20000 && typeof slide.notes === "string" && slide.notes.length <= 20000, "Некорректное содержимое слайда.");
      if (slide.kind === "tickets") {
        // Missing/archived projects remain visible as an unavailable source, never another project's tasks.
        assert(typeof slide.projectId === "string" && slide.projectId, "Выберите один проект для слайда с тикетами.");
        assert(Array.isArray(slide.statuses) && slide.statuses.length > 0 && slide.statuses.every((id) => STATUS_IDS.includes(id)), "Выберите хотя бы один статус.");
        assert(slide.assigneeId === null || memberIds.has(slide.assigneeId), "Исполнитель фильтра не найден.");
      }
    }
  }
  for (const event of state.events) {
    assert(event && typeof event.id === "string" && typeof event.type === "string" && typeof event.entityId === "string" && typeof event.occurredAt === "string" && !Number.isNaN(Date.parse(event.occurredAt)), "Некорректный журнал изменений.");
  }
  assert(state.receipts.every((receipt) => typeof receipt === "string" && receipt), "Некорректные квитанции команд.");
  return state;
}
export function applyCommand(snapshot, command, now = new Date().toISOString()) {
  assert(typeof command.id === "string" && command.id && typeof command.entityId === "string" && command.entityId, "Некорректный ID команды или записи.");
  assert(["issue.create", "issue.update", "issue.comment", "issue.archive", "issue.restore", "project.create", "project.update", "presentation.create", "presentation.update", "presentation.archive", "presentation.restore"].includes(command.type), "Неизвестная операция.");
  assert(command.data && typeof command.data === "object" && !Array.isArray(command.data), "Некорректные данные команды.");
  if (snapshot.receipts.includes(command.id)) return snapshot;
  const state = structuredClone(snapshot);
  const { type, data, entityId, expectedVersion, actorId } = command;
  assert(state.members.some((item) => item.id === actorId), "Участник не найден.");
  const group = type.split(".")[0];
  const collection = { issue: "issues", project: "projects", presentation: "presentations" }[group];
  assert(collection, "Неизвестная операция.");
  const before = state[collection].find((item) => item.id === entityId);
  let after;
  if (type.endsWith(".create")) {
    assert(!before, "ID уже существует.", "CONFLICT");
    const meta = { id: entityId, workspaceId: state.workspaceId, version: 1, createdAt: now, updatedAt: now, createdBy: actorId, updatedBy: actorId, archivedAt: null };
    if (group === "issue") {
      const project = state.projects.find((item) => item.id === data.projectId && !item.archivedAt);
      assert(project, "Проект недоступен.");
      const numbers = state.issues.filter((item) => item.projectId === data.projectId).map((item) => Number(item.identifier.split("-").at(-1)) || 0);
      after = { ...data, ...meta, title: cleanText(data.title, "Название задачи"), identifier: `${project.code}-${Math.max(0, ...numbers) + 1}`, due: normalizeDate(data.due), assignee: data.assignee || null, description: data.description || "", labels: [], comments: [] };
    } else if (group === "project") {
      after = { ...data, ...meta, name: cleanText(data.name, "Название проекта"), target: normalizeDate(data.target), members: [...new Set([actorId, data.lead, ...(data.members || [])])] };
    } else {
      after = { ...data, ...meta, title: cleanText(data.title, "Название презентации"), owner: actorId, templateId: "acm-standard-v1" };
    }
    state[collection].push(after);
  } else {
    assert(before, "Запись не найдена.", "NOT_FOUND");
    assert(before.version === expectedVersion, "Запись уже изменилась. Обновите данные и сравните с вашим черновиком.", "CONFLICT");
    after = { ...before, version: before.version + 1, updatedAt: now, updatedBy: actorId };
    if (type === "issue.comment") {
      assert(!before.archivedAt, "Сначала восстановите задачу из удалённых.");
      assert(typeof data.id === "string" && data.id && !after.comments.some((comment) => comment.id === data.id), "Комментарий с таким ID уже существует.", "CONFLICT");
      after.comments.push({ id: data.id, text: cleanText(data.text, "Комментарий", 10000), author: actorId, createdAt: now });
    } else if (type === "issue.archive") {
      assert(!before.archivedAt, "Задача уже удалена.", "CONFLICT");
      after.archivedAt = now;
    } else if (type === "issue.restore") {
      assert(Boolean(before.archivedAt), "Задача уже восстановлена.", "CONFLICT");
      assert(state.projects.some((project) => project.id === before.projectId && !project.archivedAt), "Проект недоступен для восстановления задачи.");
      after.archivedAt = null;
    } else if (type === "presentation.archive") {
      after.archivedAt = now;
    } else if (type === "presentation.restore") {
      after.archivedAt = null;
    } else if (type.endsWith(".update")) {
      assert(!before.archivedAt, "Сначала восстановите запись из архива.");
      const fields = { issue: ["title", "description", "status", "priority", "assignee", "due", "labels"], project: ["name", "summary", "lead", "members", "target"], presentation: ["title", "slides"] }[group];
      for (const field of fields) if (Object.hasOwn(data, field)) after[field] = structuredClone(data[field]);
      if (group === "issue") { after.title = cleanText(after.title, "Название задачи"); after.due = normalizeDate(after.due); }
      if (group === "project") { after.target = normalizeDate(after.target); after.members = [...new Set([after.lead, ...after.members])]; }
    } else throw new DataError("Неизвестная операция.");
    state[collection] = state[collection].map((item) => item.id === entityId ? after : item);
  }
  state.revision += 1;
  state.events.push({ id: newId(), commandId: command.id, workspaceId: state.workspaceId, type, entityId, projectId: after.projectId || (group === "project" ? after.id : null), actorId, entityVersion: after.version, occurredAt: now, commentId: type === "issue.comment" ? data.id : null, changes: Object.fromEntries(Object.keys(after).filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after[key]) && !["slides", "comments"].includes(key)).map((key) => [key, { before: before?.[key] ?? null, after: after[key] }])) });
  state.receipts.push(command.id);
  validateSnapshot(state);
  return state;
}
