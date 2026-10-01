import React, { useEffect, useRef, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { Sidebar, Topbar, ProjectView, MyTasksView, InboxView, ProjectsDirectory, SettingsView, TaskModal, ProjectModal, PresentationModal, ProjectSettingsModal, MembersModal, IssueSheet, SearchModal, MemberContext, seeds } from "./components.jsx";
import { useWorkspace } from "./data/useWorkspace.js";
import { makeSlide, newId } from "./data/model.js";
import { downloadJson, PresentationEditor, PresentationLibrary } from "./presentations/Presentations.jsx";
import { DeleteIssueDialog, DeletedIssuesDialog } from "./presentations/IssueActions.jsx";

export default function App() {
  const data = useWorkspace(seeds);
  if (!data.snapshot) return <main className="content-shell"><h1>ACM @ NU</h1><p role="status">{data.loading ? "Загружаем рабочее пространство…" : data.error?.message}</p>{!data.loading && <div className="data-controls"><button className="button primary" onClick={data.refresh}>Повторить загрузку</button>{data.rawBackup && <button className="button secondary" onClick={() => downloadJson(data.rawBackup(), "acm-recovery.json")}>Скачать сохранённые данные</button>}</div>}</main>;
  return <MemberContext.Provider value={{ members: data.snapshot.members, currentUserId: data.snapshot.currentUserId, events: data.snapshot.events }}><Workspace data={data} /></MemberContext.Provider>;
}
function Workspace({ data }) {
  const { projects, issues, presentations, members } = data.snapshot;
  const deepLink = useRef(new URLSearchParams(window.location.search)).current;
  const [route, setRoute] = useState(deepLink.has("presentation") ? "presentations" : "projects");
  const [selectedProject, setSelectedProject] = useState(projects[0]?.id);
  const [taskModal, setTaskModal] = useState(null), [projectModal, setProjectModal] = useState(null);
  const [selectedIssueId, setSelectedIssueId] = useState(deepLink.get("issue"));
  const [deleteTarget, setDeleteTarget] = useState(null), [deletedProjectId, setDeletedProjectId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false), [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false), [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false), [membersModalOpen, setMembersModalOpen] = useState(false);
  const [presentationModalId, setPresentationModalId] = useState(null), [editingPresentationId, setEditingPresentationId] = useState(deepLink.get("presentation"));
  const editor = useRef(null);
  const project = projects.find((item) => item.id === selectedProject) || projects[0];
  const activeIssues = issues.filter((item) => !item.archivedAt);
  const selectedIssue = activeIssues.find((item) => item.id === selectedIssueId) || null;
  const currentDeleteTarget = issues.find((item) => item.id === deleteTarget?.id);
  const deletedProject = projects.find((item) => item.id === deletedProjectId);
  const activePresentation = presentations.find((item) => item.id === editingPresentationId);
  const announce = (text) => { setNotice(text); setTimeout(() => setNotice(""), 2800); };
  const openTask = (status = "planned", projectId = project?.id) => {
    if (!projectId) { setProjectModal(newId()); return; }
    setTaskModal({ id: newId(), status, projectId, lockedProject: route === "presentations" && Boolean(editingPresentationId) });
  };
  const navigate = async (next) => {
    if (next === "new-task") { openTask(); return; }
    if (editor.current && !(await editor.current.save())) return;
    if (next === "presentations") setEditingPresentationId(null);
    setRoute(next);
  };
  const addIssue = async (form) => {
    const payload = taskModal.lockedProject ? { ...form, projectId: taskModal.projectId } : form;
    if (await data.execute("issue.create", taskModal.id, payload)) { setTaskModal(null); announce("Задача создана"); }
  };
  const saveIssue = async (form) => {
    const fields = Object.fromEntries(["title", "description", "status", "priority", "assignee", "due", "labels"].map((field) => [field, form[field]]));
    if (await data.execute("issue.update", form.id, fields, form.version)) { setSelectedIssueId(null); announce("Задача сохранена"); }
  };
  const archiveIssue = async (issue) => {
    if (await data.execute("issue.archive", issue.id, {}, issue.version)) {
      setDeleteTarget(null); setSelectedIssueId(null);
      announce("Задача удалена. Её можно вернуть через «Удалённые».");
    }
  };
  const restoreIssue = async (issue) => {
    if (await data.execute("issue.restore", issue.id, {}, issue.version)) announce("Задача восстановлена в проекте");
  };
  useEffect(() => {
    // Covers a confirmed retry and deletion from another tab/client.
    if (deleteTarget && currentDeleteTarget?.archivedAt) { setDeleteTarget(null); setSelectedIssueId(null); }
  }, [deleteTarget, currentDeleteTarget]);
  const addComment = async (issueId, text, commentId) => {
    const issue = issues.find((item) => item.id === issueId);
    const next = await data.execute("issue.comment", issueId, { id: commentId, text }, issue.version);
    return next?.issues.find((item) => item.id === issueId) || null;
  };
  const addProject = async (form) => {
    const base = (form.name.match(/[A-Za-zА-Яа-я0-9]+/g) || ["PRJ"]).map((part) => part[0]).join("").slice(0, 5).toUpperCase();
    let code = base, suffix = 1;
    while (projects.some((item) => item.code === code)) code = `${base}${++suffix}`;
    const result = await data.execute("project.create", projectModal, { ...form, code, accent: "blue" });
    if (result) { setSelectedProject(projectModal); setProjectModal(null); setRoute("projects"); announce("Проект создан"); }
  };
  const saveProject = async (updated) => {
    const fields = Object.fromEntries(["name", "summary", "lead", "members", "target"].map((field) => [field, updated[field]]));
    if (await data.execute("project.update", updated.id, fields, updated.version)) { setProjectSettingsOpen(false); announce("Проект сохранён"); }
  };
  const saveMembers = async (ids) => { if (await data.execute("project.update", project.id, { members: ids }, project.version)) { setMembersModalOpen(false); announce("Участники обновлены"); } };
  const createPresentation = async (form) => {
    const title = { ...makeSlide("title"), title: form.title.trim(), id: `${presentationModalId}-title` };
    const text = { ...makeSlide("text"), title: "План встречи", id: `${presentationModalId}-text` };
    const tickets = { ...makeSlide("tickets", form.projectId), id: `${presentationModalId}-tickets` };
    const result = await data.execute("presentation.create", presentationModalId, { title: form.title, slides: form.projectId ? [title, text, tickets] : [title, text] });
    if (result) { setEditingPresentationId(presentationModalId); setPresentationModalId(null); announce("Презентация создана"); }
  };
  const savePresentation = async (fields, version) => {
    const result = await data.execute("presentation.update", activePresentation.id, fields, version);
    return result?.presentations.find((item) => item.id === activePresentation.id) || null;
  };
  const retryPending = async () => {
    const command = data.pendingCommand;
    const next = await data.retry();
    if (!next || !command) return;
    if (command.type.startsWith("issue.")) { setTaskModal(null); setSelectedIssueId(null); }
    if (command.type.startsWith("project.")) { setProjectModal(null); setProjectSettingsOpen(false); setMembersModalOpen(false); }
    if (command.type === "presentation.create") { setPresentationModalId(null); setRoute("presentations"); setEditingPresentationId(command.entityId); }
    announce("Изменение подтверждено");
  };
  useEffect(() => {
    const shortcut = (event) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.isContentEditable || document.querySelector('[role="dialog"],.sheet-backdrop')) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (!event.metaKey && !event.ctrlKey && event.key.toLowerCase() === "c") { event.preventDefault(); openTask(); }
    };
    window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut);
  }, [project?.id, route, editingPresentationId]);
  const renderRoute = () => {
    if (route === "presentations") return activePresentation
      ? <PresentationEditor ref={editor} key={activePresentation.id} presentation={activePresentation} projects={projects} issues={issues} members={members} onSave={savePresentation} onBack={() => setEditingPresentationId(null)} onOpenIssue={(issue) => setSelectedIssueId(issue.id)} onCreateTask={openTask} onDeleteIssue={setDeleteTarget} onShowDeleted={setDeletedProjectId} busy={data.busy} mode={data.mode} />
      : <PresentationLibrary presentations={presentations} onOpen={setEditingPresentationId} onCreate={() => setPresentationModalId(newId())} busy={data.busy} onDuplicate={async (deck) => { const id = newId(); const next = await data.execute("presentation.create", id, { title: `Копия — ${deck.title}`.slice(0, 300), slides: deck.slides.map((slide) => ({ ...slide, id: newId() })) }); if (next) setEditingPresentationId(id); }} onArchive={async (deck) => { if (await data.execute("presentation.archive", deck.id, {}, deck.version)) announce("Презентация перемещена в архив"); }} onRestore={async (deck) => { if (await data.execute("presentation.restore", deck.id, {}, deck.version)) announce("Презентация восстановлена"); }} />;
    if (route === "settings") return <SettingsView data={data} />;
    if (route === "my-tasks") return <MyTasksView issues={issues.filter((item) => !item.archivedAt)} projects={projects} onOpenIssue={(issue) => setSelectedIssueId(issue.id)} onCreateTask={openTask} />;
    if (route === "inbox") return <InboxView issues={issues.filter((item) => !item.archivedAt)} projects={projects} onOpenIssue={(issue) => setSelectedIssueId(issue.id)} onCreateTask={openTask} />;
    if (route === "projects-directory" || !project) return <ProjectsDirectory projects={projects} issues={activeIssues} onSelect={(id) => { setSelectedProject(id); setRoute("projects"); }} onCreateProject={() => setProjectModal(newId())} />;
    return <ProjectView project={project} issues={issues.filter((item) => item.projectId === project.id && !item.archivedAt)} onOpenIssue={(issue) => setSelectedIssueId(issue.id)} onMoveIssue={async (id, status) => { const item = issues.find((issue) => issue.id === id); await data.execute("issue.update", id, { status }, item.version); }} onCreateTask={openTask} onEditProject={() => setProjectSettingsOpen(true)} onEditMembers={() => setMembersModalOpen(true)} />;
  };
  return <div className="app-frame">
    <Sidebar route={route === "projects-directory" ? "projects" : route} setRoute={navigate} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onCreateProject={() => setProjectModal(newId())} collapsed={collapsed} setCollapsed={setCollapsed} workspaceMenuOpen={workspaceMenuOpen} onToggleWorkspaceMenu={() => setWorkspaceMenuOpen(!workspaceMenuOpen)} profileMenuOpen={profileMenuOpen} onToggleProfileMenu={() => setProfileMenuOpen(!profileMenuOpen)} />
    <div className="app-main"><Topbar route={route === "projects-directory" ? "projects" : route} onSearch={() => setSearchOpen(true)} onCreateTask={() => openTask()} notificationsOpen={notificationsOpen} onToggleNotifications={() => setNotificationsOpen(!notificationsOpen)} onClearNotifications={() => setNotificationsOpen(false)} />{data.error && <div className="data-banner" role="alert"><span>{data.error.message}</span>{data.pendingCommand && <button onClick={retryPending} disabled={data.busy}>Повторить отправку</button>}<button onClick={data.refresh} disabled={data.busy}>Обновить данные</button><button onClick={() => downloadJson(data.snapshot, "acm-backup.json")}>Скачать копию</button></div>}{renderRoute()}</div>
    {notice && <div className="toast" role="status"><CheckCircle size={18} />{notice}</div>}
    <div inert={data.busy ? "" : undefined} className={data.busy ? "data-saving" : ""}>
      <TaskModal isOpen={Boolean(taskModal)} onClose={() => !data.busy && setTaskModal(null)} onSave={addIssue} projects={projects} initialStatus={taskModal?.status} initialProject={taskModal?.projectId} lockedProject={taskModal?.lockedProject} busy={data.busy} />
      <ProjectModal isOpen={Boolean(projectModal)} onClose={() => !data.busy && setProjectModal(null)} onSave={addProject} />
      <PresentationModal isOpen={Boolean(presentationModalId)} onClose={() => !data.busy && setPresentationModalId(null)} onSave={createPresentation} projects={projects} initialProject={project?.id} />
      {project && <><ProjectSettingsModal project={project} isOpen={projectSettingsOpen} onClose={() => setProjectSettingsOpen(false)} onSave={saveProject} /><MembersModal project={project} isOpen={membersModalOpen} onClose={() => setMembersModalOpen(false)} onSave={saveMembers} /></>}
      <IssueSheet issue={selectedIssue} onClose={() => !data.busy && setSelectedIssueId(null)} onSave={saveIssue} onAddComment={addComment} onDelete={route === "presentations" && activePresentation ? setDeleteTarget : undefined} busy={data.busy} />
    </div>
    {selectedIssueId && !selectedIssue && <div className="data-banner" role="alert">Задача по ссылке недоступна или отсутствует.<button onClick={() => setSelectedIssueId(null)}>Закрыть</button></div>}
    <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} issues={activeIssues} onOpenIssue={(issue) => setSelectedIssueId(issue.id)} />
    {deleteTarget && <DeleteIssueDialog issue={deleteTarget} currentIssue={currentDeleteTarget} projectName={projects.find((item) => item.id === deleteTarget.projectId)?.name || "Проект недоступен"} busy={data.busy} onClose={() => setDeleteTarget(null)} onConfirm={archiveIssue} onReview={setDeleteTarget} />}
    {deletedProject && <DeletedIssuesDialog project={deletedProject} issues={issues} busy={data.busy} onClose={() => setDeletedProjectId(null)} onRestore={restoreIssue} />}
  </div>;
}
