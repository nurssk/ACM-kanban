import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, CaretLeft, CaretRight, CheckCircle, Copy, DownloadSimple, MagnifyingGlass, Plus, PresentationChart, ProjectorScreenChart, Trash, X } from "@phosphor-icons/react";
import { makeSlide, newId, STATUS_IDS } from "../data/model.js";
import { countLabel, slideLabel, ticketLayout } from "./layout.js";
import "./presentations.css";

const statuses = { backlog: "Бэклог", planned: "К выполнению", progress: "В работе", review: "Проверка", done: "Готово" };
const draftKey = (id) => `club-os-deck-draft:${id}`;
export function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function readDraft(presentation) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(draftKey(presentation.id)));
    return cached?.deck?.id === presentation.id && Array.isArray(cached.deck.slides) ? cached : null;
  } catch { return null; }
}
function clearDraft(id) {
  try { sessionStorage.removeItem(draftKey(id)); } catch { /* The persisted snapshot is authoritative. */ }
}
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => part.startsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part.startsWith("`") ? <code key={index}>{part.slice(1, -1)}</code> : part);
}
function Markdown({ text }) {
  return <div className="deck-markdown">{text.split("\n").map((line, index) => {
    if (/^#{1,3} /.test(line)) return <h3 key={index}>{inline(line.replace(/^#{1,3} /, ""))}</h3>;
    if (/^[-*] /.test(line)) return <p className="deck-bullet" key={index}>• {inline(line.slice(2))}</p>;
    return <p key={index}>{inline(line) || <br />}</p>;
  })}</div>;
}
export function SlideCanvas({ slide, index, total, projects, issues, members, onOpenIssue, onCreateTask, onDeleteIssue, onShowDeleted, busy }) {
  const viewport = useRef(null), textBody = useRef(null);
  const [scale, setScale] = useState(1), [textScale, setTextScale] = useState(1), [page, setPage] = useState(0);
  const project = projects.find((item) => item.id === slide.projectId && !item.archivedAt);
  const layout = slide.kind === "tickets" ? ticketLayout(issues, slide) : null;
  const deletedCount = issues.filter((issue) => issue.projectId === slide.projectId && issue.archivedAt).length;
  const activePage = Math.min(page, (layout?.pageCount || 1) - 1);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1280));
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setPage(0); }, [slide.id, slide.projectId, JSON.stringify(slide.statuses), slide.assigneeId]);
  useEffect(() => {
    if (!textBody.current) return;
    setTextScale(Math.min(1, 400 / Math.max(400, textBody.current.scrollHeight)));
  }, [slide.title, slide.body, slide.kind]);
  return <div className="deck-viewport" ref={viewport} aria-label={`Слайд ${index + 1}: ${slide.title}`}>
    <section className={`deck-canvas deck-kind-${slide.kind}`} style={{ transform: `scale(${scale})` }}>
      <header className="deck-topline"><span>ACM @ NU</span><span>{slide.kind === "tickets" ? project?.name || "Проект недоступен" : slideLabel(slide.kind)}</span></header>
      {slide.kind === "tickets" ? <>
        <div className="deck-ticket-heading"><h2>{slide.title || "Задачи проекта"}</h2><span>{countLabel(layout.total, "задача", "задачи", "задач")} · {layout.density === "comfortable" ? "Обычный" : layout.density === "compact" ? "Компактный" : "Плотный"} масштаб</span></div>
        {!project ? <div className="deck-unavailable">Проект недоступен. Выберите действующий проект в свойствах слайда.</div> : <div className={`deck-ticket-board density-${layout.density}`} style={{ gridTemplateColumns: `repeat(${layout.groups.length}, minmax(0, 1fr))`, "--ticket-height": `${layout.cardHeight}px` }}>
          {layout.groups.map((group) => <div className="deck-ticket-column" key={group.status}>
            <div className={`deck-column-label deck-status-${group.status}`}><span>{statuses[group.status]}</span><small>{group.issues.length}</small></div>
            <div className="deck-ticket-stack">
              {group.issues.slice(activePage * layout.pageSize, (activePage + 1) * layout.pageSize).map((issue) => <div className="deck-ticket-card" key={issue.id}><button className="deck-ticket" onClick={() => onOpenIssue(issue)} title={`${issue.identifier}: ${issue.title}`}>
                <span className="deck-ticket-id">{issue.identifier}</span><strong>{issue.title}</strong>
                <span className="deck-ticket-detail">{members.find((item) => item.id === issue.assignee)?.name || "Без исполнителя"}{issue.due ? ` · ${new Date(`${issue.due}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}` : ""}</span>
              </button><button className="deck-ticket-delete" disabled={busy} aria-label={`Удалить ${issue.identifier}`} title="Удалить задачу" onClick={() => onDeleteIssue(issue)}><Trash size={16} /></button></div>)}
              {!group.issues.length && <span className="deck-no-tickets">Пока нет задач</span>}
            </div>
          </div>)}
        </div>}
        <div className="deck-board-actions">
          {project && <div className="deck-board-task-actions"><button disabled={busy} onClick={() => onCreateTask(slide.statuses.includes("planned") ? "planned" : slide.statuses[0], project.id)}><Plus size={18} /> Новая задача</button><button disabled={busy} onClick={() => onShowDeleted(project.id)}><Trash size={17} />Удалённые ({deletedCount})</button></div>}
          {layout.pageCount > 1 && <div className="deck-pagination"><button disabled={activePage === 0} onClick={() => setPage(activePage - 1)} aria-label="Предыдущая страница задач"><CaretLeft /></button><span>Страница задач {activePage + 1} / {layout.pageCount}</span><button disabled={activePage === layout.pageCount - 1} onClick={() => setPage(activePage + 1)} aria-label="Следующая страница задач"><CaretRight /></button></div>}
        </div>
      </> : <div className="deck-text-window"><div className="deck-text-body" ref={textBody} style={{ transform: `scale(${textScale})` }}><h2>{slide.title || "Без заголовка"}</h2><Markdown text={slide.body} /></div></div>}
      <footer className="deck-footer"><span>{slide.kind === "tickets" ? "Живые задачи · изменения сохраняются в проекте" : "ACM Student Chapter"}</span><span>{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span></footer>
    </section>
  </div>;
}

export function PresentationLibrary({ presentations, onOpen, onCreate, onDuplicate, onArchive, onRestore, busy }) {
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const visible = presentations.filter((deck) => Boolean(deck.archivedAt) === archived && deck.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <main className="content-shell list-shell presentations-library">
    <div className="simple-page-header"><div><h1>Презентации</h1><p>Один шаблон ACM. Заголовки, информация и живые задачи проектов.</p></div><button className="button primary" onClick={onCreate}><Plus size={17} /> Новая презентация</button></div>
    <div className="deck-library-tools"><label><MagnifyingGlass size={17} /><input aria-label="Поиск презентаций" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название презентации" /></label><button className="button secondary" onClick={() => setArchived(!archived)}>{archived ? "Активные презентации" : "Архив"}</button></div>
    <div className="presentation-list">{visible.map((deck) => <article key={deck.id} className="deck-library-row">
      <button className="presentation-card" onClick={() => onOpen(deck.id)}><span className="presentation-cover"><PresentationChart size={24} /></span><span className="presentation-card-main"><strong>{deck.title}</strong><small>{countLabel(deck.slides.length, "слайд", "слайда", "слайдов")} · {countLabel(new Set(deck.slides.filter((slide) => slide.kind === "tickets").map((slide) => slide.projectId)).size, "проект", "проекта", "проектов")} с задачами</small></span><time dateTime={deck.updatedAt}>{new Date(deck.updatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</time></button>
      <div className="deck-row-actions"><button className="icon-button" disabled={busy} onClick={() => onDuplicate(deck)} aria-label={`Дублировать ${deck.title}`} title="Дублировать"><Copy size={17} /></button>{archived ? <button className="button secondary" disabled={busy} onClick={() => onRestore(deck)}>Восстановить</button> : <button className="icon-button" disabled={busy} onClick={() => onArchive(deck)} aria-label={`В архив ${deck.title}`} title="В архив"><Trash size={17} /></button>}</div>
    </article>)}</div>
    {!visible.length && <div className="empty-state"><h2>{query ? "Ничего не найдено" : archived ? "Архив пуст" : "Пока нет презентаций"}</h2><p>{query ? "Попробуйте другое название." : "Создайте презентацию и добавьте слайды для встречи."}</p></div>}
  </main>;
}

export const PresentationEditor = forwardRef(function PresentationEditor({ presentation, projects, issues, members, onSave, onBack, onOpenIssue, onCreateTask, onDeleteIssue, onShowDeleted, busy, mode }, ref) {
  const initialDraft = useRef(readDraft(presentation));
  const [deck, setDeck] = useState(initialDraft.current?.deck || presentation);
  const [baseVersion, setBaseVersion] = useState(initialDraft.current?.baseVersion || presentation.version);
  const [dirty, setDirty] = useState(Boolean(initialDraft.current));
  const [saveState, setSaveState] = useState(initialDraft.current ? "draft" : "saved");
  const [selectedId, setSelectedId] = useState(deck.slides[0].id);
  const [presenting, setPresenting] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const draftRef = useRef(deck), dirtyRef = useRef(dirty), saving = useRef(null);
  const conflict = dirty && presentation.version !== baseVersion;
  const index = Math.max(0, deck.slides.findIndex((slide) => slide.id === selectedId));
  const slide = deck.slides[index];
  const update = (next) => { draftRef.current = next; dirtyRef.current = true; setDeck(next); setDirty(true); setSaveState("draft"); setConfirmRemove(false); };
  const changeSlide = (field, value) => update({ ...deck, slides: deck.slides.map((item) => item.id === slide.id ? { ...item, [field]: value } : item) });
  const save = async () => {
    if (!dirtyRef.current) return true;
    if (saving.current) return saving.current;
    if (conflict || busy) return false;
    setSaveState("saving");
    const candidate = draftRef.current;
    saving.current = onSave({ title: candidate.title, slides: candidate.slides }, baseVersion).then((saved) => {
      if (!saved) { setSaveState("error"); return false; }
      setBaseVersion(saved.version);
      if (draftRef.current === candidate) { draftRef.current = saved; dirtyRef.current = false; setDeck(saved); setDirty(false); setSaveState("saved"); clearDraft(presentation.id); }
      return true;
    }).finally(() => { saving.current = null; });
    return saving.current;
  };
  useImperativeHandle(ref, () => ({ save }));
  useEffect(() => {
    const sameContent = presentation.title === draftRef.current.title && JSON.stringify(presentation.slides) === JSON.stringify(draftRef.current.slides);
    if (!dirtyRef.current || sameContent) {
      setDeck(presentation); draftRef.current = presentation; setBaseVersion(presentation.version);
      if (sameContent) { dirtyRef.current = false; setDirty(false); setSaveState("saved"); clearDraft(presentation.id); }
    }
  }, [presentation]);
  useEffect(() => {
    if (!dirty) return;
    try { sessionStorage.setItem(draftKey(deck.id), JSON.stringify({ deck, baseVersion })); } catch { setSaveState("draft-error"); }
    if (busy || conflict || saveState === "error" || saveState === "draft-error") return;
    const timer = setTimeout(save, 700);
    return () => clearTimeout(timer);
  }, [deck, dirty, busy, conflict, saveState]);
  useEffect(() => {
    const onUnload = (event) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);
  useEffect(() => {
    if (!presenting) return;
    const handler = (event) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.closest(".sheet-backdrop,.modal-backdrop")) return;
      if (event.key === "Escape") setPresenting(false);
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const nextIndex = Math.max(0, Math.min(deck.slides.length - 1, index + (event.key === "ArrowRight" ? 1 : -1))); setSelectedId(deck.slides[nextIndex].id); }
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [presenting, index, deck.slides]);
  const add = (kind) => {
    const next = makeSlide(kind, projects.find((item) => !item.archivedAt)?.id);
    update({ ...deck, slides: [...deck.slides.slice(0, index + 1), next, ...deck.slides.slice(index + 1)] }); setSelectedId(next.id);
  };
  const move = (offset) => { const list = [...deck.slides]; [list[index], list[index + offset]] = [list[index + offset], list[index]]; update({ ...deck, slides: list }); };
  const preview = <SlideCanvas slide={slide} index={index} total={deck.slides.length} projects={projects} issues={issues} members={members} onOpenIssue={onOpenIssue} onCreateTask={onCreateTask} onDeleteIssue={onDeleteIssue} onShowDeleted={onShowDeleted} busy={busy} />;
  return <main className="deck-editor">
    <header className="deck-editor-header"><button className="icon-button" aria-label="Назад к презентациям" onClick={async () => { if (await save()) onBack(); }}><ArrowLeft size={19} /></button><div className="deck-heading"><input aria-label="Название презентации" value={deck.title} disabled={busy || Boolean(deck.archivedAt)} onChange={(event) => update({ ...deck, title: event.target.value })} maxLength={300} /><span role="status">{conflict ? "Есть новая версия на сервере" : saveState === "saved" ? (mode === "local" ? "Сохранено на этом устройстве" : "Сохранено на сервере") : saveState === "saving" ? "Сохранение…" : saveState === "error" ? "Не сохранено · повторите" : saveState === "draft-error" ? "Черновик только в памяти · скачайте копию" : "Есть изменения"}</span></div><button className="button secondary" disabled={busy || !dirty || conflict} onClick={save}>Сохранить</button><button className="button primary" onClick={async () => { if (await save()) setPresenting(true); }}><ProjectorScreenChart size={17} /> Показать</button></header>
    {conflict && <div className="deck-conflict" role="alert"><span>Эта презентация изменена в другой вкладке или другим участником. Ваш черновик сохранён отдельно.</span><button onClick={() => downloadJson(deck, "presentation-draft.json")}>Скачать черновик</button><button onClick={() => { setDeck(presentation); draftRef.current = presentation; dirtyRef.current = false; setDirty(false); setBaseVersion(presentation.version); setSaveState("saved"); clearDraft(deck.id); }}>Загрузить актуальную версию</button></div>}
    <div className="deck-editor-grid">
      <aside className="deck-outline"><div className="deck-section-title">Слайды <span>{deck.slides.length}</span></div><ol>{deck.slides.map((item, position) => <li key={item.id}><button className={item.id === slide.id ? "is-selected" : ""} onClick={() => { setSelectedId(item.id); setConfirmRemove(false); }} aria-label={`Слайд ${position + 1}: ${item.title}`}><span>{String(position + 1).padStart(2, "0")}</span><div><strong>{item.title || "Без заголовка"}</strong><small>{slideLabel(item.kind)}{item.kind === "tickets" ? ` · ${projects.find((p) => p.id === item.projectId)?.name || "Нет проекта"}` : ""}</small></div></button></li>)}</ol><fieldset disabled={busy || deck.slides.length >= 100 || Boolean(deck.archivedAt)} className="deck-add"><legend>Добавить слайд</legend>{["title", "text", "tickets"].map((kind) => <button key={kind} onClick={() => add(kind)} disabled={kind === "tickets" && !projects.length}><Plus size={15} />{slideLabel(kind)}</button>)}</fieldset></aside>
      <section className="deck-stage"><div className="deck-stage-top"><span>ACM · единый шаблон 16:9</span><span>{slideLabel(slide.kind)}</span></div>{preview}{slide.kind === "tickets" && <p className="deck-stage-hint">Нажмите на задачу, чтобы изменить её. Масштаб подстраивается под количество карточек; все задачи доступны по страницам.</p>}<label className="deck-notes-label">Заметки докладчика<textarea disabled={busy || Boolean(deck.archivedAt)} aria-label="Заметки докладчика" value={slide.notes} onChange={(event) => changeSlide("notes", event.target.value)} rows={3} placeholder="Видны только в редакторе и по кнопке «Заметки» во время показа" /></label></section>
      <aside className="deck-properties"><fieldset disabled={busy || Boolean(deck.archivedAt)}><div className="deck-section-title">Свойства слайда</div><label className="field-label">Заголовок<input aria-label="Заголовок слайда" maxLength={300} value={slide.title} onChange={(event) => changeSlide("title", event.target.value)} /></label><label className="field-label">Тип слайда<select value={slide.kind} onChange={(event) => update({ ...deck, slides: deck.slides.map((item) => item.id === slide.id ? { ...item, kind: event.target.value, projectId: event.target.value === "tickets" ? item.projectId || projects[0]?.id : null } : item) })}>{["title", "text", "tickets"].map((kind) => <option key={kind} value={kind}>{slideLabel(kind)}</option>)}</select></label>
      {slide.kind === "tickets" ? <><label className="field-label">Проект слайда<select aria-label="Проект слайда" value={slide.projectId || ""} onChange={(event) => changeSlide("projectId", event.target.value)}><option value="" disabled>Выберите проект</option>{projects.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="deck-filter-label">Статусы задач</div><div className="deck-status-filters">{STATUS_IDS.map((status) => <label key={status}><input type="checkbox" checked={slide.statuses.includes(status)} disabled={slide.statuses.length === 1 && slide.statuses.includes(status)} onChange={(event) => changeSlide("statuses", event.target.checked ? [...slide.statuses, status] : slide.statuses.filter((item) => item !== status))} />{statuses[status]}</label>)}</div><label className="field-label">Исполнитель<select value={slide.assigneeId || ""} onChange={(event) => changeSlide("assigneeId", event.target.value || null)}><option value="">Все участники</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><p className="deck-property-note">Один слайд — один проект. Задачи обновляются из общего хранилища.</p></> : <><label className="field-label">{slide.kind === "title" ? "Подзаголовок" : "Содержание · Markdown"}<textarea aria-label="Содержание слайда" rows={9} maxLength={20000} value={slide.body} onChange={(event) => changeSlide("body", event.target.value)} /></label><p className="deck-property-note">Поддерживаются абзацы, # заголовки, - списки, **жирный** и `код`. Текст вписывается в шаблон автоматически.</p></>}
      <div className="deck-slide-actions"><button className="button secondary" disabled={index === 0} onClick={() => move(-1)} aria-label="Переместить слайд вверх"><ArrowUp /></button><button className="button secondary" disabled={index === deck.slides.length - 1} onClick={() => move(1)} aria-label="Переместить слайд вниз"><ArrowDown /></button><button className="button secondary" disabled={deck.slides.length >= 100} onClick={() => { const copy = { ...structuredClone(slide), id: newId() }; update({ ...deck, slides: [...deck.slides.slice(0, index + 1), copy, ...deck.slides.slice(index + 1)] }); setSelectedId(copy.id); }} aria-label="Дублировать слайд"><Copy /></button><button className="button secondary" disabled={deck.slides.length === 1} onClick={() => setConfirmRemove(true)} aria-label="Удалить слайд"><Trash /></button></div>
      {confirmRemove && <div className="deck-delete-confirm"><p>Удалить этот слайд? Задачи проекта сохранятся.</p><button onClick={() => { const slides = deck.slides.filter((item) => item.id !== slide.id); update({ ...deck, slides }); setSelectedId(slides[Math.min(index, slides.length - 1)].id); }}>Удалить слайд</button><button onClick={() => setConfirmRemove(false)}>Отмена</button></div>}</fieldset><button className="deck-export" onClick={() => downloadJson(deck, "presentation.json")}><DownloadSimple size={16} /> Скачать презентацию JSON</button></aside>
    </div>
    {presenting && <div className="deck-present" role="dialog" aria-label="Показ презентации"><header><span>{deck.title}</span><button onClick={() => setPresenting(false)} aria-label="Закрыть показ"><X size={20} />Закрыть</button></header><div className="deck-present-stage">{preview}</div>{showNotes && <div className="deck-speaker-notes">{slide.notes || "Для этого слайда нет заметок."}</div>}<footer><button disabled={index === 0} onClick={() => setSelectedId(deck.slides[index - 1].id)} aria-label="Предыдущий слайд"><CaretLeft size={22} /></button><span>{index + 1} / {deck.slides.length}</span><button disabled={index === deck.slides.length - 1} onClick={() => setSelectedId(deck.slides[index + 1].id)} aria-label="Следующий слайд"><CaretRight size={22} /></button><button onClick={() => setShowNotes(!showNotes)}>Заметки</button></footer></div>}
  </main>;
});
