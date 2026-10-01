import React, { useEffect, useRef } from "react";
import { ArrowCounterClockwise, Trash, X } from "@phosphor-icons/react";

function IssueActionDialog({ title, busy, onClose, focusKey, children }) {
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => { panel.current?.focus(); }, [focusKey]);
  const keyboard = (event) => {
    // Do not pass Escape/arrows through to presentation navigation.
    event.stopPropagation();
    if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); }
    if (event.key !== "Tab") return;
    const controls = Array.from(panel.current.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]"));
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); panel.current.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
  };
  return <div className="modal-backdrop issue-action-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={panel} className="task-modal issue-action-dialog" role="dialog" aria-modal="true" aria-label={title} aria-busy={busy} tabIndex={-1} onKeyDown={keyboard}>
      <div className="modal-head"><h2>{title}</h2><button className="icon-button quiet" disabled={busy} aria-label="Закрыть окно" onClick={onClose}><X size={19} /></button></div>
      {children}
    </section>
  </div>;
}

export function DeleteIssueDialog({ issue, currentIssue, projectName, busy, onClose, onConfirm, onReview }) {
  const conflict = currentIssue?.version !== issue.version;
  return <IssueActionDialog title="Удалить задачу?" busy={busy} onClose={onClose}>
    <p className="issue-action-subject"><span>{issue.identifier}</span><strong>{issue.title}</strong></p>
    <p>Задача будет удалена из активных задач проекта «{projectName}» и всех презентаций, где она отображается.</p>
    <p>Задача и комментарии сохранятся в разделе «Удалённые» на слайде проекта. Оттуда её можно восстановить. Несохранённые изменения формы не сохранятся.</p>
    {conflict && <div className="deck-conflict" role="alert">Задача изменилась после открытия подтверждения. Проверьте актуальную версию перед удалением.{currentIssue && <button disabled={busy} onClick={() => onReview(currentIssue)}>Проверить актуальную задачу</button>}</div>}
    <div className="modal-actions"><button className="button secondary" disabled={busy} onClick={onClose}>Отмена</button><button className="button danger" disabled={busy || conflict || Boolean(currentIssue?.archivedAt)} onClick={() => onConfirm(issue)}><Trash size={17} />{busy ? "Удаление…" : "Удалить задачу"}</button></div>
  </IssueActionDialog>;
}

export function DeletedIssuesDialog({ project, issues, busy, onClose, onRestore }) {
  const deleted = issues.filter((issue) => issue.projectId === project.id && issue.archivedAt).sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  return <IssueActionDialog title="Удалённые задачи" busy={busy} onClose={onClose} focusKey={deleted.length}>
    <p>Проект «{project.name}». Здесь все удалённые задачи проекта, независимо от фильтров слайда.</p>
    <p>При восстановлении сохраняются номер, статус, исполнитель, дедлайн и комментарии. Задача появится на слайде, если подходит под его фильтры.</p>
    {deleted.length ? <ul className="deleted-issues-list">{deleted.map((issue) => <li key={issue.id}>
      <div><span>{issue.identifier}</span><strong>{issue.title}</strong><time dateTime={issue.archivedAt}>Удалена {new Date(issue.archivedAt).toLocaleString("ru-RU")}</time></div>
      <button className="button secondary" disabled={busy || Boolean(project.archivedAt)} aria-label={`Восстановить ${issue.identifier}`} onClick={() => onRestore(issue)}><ArrowCounterClockwise size={16} />Восстановить</button>
    </li>)}</ul> : <p className="deleted-issues-empty" role="status">Удалённых задач нет</p>}
    <div className="modal-actions"><button className="button secondary" disabled={busy} onClick={onClose}>Закрыть</button></div>
  </IssueActionDialog>;
}
