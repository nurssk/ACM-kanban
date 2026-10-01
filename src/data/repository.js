import { applyCommand, DataError, migrateWorkspace, validateSnapshot } from "./model.js";

export const STORAGE_KEY = "club-os-workspace-v2";
const decode = (raw) => {
  try { return JSON.parse(raw); } catch { throw new DataError("Не удалось прочитать сохранённые данные. Они не были перезаписаны. Скачайте копию для восстановления.", "CORRUPT"); }
};
export function createLocalRepository(storage, seeds, locks = globalThis.navigator?.locks) {
  let lastRevision = null;
  const read = () => {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) return validateSnapshot(decode(raw));
    const legacy = (key, fallback) => { const value = storage.getItem(key); return value === null ? fallback : decode(value); };
    const presentations = legacy("club-os-presentations", seeds.presentations);
    const oldSlides = storage.getItem("club-os-slides");
    const initial = migrateWorkspace({ ...seeds, projects: legacy("club-os-projects", seeds.projects), issues: legacy("club-os-issues", seeds.issues), presentations: oldSlides && storage.getItem("club-os-presentations") === null ? presentations.map((deck, index) => index === 0 ? { ...deck, slides: decode(oldSlides) } : deck) : presentations });
    storage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  };
  const locked = (action) => locks ? locks.request(STORAGE_KEY, action) : Promise.resolve().then(action);
  return {
    mode: "local",
    async load() { const state = read(); lastRevision = state.revision; return state; },
    async execute(command) {
      return locked(() => {
        const latest = read();
        if (latest.receipts.includes(command.id)) { lastRevision = latest.revision; return latest; }
        if (lastRevision !== latest.revision) throw new DataError("Данные изменились в другой вкладке. Обновите их перед сохранением; ваш черновик сохранён в редакторе.", "CONFLICT");
        const next = applyCommand(latest, command);
        // A single write commits the records, history and command receipt together.
        // No React success state is emitted if storage is full or blocked.
        try { storage.setItem(STORAGE_KEY, JSON.stringify(next)); }
        catch { throw new DataError("Не удалось сохранить: хранилище заполнено или недоступно. Скачайте резервную копию.", "STORAGE"); }
        lastRevision = next.revision;
        return next;
      });
    },
    async restore(candidate) {
      validateSnapshot(candidate);
      return locked(() => {
        const current = read();
        storage.setItem(`${STORAGE_KEY}-backup-${Date.now()}`, JSON.stringify(current));
        const next = { ...candidate, revision: current.revision + 1 };
        // Restoring content must still invalidate drafts open in another tab.
        for (const collection of ["projects", "issues", "presentations"]) {
          next[collection] = candidate[collection].map((item) => {
            const prior = current[collection].find((entry) => entry.id === item.id);
            return prior ? { ...item, version: Math.max(item.version, prior.version) + 1, updatedAt: new Date().toISOString() } : item;
          });
        }
        validateSnapshot(next);
        storage.setItem(STORAGE_KEY, JSON.stringify(next));
        lastRevision = next.revision;
        return next;
      });
    },
    rawBackup() {
      return { exportedAt: new Date().toISOString(), current: storage.getItem(STORAGE_KEY), legacy: Object.fromEntries(["club-os-projects", "club-os-issues", "club-os-presentations", "club-os-slides"].map((key) => [key, storage.getItem(key)])) };
    },
  };
}

export function createHttpRepository(baseUrl, fetcher = globalThis.fetch) {
  const base = baseUrl.replace(/\/$/, "");
  const request = async (path, init = {}) => {
    let response;
    try {
      response = await fetcher(`${base}${path}`, { credentials: "include", ...init, signal: AbortSignal.timeout(15000), headers: { Accept: "application/json", ...init.headers } });
    } catch { throw new DataError("Сервер недоступен. Изменения не подтверждены; повторите сохранение после подключения.", "NETWORK"); }
    let body;
    try { body = await response.json(); } catch { throw new DataError("Сервер вернул некорректный ответ.", "PROTOCOL"); }
    if (!response.ok) throw new DataError(body.error?.message || "Не удалось сохранить данные.", response.status >= 500 ? "NETWORK" : body.error?.code || String(response.status));
    try { return validateSnapshot(body.snapshot); }
    catch { throw new DataError("Ответ сервера не соответствует контракту. Повторите отправку с тем же ключом.", "PROTOCOL"); }
  };
  return {
    mode: "api",
    load: () => request("/workspace"),
    execute: (command) => request("/commands", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": command.id }, body: JSON.stringify(command) }),
  };
}
