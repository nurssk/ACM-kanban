import { STATUS_IDS } from "../data/model.js";

// Fixed 1280×720 template. Density is derived from the most populated column.
// After 12 rows, continue on another page instead of making text unreadable.
export function ticketLayout(issues, slide) {
  const statuses = STATUS_IDS.filter((status) => slide.statuses.includes(status));
  const filtered = issues.filter((issue) => !issue.archivedAt && issue.projectId === slide.projectId && statuses.includes(issue.status) && (!slide.assigneeId || issue.assignee === slide.assigneeId));
  const groups = statuses.map((status) => ({ status, issues: filtered.filter((issue) => issue.status === status).sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]) || (a.due || "9999").localeCompare(b.due || "9999") || a.identifier.localeCompare(b.identifier)) }));
  const rows = Math.max(1, ...groups.map((group) => group.issues.length));
  const pageSize = Math.min(rows, 12);
  return { groups, total: filtered.length, pageSize, pageCount: Math.max(1, Math.ceil(rows / 12)), density: rows <= 4 ? "comfortable" : rows <= 7 ? "compact" : "dense", cardHeight: Math.min(100, Math.floor((440 - (pageSize - 1) * 6) / pageSize)) };
}
export const slideLabel = (kind) => ({ title: "Заголовок", text: "Информация", tickets: "Тикеты проекта" }[kind]);
export function countLabel(count, one, few, many) {
  const digit = count % 10, rest = count % 100;
  return `${count} ${rest >= 11 && rest <= 14 ? many : digit === 1 ? one : digit >= 2 && digit <= 4 ? few : many}`;
}
