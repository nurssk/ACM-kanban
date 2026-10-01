import test from "node:test";
import assert from "node:assert/strict";
import { applyCommand, makeSlide, migrateWorkspace, normalizeDate, validateSnapshot } from "../src/data/model.js";
import { createHttpRepository, createLocalRepository, STORAGE_KEY } from "../src/data/repository.js";
import { ticketLayout } from "../src/presentations/layout.js";

const seeds = {
  members: [{ id: "nursultan", name: "Нурсултан" }, { id: "aida", name: "Аида" }],
  projects: [{ id: "p1", code: "WEB", name: "Сайт", lead: "aida", target: "30 сен" }, { id: "p2", code: "EVENT", name: "Встреча", lead: "nursultan", target: null }],
  issues: [{ id: "WEB-24", projectId: "p1", title: "Задача", status: "planned", priority: "medium", description: "", assignee: "aida", due: "24 сен", labels: [], comments: [] }],
  presentations: [{ id: "deck", title: "Встреча", owner: "nursultan", projectId: "p1", slides: [{ id: "s1", kind: "tickets", title: "Задачи", body: '<TicketBoard project="p2" />' }] }],
};
const snapshot = () => migrateWorkspace(seeds, "2026-10-01T00:00:00.000Z");
const command = (type, entityId, data, expectedVersion) => ({ id: crypto.randomUUID(), type, entityId, data, expectedVersion, actorId: "nursultan" });
const newIssue = (projectId = "p1") => ({ title: "Новая задача", projectId, status: "planned", priority: "medium", assignee: null });
function storageMock() {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), items };
}

test("legacy migration preserves IDs, parses due dates and extracts a single project", () => {
  const state = snapshot();
  assert.equal(state.issues[0].id, "WEB-24");
  assert.equal(state.issues[0].identifier, "WEB-24");
  assert.equal(state.issues[0].due, "2026-09-24");
  assert.equal(state.presentations[0].slides[0].projectId, "p2");
  assert.equal(state.presentations[0].slides[0].body, "");
  assert.equal(state.presentations[0].templateId, "acm-standard-v1");
});
test("calendar dates are date-only and impossible dates are rejected", () => {
  assert.equal(normalizeDate("2028-02-29"), "2028-02-29");
  assert.equal(normalizeDate(""), null);
  assert.throws(() => normalizeDate("2026-02-29"));
  assert.throws(() => normalizeDate("2026-10-01T00:00:00Z"));
});
test("stable task ID is independent from unique per-project human number", () => {
  const state = snapshot();
  const first = applyCommand(state, command("issue.create", "uuid-a", newIssue()));
  const second = applyCommand(first, command("issue.create", "uuid-b", newIssue()));
  const other = applyCommand(second, command("issue.create", "uuid-c", newIssue("p2")));
  assert.equal(other.issues.find((issue) => issue.id === "uuid-a").identifier, "WEB-25");
  assert.equal(other.issues.find((issue) => issue.id === "uuid-b").identifier, "WEB-26");
  assert.equal(other.issues.find((issue) => issue.id === "uuid-c").identifier, "EVENT-1");
  assert.equal(state.issues.length, 1);
});
test("a retried command does not create a second task or event", () => {
  const cmd = command("issue.create", "new", newIssue());
  const first = applyCommand(snapshot(), cmd);
  const second = applyCommand(first, cmd);
  assert.equal(second, first);
  assert.equal(second.events.length, 1);
});
test("task edits update version and structured audit history", () => {
  const state = applyCommand(snapshot(), command("issue.update", "WEB-24", { status: "review", due: "2026-10-10" }, 1));
  assert.equal(state.issues[0].version, 2);
  assert.equal(state.events[0].changes.status.before, "planned");
  assert.equal(state.events[0].changes.status.after, "review");
  assert.equal(state.events[0].projectId, "p1");
  assert.equal(state.events[0].entityId, "WEB-24");
});
test("stale writes, invalid statuses and unknown projects never mutate a snapshot", () => {
  const state = snapshot();
  assert.throws(() => applyCommand(state, command("issue.update", "WEB-24", { status: "done" }, 0)), { code: "CONFLICT" });
  assert.throws(() => applyCommand(state, command("issue.update", "WEB-24", { status: "invalid" }, 1)));
  assert.throws(() => applyCommand(state, command("issue.create", "new", newIssue("missing"))));
  assert.throws(() => applyCommand(state, command("issue.any.update", "WEB-24", {}, 1)));
  assert.equal(state.revision, 0);
});
test("comment IDs are unique and comments have server-compatible metadata", () => {
  const state = applyCommand(snapshot(), command("issue.comment", "WEB-24", { id: "comment-id", text: "Готово" }, 1));
  assert.equal(state.issues[0].comments[0].author, "nursultan");
  assert.ok(state.issues[0].comments[0].createdAt);
  assert.throws(() => applyCommand(state, command("issue.comment", "WEB-24", { id: "comment-id", text: "Дубликат" }, 2)));
});
test("deleting or duplicating slides never changes tasks", () => {
  let state = snapshot();
  const ticket = state.presentations[0].slides[0];
  state = applyCommand(state, command("presentation.update", "deck", { slides: [ticket, { ...ticket, id: "copy" }, makeSlide("text")] }, 1));
  state = applyCommand(state, command("presentation.update", "deck", { slides: [makeSlide("title")] }, 2));
  assert.deepEqual(state.issues, snapshot().issues);
});
test("archive is reversible and archived presentations cannot be edited", () => {
  const archived = applyCommand(snapshot(), command("presentation.archive", "deck", {}, 1));
  assert.ok(archived.presentations[0].archivedAt);
  assert.throws(() => applyCommand(archived, command("presentation.update", "deck", { title: "Изменить" }, 2)));
  const restored = applyCommand(archived, command("presentation.restore", "deck", {}, 2));
  assert.equal(restored.presentations[0].archivedAt, null);
});
test("a ticket slide requires exactly one project and at least one valid status", () => {
  const state = snapshot();
  state.presentations[0].slides[0].projectId = ["p1", "p2"];
  assert.throws(() => validateSnapshot(state));
  state.presentations[0].slides[0].projectId = "p1";
  state.presentations[0].slides[0].statuses = [];
  assert.throws(() => validateSnapshot(state));
});
test("deleting a task keeps its content and comments, removes it from every live slide and records an event", () => {
  const original = applyCommand(snapshot(), command("issue.comment", "WEB-24", { id: "keep-comment", text: "Контекст" }, 1));
  const slide = makeSlide("tickets", "p1");
  const deleted = applyCommand(original, command("issue.archive", "WEB-24", {}, 2), "2026-10-01T10:00:00.000Z");
  assert.equal(deleted.issues.length, original.issues.length);
  assert.equal(deleted.issues[0].archivedAt, "2026-10-01T10:00:00.000Z");
  assert.deepEqual(deleted.issues[0].comments, original.issues[0].comments);
  assert.equal(deleted.issues[0].title, original.issues[0].title);
  assert.equal(deleted.issues[0].version, 3);
  assert.equal(ticketLayout(deleted.issues, slide).total, 0);
  assert.equal(ticketLayout(deleted.issues, { ...slide, id: "another-slide" }).total, 0);
  assert.deepEqual(deleted.presentations, original.presentations);
  assert.equal(deleted.events.at(-1).type, "issue.archive");
  assert.deepEqual(deleted.events.at(-1).changes.archivedAt, { before: null, after: "2026-10-01T10:00:00.000Z" });
  assert.equal(original.issues[0].archivedAt, null);
});
test("restore preserves ID, number, assignment, deadline and status", () => {
  const original = snapshot();
  const deleted = applyCommand(original, command("issue.archive", "WEB-24", {}, 1));
  const restored = applyCommand(deleted, command("issue.restore", "WEB-24", {}, 2));
  for (const field of ["id", "identifier", "projectId", "assignee", "due", "status", "priority", "description"]) assert.equal(restored.issues[0][field], original.issues[0][field]);
  assert.equal(restored.issues[0].archivedAt, null);
  assert.equal(restored.issues[0].version, 3);
  assert.equal(ticketLayout(restored.issues, makeSlide("tickets", "p1")).total, 1);
  assert.equal(restored.events.at(-1).type, "issue.restore");
});
test("archive and restore are version-checked and idempotent on retry", () => {
  const archive = command("issue.archive", "WEB-24", {}, 1);
  const deleted = applyCommand(snapshot(), archive);
  assert.equal(applyCommand(deleted, archive), deleted);
  assert.throws(() => applyCommand(deleted, command("issue.archive", "WEB-24", {}, 1)), { code: "CONFLICT" });
  assert.throws(() => applyCommand(deleted, command("issue.restore", "WEB-24", {}, 1)), { code: "CONFLICT" });
  const restore = command("issue.restore", "WEB-24", {}, 2);
  const restored = applyCommand(deleted, restore);
  assert.equal(applyCommand(restored, restore), restored);
  assert.equal(restored.events.length, 2);
});
test("deleted tasks cannot be updated or commented on before restore", () => {
  const deleted = applyCommand(snapshot(), command("issue.archive", "WEB-24", {}, 1));
  assert.throws(() => applyCommand(deleted, command("issue.update", "WEB-24", { title: "Нельзя" }, 2)));
  assert.throws(() => applyCommand(deleted, command("issue.comment", "WEB-24", { id: "comment", text: "Нельзя" }, 2)));
  assert.throws(() => applyCommand(deleted, command("issue.archive", "WEB-24", {}, 2)), { code: "CONFLICT" });
  assert.throws(() => applyCommand(snapshot(), command("issue.restore", "WEB-24", {}, 1)), { code: "CONFLICT" });
});
test("deleted task numbers are not reused and restore rejects an unavailable project", () => {
  const deleted = applyCommand(snapshot(), command("issue.archive", "WEB-24", {}, 1));
  const created = applyCommand(deleted, command("issue.create", "new", newIssue()));
  assert.equal(created.issues.find((issue) => issue.id === "new").identifier, "WEB-25");
  const unavailable = structuredClone(deleted);
  unavailable.projects[0].archivedAt = "2026-10-01T00:00:00.000Z";
  assert.throws(() => applyCommand(unavailable, command("issue.restore", "WEB-24", {}, 2)));
});
test("deleting the final ticket of an overflow page reduces page count without losing the others", () => {
  const state = snapshot();
  state.issues = Array.from({ length: 13 }, (_, index) => ({ ...state.issues[0], id: `task-${index}`, identifier: `WEB-${index + 1}` }));
  const slide = makeSlide("tickets", "p1");
  assert.equal(ticketLayout(state.issues, slide).pageCount, 2);
  const deleted = applyCommand(state, command("issue.archive", "task-12", {}, 1));
  const layout = ticketLayout(deleted.issues, slide);
  assert.equal(layout.pageCount, 1);
  assert.equal(layout.total, 12);
});
test("delete and restore survive local repository reloads", async () => {
  const storage = storageMock(), repo = createLocalRepository(storage, seeds, null);
  await repo.load();
  await repo.execute(command("issue.archive", "WEB-24", {}, 1));
  const reloaded = createLocalRepository(storage, seeds, null);
  assert.ok((await reloaded.load()).issues[0].archivedAt);
  await reloaded.execute(command("issue.restore", "WEB-24", {}, 2));
  assert.equal((await createLocalRepository(storage, seeds, null).load()).issues[0].archivedAt, null);
});
test("ticket layout isolates project, status, assignee and archived tasks", () => {
  const tasks = [
    { ...snapshot().issues[0], id: "a", projectId: "p1" },
    { ...snapshot().issues[0], id: "b", projectId: "p2" },
    { ...snapshot().issues[0], id: "c", projectId: "p1", status: "done" },
    { ...snapshot().issues[0], id: "d", projectId: "p1", assignee: "nursultan" },
    { ...snapshot().issues[0], id: "e", projectId: "p1", archivedAt: "2026-10-01T00:00:00Z" },
  ];
  const layout = ticketLayout(tasks, { ...makeSlide("tickets", "p1"), assigneeId: "aida" });
  assert.deepEqual(layout.groups.flatMap((group) => group.issues.map((issue) => issue.id)), ["a"]);
});
test("120 tasks auto compact and every task remains reachable by pages", () => {
  const tasks = Array.from({ length: 120 }, (_, i) => ({ ...snapshot().issues[0], id: `task-${i}`, identifier: `WEB-${i + 1}` }));
  const layout = ticketLayout(tasks, makeSlide("tickets", "p1"));
  assert.equal(layout.density, "dense");
  assert.equal(layout.pageCount, 10);
  assert.ok(layout.cardHeight >= 30);
  const reachable = Array.from({ length: layout.pageCount }, (_, page) => layout.groups.flatMap((group) => group.issues.slice(page * layout.pageSize, (page + 1) * layout.pageSize))).flat();
  assert.equal(new Set(reachable.map((item) => item.id)).size, 120);
  assert.equal(ticketLayout(tasks.slice(0, 2), makeSlide("tickets", "p1")).density, "comfortable");
  assert.equal(ticketLayout(tasks.slice(0, 6), makeSlide("tickets", "p1")).density, "compact");
});
test("local repository migrates without deleting legacy storage", async () => {
  const storage = storageMock();
  storage.setItem("club-os-issues", JSON.stringify(seeds.issues));
  const repo = createLocalRepository(storage, seeds, null);
  await repo.load();
  assert.ok(storage.getItem("club-os-issues"));
  assert.ok(storage.getItem(STORAGE_KEY));
});
test("corrupt local data are never silently replaced with demo data", async () => {
  const storage = storageMock(); storage.setItem(STORAGE_KEY, "{broken");
  await assert.rejects(createLocalRepository(storage, seeds, null).load(), { code: "CORRUPT" });
  assert.equal(storage.getItem(STORAGE_KEY), "{broken");
});
test("another tab's write is detected and both tasks survive after refresh", async () => {
  const storage = storageMock();
  const a = createLocalRepository(storage, seeds, null), b = createLocalRepository(storage, seeds, null);
  await a.load(); await b.load();
  await a.execute(command("issue.create", "a", newIssue()));
  const cmd = command("issue.create", "b", newIssue());
  await assert.rejects(b.execute(cmd), { code: "CONFLICT" });
  await b.load(); await b.execute(cmd);
  assert.equal((await a.load()).issues.length, 3);
});
test("storage quota failure leaves the previously committed snapshot intact", async () => {
  const storage = storageMock(), repo = createLocalRepository(storage, seeds, null);
  await repo.load();
  const before = storage.getItem(STORAGE_KEY);
  storage.setItem = () => { throw Error("QuotaExceeded"); };
  await assert.rejects(repo.execute(command("issue.create", "a", newIssue())), { code: "STORAGE" });
  assert.equal(storage.getItem(STORAGE_KEY), before);
});
test("restore validates and keeps a recoverable copy of the previous snapshot", async () => {
  const storage = storageMock(), repo = createLocalRepository(storage, seeds, null);
  await repo.load();
  await repo.execute(command("issue.create", "a", newIssue()));
  const restored = await repo.restore(snapshot());
  assert.equal(restored.revision, 2);
  assert.equal(restored.issues[0].version, 2);
  assert.throws(() => applyCommand(restored, command("issue.update", "WEB-24", { status: "done" }, 1)), { code: "CONFLICT" });
  const backup = [...storage.items.entries()].find(([key]) => key.startsWith(`${STORAGE_KEY}-backup-`));
  assert.equal(JSON.parse(backup[1]).issues.length, 2);
});
test("HTTP adapter uses authenticated API and idempotency key, not local fallback", async () => {
  const calls = [];
  const repo = createHttpRepository("https://api.example.test/api/v1/", async (url, init) => { calls.push({ url, init }); return Response.json({ snapshot: snapshot() }); });
  const cmd = command("issue.create", "new", newIssue());
  await repo.load(); await repo.execute(cmd); await repo.execute(cmd);
  assert.equal(calls[0].url, "https://api.example.test/api/v1/workspace");
  assert.equal(calls[1].init.credentials, "include");
  assert.equal(calls[1].init.headers["Idempotency-Key"], cmd.id);
  assert.equal(calls[2].init.body, calls[1].init.body);
});
test("ambiguous network and malformed response remain retryable; conflicts are explicit", async () => {
  await assert.rejects(createHttpRepository("/api", async () => { throw Error("offline"); }).load(), { code: "NETWORK" });
  await assert.rejects(createHttpRepository("/api", async () => Response.json({}, { status: 503 })).load(), { code: "NETWORK" });
  await assert.rejects(createHttpRepository("/api", async () => Response.json({ snapshot: {} })).load(), { code: "PROTOCOL" });
  await assert.rejects(createHttpRepository("/api", async () => Response.json({ error: { code: "CONFLICT", message: "Conflict" } }, { status: 409 })).load(), { code: "CONFLICT" });
});
