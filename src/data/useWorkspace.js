import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataError, newId } from "./model.js";
import { createHttpRepository, createLocalRepository, STORAGE_KEY } from "./repository.js";

export function useWorkspace(seeds) {
  const repository = useMemo(() => import.meta.env.VITE_DATA_MODE === "api"
    ? createHttpRepository(import.meta.env.VITE_API_BASE_URL || "/api/v1")
    : createLocalRepository(window.localStorage, seeds), []);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const running = useRef(false);
  const pending = useRef(null);
  const journalKey = `club-os-pending:${repository.mode}:${import.meta.env.VITE_API_BASE_URL || "/api/v1"}`;
  const snapshotRef = useRef(null);
  const accept = useCallback((next) => {
    // A read started before a mutation must not replace its newer result.
    if (snapshotRef.current && next.revision < snapshotRef.current.revision) return;
    snapshotRef.current = next; setSnapshot(next);
  }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(journalKey));
      if (saved?.command?.id && saved.intent) {
        pending.current = saved;
        setError(new DataError("Есть неподтверждённое изменение. Повторите отправку, чтобы проверить результат без дубликатов.", "PENDING"));
      }
    } catch { setError(new DataError("Не удалось прочитать журнал отправки. Сохранение на сервер временно недоступно.", "STORAGE")); }
  }, [journalKey]);
  const refresh = useCallback(async () => {
    if (running.current) return false;
    try { accept(await repository.load()); if (!pending.current) setError(null); return true; }
    catch (err) { setError(err); return false; }
    finally { setLoading(false); }
  }, [repository, accept]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const onStorage = (event) => { if (event.key === STORAGE_KEY && !running.current) refresh(); };
    window.addEventListener("storage", onStorage);
    const onFocus = () => { if (repository.mode === "api") refresh(); };
    window.addEventListener("focus", onFocus);
    const interval = repository.mode === "api" ? window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 15000) : null;
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("focus", onFocus); if (interval) clearInterval(interval); };
  }, [refresh, repository]);
  const execute = useCallback(async (type, entityId, data, expectedVersion) => {
    if (running.current) return null;
    const intent = JSON.stringify({ type, entityId, data, expectedVersion });
    // Retain the exact idempotency key after an ambiguous network failure.
    if (pending.current && pending.current.intent !== intent) {
      setError(new Error("Сначала повторите неподтверждённое сохранение. Это защитит от дублирования изменений."));
      return null;
    }
    const command = pending.current?.command || { id: newId(), type, entityId, data, expectedVersion, actorId: snapshotRef.current.currentUserId };
    if (command.actorId !== snapshotRef.current.currentUserId) {
      setError(new DataError("Неподтверждённое изменение принадлежит другому участнику. Войдите под прежним аккаунтом.", "PENDING")); return null;
    }
    const entry = { intent, command };
    // Journal before sending: a reload or lost HTTP response keeps the same command ID.
    if (repository.mode === "api") {
      try { sessionStorage.setItem(journalKey, JSON.stringify(entry)); }
      catch { setError(new DataError("Нельзя сохранить журнал отправки. Разрешите хранилище браузера и повторите.", "STORAGE")); return null; }
    }
    pending.current = entry;
    running.current = true; setBusy(true); setError(null);
    try {
      const next = await repository.execute(command);
      accept(next); pending.current = null;
      try { sessionStorage.removeItem(journalKey); } catch { /* A repeated command is idempotent. */ }
      return next;
    } catch (err) {
      if (!["NETWORK", "PROTOCOL"].includes(err.code)) {
        pending.current = null;
        try { sessionStorage.removeItem(journalKey); } catch { /* Safe to replay the same command. */ }
      }
      setError(err); return null;
    } finally { running.current = false; setBusy(false); }
  }, [repository, accept, journalKey]);
  const retry = useCallback(async () => {
    if (!pending.current) return refresh();
    const { type, entityId, data, expectedVersion } = pending.current.command;
    return execute(type, entityId, data, expectedVersion);
  }, [execute, refresh]);
  const restore = useCallback(async (candidate) => {
    if (running.current || pending.current) return false;
    try { accept(await repository.restore(candidate)); setError(null); return true; }
    catch (err) { setError(err); return false; }
  }, [repository, accept]);
  return { snapshot, loading, busy, error, mode: repository.mode, execute, refresh, retry, pendingCommand: pending.current?.command, restore, rawBackup: repository.rawBackup, clearError: () => setError(null) };
}
