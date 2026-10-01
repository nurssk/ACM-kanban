import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Bell,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckCircle,
  CheckSquare,
  Circle,
  ClipboardText,
  Clock,
  Command,
  DotsThree,
  DownloadSimple,
  Eye,
  FileText,
  Flag,
  FunnelSimple,
  Kanban,
  Layout,
  Lightning,
  ListBullets,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  PresentationChart,
  ProjectorScreenChart,
  SidebarSimple,
  SquaresFour,
  Stack,
  Trash,
  UserCircle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { downloadJson } from "./presentations/Presentations.jsx";
import { validateSnapshot } from "./data/model.js";

const WORKSPACE = "ACM @ NU";
const CURRENT_USER = "nursultan";

const seedMembers = [
  { id: "nursultan", name: "Нурсултан", initials: "НС", tone: "blue" },
  { id: "aida", name: "Аида", initials: "АИ", tone: "violet" },
  { id: "daniyar", name: "Данияр", initials: "ДН", tone: "orange" },
  { id: "madina", name: "Мадина", initials: "МД", tone: "green" },
];

const statusMeta = {
  backlog: { label: "Бэклог", tone: "slate", icon: Circle },
  planned: { label: "К выполнению", tone: "blue", icon: Circle },
  progress: { label: "В работе", tone: "amber", icon: Clock },
  review: { label: "Проверка", tone: "violet", icon: Eye },
  done: { label: "Готово", tone: "green", icon: CheckCircle },
};

const priorityMeta = {
  high: { label: "Высокий", tone: "red" },
  medium: { label: "Обычный", tone: "amber" },
  low: { label: "Низкий", tone: "slate" },
};

const seedProjects = [
  {
    id: "club-site",
    name: "Сайт клуба",
    code: "WEB",
    summary: "Запуск сайта для участников и партнёров.",
    lead: "aida",
    target: "30 сен",
    accent: "blue",
  },
  {
    id: "autumn-event",
    name: "Осенняя встреча",
    code: "EVENT",
    summary: "Подготовка программы и регистрации на встречу.",
    lead: "daniyar",
    target: "12 окт",
    accent: "violet",
  },
  {
    id: "mentors",
    name: "Программа менторов",
    code: "MENTOR",
    summary: "Сбор заявок и онбординг новых менторов.",
    lead: "madina",
    target: "18 окт",
    accent: "cyan",
  },
];

const seedIssues = [
  {
    id: "WEB-24",
    projectId: "club-site",
    title: "Собрать финальную структуру главной",
    description:
      "Согласовать блоки: о клубе, события, менторы и форма вступления.",
    status: "progress",
    assignee: "aida",
    priority: "high",
    due: "24 сен",
    labels: ["Дизайн"],
    comments: [
      {
        id: 1,
        author: "nursultan",
        text: "Нужно показать черновик в четверг.",
      },
    ],
  },
  {
    id: "WEB-25",
    projectId: "club-site",
    title: "Подготовить текст о программе",
    description: "Коротко объяснить формат участия для новой аудитории.",
    status: "planned",
    assignee: "nursultan",
    priority: "medium",
    due: "25 сен",
    labels: ["Контент"],
    comments: [],
  },
  {
    id: "WEB-26",
    projectId: "club-site",
    title: "Проверить форму регистрации",
    description: "Пройти путь с телефона и проверить письмо-подтверждение.",
    status: "review",
    assignee: "madina",
    priority: "medium",
    due: "26 сен",
    labels: ["QA"],
    comments: [],
  },
  {
    id: "WEB-27",
    projectId: "club-site",
    title: "Согласовать обложку события",
    description: "Утвердить одну обложку для сайта и анонса.",
    status: "done",
    assignee: "aida",
    priority: "low",
    due: "22 сен",
    labels: ["Дизайн"],
    comments: [],
  },
  {
    id: "EVENT-11",
    projectId: "autumn-event",
    title: "Подтвердить площадку",
    description: "Получить договор и финальный тайминг доступа.",
    status: "progress",
    assignee: "daniyar",
    priority: "high",
    due: "23 сен",
    labels: ["Операции"],
    comments: [],
  },
  {
    id: "EVENT-12",
    projectId: "autumn-event",
    title: "Собрать вопросы для Q&A",
    description: "Открыть форму и подготовить модерацию.",
    status: "backlog",
    assignee: "nursultan",
    priority: "low",
    due: "28 сен",
    labels: ["Программа"],
    comments: [],
  },
  {
    id: "MENTOR-8",
    projectId: "mentors",
    title: "Составить письмо менторам",
    description: "Объяснить новый формат и запросить слоты.",
    status: "planned",
    assignee: "madina",
    priority: "medium",
    due: "27 сен",
    labels: ["Коммуникации"],
    comments: [],
  },
];

const seedSlides = [
  {
    id: "slide-1",
    kind: "title",
    title: "Статус сайта клуба",
    body: "Встреча рабочей группы\n24 сентября",
  },
  {
    id: "slide-2",
    kind: "text",
    title: "Что уже готово",
    body: "- Согласовали цель первого релиза\n- Собрали основные блоки главной\n- Открыли тестовый контур",
  },
  {
    id: "slide-3",
    kind: "tickets",
    title: "Открытые задачи",
    projectId: "club-site",
    body: "",
  },
  {
    id: "slide-4",
    kind: "text",
    title: "Решение на сегодня",
    body: "Утвердить структуру главной и владельцев оставшихся задач.",
  },
];

function createPresentationSlides(presentationId, title, projectName, projectId) {
  return [
    {
      id: `${presentationId}-slide-1`,
      kind: "title",
      title,
      body: `Рабочая встреча\n${projectName}`,
    },
    {
      id: `${presentationId}-slide-2`,
      kind: "text",
      title: "Что обсудим",
      body: "- Цель встречи\n- Текущий прогресс\n- Следующие решения",
    },
    {
      id: `${presentationId}-slide-3`,
      kind: "tickets",
      title: "Открытые задачи",
      projectId,
      body: "",
    },
  ];
}

const seedPresentations = [
  {
    id: "club-site-status",
    title: "Статус сайта клуба",
    projectId: "club-site",
    owner: "aida",
    updatedAt: "Сегодня, 10:42",
    slides: seedSlides,
  },
  {
    id: "autumn-event-brief",
    title: "Осенняя встреча — бриф",
    projectId: "autumn-event",
    owner: "daniyar",
    updatedAt: "Вчера, 17:20",
    slides: createPresentationSlides(
      "autumn-event-brief",
      "Осенняя встреча",
      "Осенняя встреча",
      "autumn-event",
    ),
  },
  {
    id: "mentors-kickoff",
    title: "Старт программы менторов",
    projectId: "mentors",
    owner: "madina",
    updatedAt: "26 сен, 12:08",
    slides: createPresentationSlides(
      "mentors-kickoff",
      "Старт программы менторов",
      "Программа менторов",
      "mentors",
    ),
  },
];

function taskWord(count) {
  const remainder = count % 10;
  const hundreds = count % 100;
  if (hundreds >= 11 && hundreds <= 14) return "задач";
  if (remainder === 1) return "задача";
  if (remainder >= 2 && remainder <= 4) return "задачи";
  return "задач";
}

const monthNumbers = {
  янв: "01",
  фев: "02",
  мар: "03",
  апр: "04",
  май: "05",
  июн: "06",
  июл: "07",
  авг: "08",
  сен: "09",
  окт: "10",
  ноя: "11",
  дек: "12",
};
const shortMonths = Object.keys(monthNumbers);

function toDateInput(value, fallback = "") {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})\s+([а-я]{3})$/i);
  if (!match) return fallback;
  const month = monthNumbers[match[2].toLowerCase()];
  return month ? `2026-${month}-${match[1].padStart(2, "0")}` : fallback;
}

function formatDate(value) {
  const input = toDateInput(value);
  if (!input) return value || "Без даты";
  const [, month, day] = input.split("-");
  return `${Number(day)} ${shortMonths[Number(month) - 1]}`;
}

export const MemberContext = createContext({ members: seedMembers, currentUserId: CURRENT_USER });

function Avatar({ memberId, size = "md" }) {
  const { members: team, currentUserId } = useContext(MemberContext);
  const member = team.find((item) => item.id === memberId) ?? { name: "Без исполнителя", initials: "—", tone: "slate" };
  return (
    <span
      className={`avatar avatar-${member.tone} avatar-${size}`}
      title={member.name}
    >
      {member.initials}
    </span>
  );
}

function StatusBadge({ status, compact = false }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <span
      className={`status status-${meta.tone} ${compact ? "status-compact" : ""}`}
    >
      <Icon
        size={compact ? 12 : 14}
        weight={status === "done" ? "fill" : "regular"}
      />
      {!compact && meta.label}
    </span>
  );
}

function AcmMark({ compact = false }) {
  return (
    <span
      className={`acm-mark ${compact ? "acm-mark-compact" : ""}`}
      aria-label={compact ? "ACM at NU" : undefined}
    >
      <span className="acm-diamond" aria-hidden="true">
        <span className="acm-core">
          <strong>acm</strong>
          <small>chapter</small>
        </span>
      </span>
      {!compact && (
        <span className="acm-wordmark">
          <strong>ACM @ NU</strong>
          <small>Student Chapter</small>
        </span>
      )}
    </span>
  );
}

function Sidebar({
  route,
  setRoute,
  projects,
  selectedProject,
  setSelectedProject,
  onCreateProject,
  collapsed,
  setCollapsed,
  workspaceMenuOpen,
  onToggleWorkspaceMenu,
  profileMenuOpen,
  onToggleProfileMenu,
}) {
  const { currentUserId, members } = useContext(MemberContext);
  const currentMember = members.find((member) => member.id === currentUserId);
  const links = [
    { id: "inbox", label: "Входящие", icon: Lightning },
    { id: "my-tasks", label: "Мои задачи", icon: CheckSquare },
    { id: "projects", label: "Проекты", icon: SquaresFour },
    { id: "presentations", label: "Презентации", icon: PresentationChart },
  ];

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-top">
        <button
          className="workspace-switcher"
          aria-label="Выбрать пространство"
          onClick={onToggleWorkspaceMenu}
        >
          <AcmMark compact={collapsed} />
          {!collapsed && (
            <CaretDown size={14} />
          )}
        </button>
        {workspaceMenuOpen && !collapsed && (
          <div className="sidebar-popover workspace-popover">
            <strong>{WORKSPACE}</strong>
            <span>Локальное пространство задач</span>
            <button onClick={() => setRoute("settings")}>Настройки пространства</button>
          </div>
        )}
        <button
          className="icon-button quiet"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Свернуть меню"
        >
          <SidebarSimple size={18} />
        </button>
      </div>

      <button className="create-button" aria-label="Создать задачу" onClick={() => setRoute("new-task")}>
        <Plus size={17} weight="bold" />
        {!collapsed && <span className="create-button-label">Создать задачу</span>}
        {!collapsed && <span className="shortcut">C</span>}
      </button>

      <nav className="primary-nav" aria-label="Главное меню">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.id}
              className={`nav-link ${route === link.id ? "nav-link-active" : ""}`}
              onClick={() => setRoute(link.id === "projects" ? "projects-directory" : link.id)}
              title={link.label}
              aria-label={link.label}
            >
              <Icon size={18} weight={route === link.id ? "fill" : "regular"} />
              {!collapsed && <span>{link.label}</span>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="sidebar-projects">
          <div className="sidebar-label">
            <span>Проекты</span>
            <button
              className="icon-button micro"
              onClick={onCreateProject}
              aria-label="Создать проект"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="project-nav-list">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`project-nav-link ${selectedProject === project.id && route === "projects" ? "project-nav-active" : ""}`}
                onClick={() => {
                  setSelectedProject(project.id);
                  setRoute("projects");
                }}
              >
                <span className={`project-dot project-dot-${project.accent}`} />
                <span>{project.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-bottom">
        <button
          className="nav-link"
          onClick={() => setRoute("settings")}
          aria-label="Настройки"
          title={collapsed ? "Настройки" : undefined}
        >
          <Stack size={18} />
          {!collapsed && <span>Настройки</span>}
        </button>
        <button
          className="profile-button"
          aria-label={`Профиль: ${currentMember?.name || "Участник"}`}
          onClick={onToggleProfileMenu}
        >
          <Avatar memberId={currentUserId} size="sm" />
          {!collapsed && <span>{currentMember?.name}</span>}
          {!collapsed && <CaretDown size={13} />}
        </button>
        {profileMenuOpen && !collapsed && (
          <div className="sidebar-popover profile-popover">
            <strong>{currentMember?.name}</strong>
            <button onClick={() => setRoute("my-tasks")}>Мои задачи</button>
            <button onClick={() => setRoute("settings")}>Настройки</button>
          </div>
        )}
      </div>
    </aside>
  );
}

function Topbar({ route, onSearch, onCreateTask, notificationsOpen, onToggleNotifications, onClearNotifications }) {
  const { events = [] } = useContext(MemberContext);
  const labels = {
    inbox: "Входящие",
    "my-tasks": "Мои задачи",
    projects: "Проекты",
    presentations: "Презентации",
    settings: "Настройки",
  };
  return (
    <header className="topbar">
      <div className="crumb">
        <span>{labels[route] ?? "Новая задача"}</span>
      </div>
      <div className="top-actions">
        <button className="search-trigger" onClick={onSearch}>
          <MagnifyingGlass size={17} />
          <span>Поиск</span>
          <kbd>⌘ K</kbd>
        </button>
        <button
          className="icon-button quiet notification-button"
          aria-label="Уведомления"
          onClick={onToggleNotifications}
        >
          <Bell size={19} />
        </button>
        {notificationsOpen && (
          <div className="notification-popover">
            <strong>Последние изменения</strong>
            {events.slice(-3).reverse().map((event) => <p key={event.id}>{eventLabel(event.type)} · {new Date(event.occurredAt).toLocaleString("ru-RU")}</p>)}
            {!events.length && <p>Изменений пока нет. Telegram ещё не подключён.</p>}
            <button className="text-button" onClick={onClearNotifications}>
              Закрыть
            </button>
          </div>
        )}
        <button className="top-create" onClick={onCreateTask}>
          <Plus size={16} weight="bold" />
          Создать
        </button>
      </div>
    </header>
  );
}

function ProjectHeader({ project, issues, onCreateTask, onEditMembers }) {
  const done = issues.filter((issue) => issue.status === "done").length;
  const progress = issues.length ? Math.round((done / issues.length) * 100) : 0;
  return (
    <div className="project-header">
      <div className="project-heading">
        <div className={`project-icon project-icon-${project.accent}`}>
          {project.code.slice(0, 1)}
        </div>
        <div>
          <div className="breadcrumb-line">
            <span>Проекты</span>
            <CaretRight size={13} />
            <span>{project.code}</span>
          </div>
          <h1>{project.name}</h1>
        </div>
      </div>
      <div className="project-header-actions">
        <button className="button secondary" onClick={onEditMembers}>
          <UsersThree size={17} />
          Участники
        </button>
        <button className="button primary" onClick={onCreateTask}>
          <Plus size={17} weight="bold" />
          Новая задача
        </button>
      </div>
      <div className="project-meta-row">
        <span>{project.summary}</span>
        <span className="meta-separator" />
        <span>
          <CalendarBlank size={15} /> до {formatDate(project.target)}
        </span>
        <span className="meta-separator" />
        <span>
          <CheckCircle size={15} /> {done} из {issues.length} готово
        </span>
        <div className="mini-progress" aria-label={`Готово ${progress}%`}>
          <span style={{ "--progress-width": `${progress}%` }} />
        </div>
        <span className="progress-number">{progress}%</span>
      </div>
    </div>
  );
}

function IssueCard({ issue, onOpen, onDragStart }) {
  const priority = priorityMeta[issue.priority];
  return (
    <article
      className="issue-card"
      draggable
      onDragStart={(event) => onDragStart(event, issue.id)}
      onClick={() => onOpen(issue)}
      tabIndex="0"
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(issue);
      }}
    >
      <div className="issue-card-top">
        <span className="issue-id">{issue.identifier}</span>
        <button
          className="icon-button micro issue-menu"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(issue);
          }}
          aria-label={`Открыть ${issue.identifier}`}
        >
          <DotsThree size={17} weight="bold" />
        </button>
      </div>
      <h3>{issue.title}</h3>
      <div className="issue-card-footer">
        <span className={`priority priority-${priority.tone}`}>
          <Flag size={13} weight="fill" />
          {priority.label}
        </span>
        <span className="due-date">
          <CalendarBlank size={13} />
          {formatDate(issue.due)}
        </span>
        <Avatar memberId={issue.assignee} size="sm" />
      </div>
    </article>
  );
}

function KanbanBoard({ issues, onOpen, onMove, onCreateTask }) {
  const columns = ["planned", "progress", "review", "done"];
  const [draggedIssue, setDraggedIssue] = useState(null);
  return (
    <div className="kanban-board">
      {columns.map((status) => {
        const items = issues.filter((issue) => issue.status === status);
        const meta = statusMeta[status];
        const Icon = meta.icon;
        return (
          <section
            className="kanban-column"
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedIssue) onMove(draggedIssue, status);
              setDraggedIssue(null);
            }}
          >
            <div className="kanban-column-head">
              <span className={`column-status column-status-${meta.tone}`}>
                <Icon
                  size={15}
                  weight={status === "done" ? "fill" : "regular"}
                />
                {meta.label}
              </span>
              <span className="issue-count">{items.length}</span>
              <button
                className="icon-button micro"
                onClick={() => onCreateTask(status)}
                aria-label={`Создать задачу в колонке ${meta.label}`}
              >
                <Plus size={15} />
              </button>
            </div>
            <div className="issue-stack">
              {items.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onOpen={onOpen}
                  onDragStart={(event, id) => {
                    event.dataTransfer.effectAllowed = "move";
                    setDraggedIssue(id);
                  }}
                />
              ))}
              {!items.length && (
                <button
                  className="empty-column"
                  onClick={() => onCreateTask(status)}
                >
                  Добавить задачу
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function eventLabel(type) {
  if (type === "issue.archive") return "Задача удалена";
  if (type === "issue.restore") return "Задача восстановлена";
  return { "issue.create": "Создана задача", "issue.update": "Задача обновлена", "issue.comment": "Добавлен комментарий", "project.create": "Создан проект", "project.update": "Проект обновлён", "presentation.create": "Создана презентация", "presentation.update": "Презентация обновлена", "presentation.archive": "Презентация в архиве", "presentation.restore": "Презентация восстановлена" }[type] || type;
}
function ProjectInsights({ project, issues, onEditProject, onEditMembers }) {
  const { members: team, events = [] } = useContext(MemberContext);
  const active = issues.filter((issue) => issue.status === "progress").length;
  const remaining = issues.filter((issue) => issue.status !== "done").length;
  const owner = team.find((member) => member.id === project.lead);
  const memberIds = Array.from(
    new Set(project.members ?? [project.lead, "nursultan", "madina"]),
  );
  return (
    <aside className="project-insights">
      <section className="insight-section">
        <div className="section-heading">
          <h2>Обзор</h2>
          <button
            className="icon-button micro"
            aria-label="Настроить проект"
            onClick={onEditProject}
          >
            <DotsThree size={17} weight="bold" />
          </button>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Руководитель</dt>
            <dd>
              <Avatar memberId={project.lead} size="sm" /> {owner.name}
            </dd>
          </div>
          <div>
            <dt>Целевая дата</dt>
            <dd>
              <CalendarBlank size={15} /> {formatDate(project.target)}
            </dd>
          </div>
          <div>
            <dt>В работе</dt>
            <dd>{active} {taskWord(active)}</dd>
          </div>
          <div>
            <dt>Осталось</dt>
            <dd>{remaining} {taskWord(remaining)}</dd>
          </div>
        </dl>
      </section>
      <section className="insight-section">
        <div className="section-heading">
          <h2>Участники</h2>
          <button className="text-button" onClick={onEditMembers}>
            Изменить
          </button>
        </div>
        <div className="avatar-group">
          {memberIds.map((memberId) => (
            <Avatar memberId={memberId} key={memberId} size="md" />
          ))}
          <button
            className="add-avatar"
            aria-label="Добавить участника"
            onClick={onEditMembers}
          >
            <Plus size={15} />
          </button>
        </div>
      </section>
      <section className="insight-section activity-section">
        <div className="section-heading">
          <h2>Последняя активность</h2>
        </div>
        {events.filter((event) => event.projectId === project.id).slice(-4).reverse().map((event) => <div className="activity-item" key={event.id}><Avatar memberId={event.actorId} size="sm" /><p><strong>{team.find((member) => member.id === event.actorId)?.name}</strong> · {eventLabel(event.type)}<span>{new Date(event.occurredAt).toLocaleString("ru-RU")}</span></p></div>)}
        {!events.some((event) => event.projectId === project.id) && <p className="muted">Изменений пока нет</p>}
      </section>
    </aside>
  );
}

function ProjectView({
  project,
  issues,
  onOpenIssue,
  onMoveIssue,
  onCreateTask,
  onEditProject,
  onEditMembers,
}) {
  const [view, setView] = useState("board");
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showInsights, setShowInsights] = useState(true);
  const visibleIssues =
    statusFilter === "all"
      ? issues
      : issues.filter((issue) => issue.status === statusFilter);
  return (
    <main className="content-shell project-shell">
      <ProjectHeader
        project={project}
        issues={issues}
        onCreateTask={() => onCreateTask("planned")}
        onEditMembers={onEditMembers}
      />
      <div className="view-tabs">
        <button
          className={`view-tab ${view === "board" ? "view-tab-active" : ""}`}
          onClick={() => setView("board")}
        >
          <Kanban size={16} /> Доска
        </button>
        <button
          className={`view-tab ${view === "list" ? "view-tab-active" : ""}`}
          onClick={() => setView("list")}
        >
          <ListBullets size={16} /> Список
        </button>
        <button
          className={`view-tab ${view === "about" ? "view-tab-active" : ""}`}
          onClick={() => setView("about")}
        >
          <ClipboardText size={16} /> О проекте
        </button>
        <span className="tab-spacer" />
        <button
          className="filter-button"
          onClick={() => setFilterOpen((current) => !current)}
        >
          <FunnelSimple size={16} /> Фильтр
        </button>
        {filterOpen && (
          <div className="filter-popover">
            <span>Статус</span>
            <button
              className={statusFilter === "all" ? "filter-choice-active" : ""}
              onClick={() => setStatusFilter("all")}
            >
              Все задачи
            </button>
            {Object.entries(statusMeta).map(([status, meta]) => (
              <button
                key={status}
                className={statusFilter === status ? "filter-choice-active" : ""}
                onClick={() => setStatusFilter(status)}
              >
                {meta.label}
              </button>
            ))}
          </div>
        )}
        <button
          className="icon-button quiet"
          aria-label="Показать или скрыть обзор"
          onClick={() => setShowInsights((current) => !current)}
        >
          <DotsThree size={20} weight="bold" />
        </button>
      </div>
      {view === "board" && (
        <div className={`project-workspace ${showInsights ? "" : "project-workspace-wide"}`}>
          <KanbanBoard
            issues={visibleIssues}
            onOpen={onOpenIssue}
            onMove={onMoveIssue}
            onCreateTask={onCreateTask}
          />
          {showInsights && (
            <ProjectInsights
              project={project}
              issues={issues}
              onEditProject={onEditProject}
              onEditMembers={onEditMembers}
            />
          )}
        </div>
      )}
      {view === "list" && (
        <ProjectIssueList issues={visibleIssues} onOpenIssue={onOpenIssue} />
      )}
      {view === "about" && (
        <div className="project-about-view">
          <ProjectInsights
            project={project}
            issues={issues}
            onEditProject={onEditProject}
            onEditMembers={onEditMembers}
          />
        </div>
      )}
    </main>
  );
}

function ProjectIssueList({ issues, onOpenIssue }) {
  return (
    <div className="task-list-card project-list-card">
      {issues.map((issue) => (
        <button className="task-row" key={issue.id} onClick={() => onOpenIssue(issue)}>
          <StatusBadge status={issue.status} compact />
          <span className="task-row-title">{issue.title}</span>
          <span className="task-row-date">
            <CalendarBlank size={14} /> {formatDate(issue.due)}
          </span>
          <Avatar memberId={issue.assignee} size="sm" />
        </button>
      ))}
      {!issues.length && <p className="empty-list-note">По этому фильтру задач нет.</p>}
    </div>
  );
}

function MyTasksView({ issues, projects, onOpenIssue, onCreateTask }) {
  const { currentUserId } = useContext(MemberContext);
  const myIssues = issues.filter(
    (issue) => issue.assignee === currentUserId && issue.status !== "done",
  );
  const groups = ["progress", "planned", "backlog"];
  return (
    <main className="content-shell list-shell">
      <div className="simple-page-header">
        <div>
          <h1>Мои задачи</h1>
          <p>Всё, что сейчас ждёт вашего действия.</p>
        </div>
        <button className="button primary" onClick={() => onCreateTask("planned")}>
          <Plus size={17} weight="bold" /> Новая задача
        </button>
      </div>
      <div className="task-list-card">
        {groups.map((status) => {
          const group = myIssues.filter((issue) => issue.status === status);
          if (!group.length) return null;
          return (
            <section className="task-list-group" key={status}>
              <div className="task-group-heading">
                <StatusBadge status={status} /> <span>{group.length}</span>
              </div>
              {group.map((issue) => {
                const project = projects.find(
                  (item) => item.id === issue.projectId,
                );
                return (
                  <button
                    className="task-row"
                    key={issue.id}
                    onClick={() => onOpenIssue(issue)}
                  >
                    <StatusBadge status={issue.status} compact />
                    <span className="task-row-title">{issue.title}</span>
                    <span
                      className={`project-label project-label-${project.accent}`}
                    >
                      {project.code}
                    </span>
                    <span className="task-row-date">
                      <CalendarBlank size={14} />
                      {formatDate(issue.due)}
                    </span>
                    <Avatar memberId={issue.assignee} size="sm" />
                  </button>
                );
              })}
            </section>
          );
        })}
        {!myIssues.length && (
          <EmptyState
            icon={CheckCircle}
            title="У вас нет активных задач"
            text="Можно посмотреть проекты или создать новую задачу."
            action="Создать задачу"
            onAction={() => onCreateTask("planned")}
          />
        )}
      </div>
    </main>
  );
}

function InboxView({ issues, projects, onOpenIssue, onCreateTask }) {
  const inbox = issues.filter((issue) => issue.status === "backlog");
  return (
    <main className="content-shell list-shell">
      <div className="simple-page-header">
        <div>
          <h1>Входящие</h1>
          <p>Неразобранные задачи и идеи клуба.</p>
        </div>
        <button
          className="button primary"
          onClick={() => onCreateTask("backlog")}
        >
          <Plus size={17} weight="bold" /> Добавить
        </button>
      </div>
      <div className="task-list-card">
        {inbox.map((issue) => {
          const project = projects.find((item) => item.id === issue.projectId);
          return (
            <button
              className="task-row"
              key={issue.id}
              onClick={() => onOpenIssue(issue)}
            >
              <StatusBadge status="backlog" compact />
              <span className="task-row-title">{issue.title}</span>
              <span className={`project-label project-label-${project.accent}`}>
                {project.code}
              </span>
              <span className="task-row-date">
                <CalendarBlank size={14} />
                {formatDate(issue.due)}
              </span>
              <Avatar memberId={issue.assignee} size="sm" />
            </button>
          );
        })}
        {!inbox.length && (
          <EmptyState
            icon={Lightning}
            title="Входящие пусты"
            text="Новые идеи можно добавить в любой момент."
            action="Добавить идею"
            onAction={() => onCreateTask("backlog")}
          />
        )}
      </div>
    </main>
  );
}

function ProjectsDirectory({ projects, issues, onSelect, onCreateProject }) {
  const { members: team, currentUserId } = useContext(MemberContext);
  return (
    <main className="content-shell list-shell">
      <div className="simple-page-header">
        <div>
          <h1>Проекты</h1>
          <p>Работа клуба по направлениям и событиям.</p>
        </div>
        <button className="button primary" onClick={onCreateProject}>
          <Plus size={17} weight="bold" /> Новый проект
        </button>
      </div>
      <div className="project-directory">
        {projects.map((project) => {
          const projectIssues = issues.filter(
            (issue) => issue.projectId === project.id,
          );
          const done = projectIssues.filter(
            (issue) => issue.status === "done",
          ).length;
          const percent = projectIssues.length
            ? Math.round((done / projectIssues.length) * 100)
            : 0;
          return (
            <button
              className="project-directory-row"
              key={project.id}
              onClick={() => onSelect(project.id)}
            >
              <span className={`project-icon project-icon-${project.accent}`}>
                {project.code[0]}
              </span>
              <span className="directory-main">
                <strong>{project.name}</strong>
                <small>{project.summary}</small>
              </span>
              <span className="directory-lead">
                <Avatar memberId={project.lead} size="sm" />{" "}
                {team.find((item) => item.id === project.lead)?.name}
              </span>
              <span className="directory-target">
                <CalendarBlank size={15} /> {formatDate(project.target)}
              </span>
              <span className="directory-progress">
                <i>
                  <b style={{ "--progress-width": `${percent}%` }} />
                </i>
                {percent}%
              </span>
              <CaretRight size={18} className="directory-arrow" />
            </button>
          );
        })}
      </div>
    </main>
  );
}

function SettingsView({ data }) {
  const [candidate, setCandidate] = useState(null);
  const [importError, setImportError] = useState("");
  return (
    <main className="content-shell list-shell">
      <div className="simple-page-header">
        <div>
          <h1>Настройки пространства</h1>
          <p>Сохранение, резервные копии и история изменений.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="settings-card">
          <h2>{data.mode === "local" ? "На этом устройстве" : "Подключено к серверу"}</h2>
          <p>
            {data.mode === "local" ? "Данные сохраняются в этом браузере. Скачивайте резервную копию: очистка браузера удалит локальное пространство." : "Изменения подтверждаются сервером. Черновики презентаций при сбое остаются в этой вкладке."}
          </p>
          <span className="setting-state">
            <CheckCircle size={16} weight="fill" /> Версия данных {data.snapshot.revision}
          </span>
          <div className="data-controls"><button className="button secondary" onClick={() => downloadJson(data.snapshot, "acm-workspace-backup.json")}>Скачать резервную копию</button><button className="button secondary" onClick={data.refresh}>Обновить данные</button></div>
          {data.mode === "local" && <>
            <label className="field-label">Восстановить из копии<input type="file" accept=".json,application/json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { if (file.size > 20 * 1024 * 1024) throw new Error("Файл больше 20 МБ."); setCandidate(validateSnapshot(JSON.parse(await file.text()))); setImportError(""); } catch (error) { setImportError(error.message); setCandidate(null); } }} /></label>
            {candidate && <div className="deck-conflict"><p>Копия: {candidate.projects.length} проектов, {candidate.issues.length} задач, {candidate.presentations.length} презентаций. Она заменит текущее пространство. Перед заменой будет сохранена локальная резервная копия.</p><button onClick={async () => { if (await data.restore(candidate)) setCandidate(null); }}>Подтвердить восстановление</button><button onClick={() => setCandidate(null)}>Отмена</button></div>}
            {importError && <p role="alert">{importError}</p>}
          </>}
        </section>
        <section className="settings-card">
          <h2>Уведомления в Telegram</h2>
          <p>
            Бот пока не подключён. Задачи имеют постоянные ID, исполнителей,
            дедлайны и версии. Сервер сможет использовать историю изменений
            для уведомлений участникам.
          </p>
          <p>Привязка Telegram и настройки напоминаний появятся после подключения сервера.</p>
        </section>
        <section className="settings-card"><h2>Последние изменения</h2><ul className="data-history">{data.snapshot.events.slice(-12).reverse().map((event) => <li key={event.id}>{event.type} · {event.entityId}<br /><time>{new Date(event.occurredAt).toLocaleString("ru-RU")}</time></li>)}</ul>{!data.snapshot.events.length && <p>Изменений пока нет.</p>}</section>
      </div>
    </main>
  );
}

function EmptyState({ icon: Icon, title, text, action, onAction }) {
  return (
    <div className="empty-state">
      <Icon size={30} />
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <button className="button primary" onClick={onAction}>
          <Plus size={16} /> {action}
        </button>
      )}
    </div>
  );
}

function TaskModal({
  isOpen,
  onClose,
  onSave,
  projects,
  initialStatus = "planned",
  initialProject = "club-site",
  lockedProject = false,
  busy = false,
}) {
  const { members: team, currentUserId } = useContext(MemberContext);
  const [form, setForm] = useState({
    title: "",
    description: "",
    projectId: initialProject,
    assignee: currentUserId,
    status: initialStatus,
    priority: "medium",
    due: "",
  });
  useEffect(() => {
    if (isOpen)
      setForm({
        title: "",
        description: "",
        projectId: initialProject,
        assignee: currentUserId,
        status: initialStatus,
        priority: "medium",
        due: "",
      });
  }, [isOpen, initialProject, initialStatus]);
  if (!isOpen) return null;
  const submit = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="task-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Новая задача"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="modal-context">Новая задача</span>
            <h2>Добавить задачу</h2>
          </div>
          <button
            type="button"
            className="icon-button quiet"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={19} />
          </button>
        </div>
        <label className="field-label">
          Название
          <input
            autoFocus
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            placeholder="Например, согласовать программу"
          />
        </label>
        <label className="field-label">
          Описание
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
            placeholder="Контекст, результат и важные детали"
            rows="4"
          />
        </label>
        <div className="form-grid">
          <label className="field-label">
            Проект
            <select
              value={form.projectId}
              disabled={lockedProject}
              onChange={(event) =>
                setForm({ ...form, projectId: event.target.value })
              }
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Исполнитель
            <select
              value={form.assignee || ""}
              onChange={(event) =>
                setForm({ ...form, assignee: event.target.value || null })
              }
            >
              <option value="">Без исполнителя</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Статус
            <select
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value })
              }
            >
              {Object.entries(statusMeta).map(([id, meta]) => (
                <option key={id} value={id}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Приоритет
            <select
              value={form.priority}
              onChange={(event) =>
                setForm({ ...form, priority: event.target.value })
              }
            >
              {Object.entries(priorityMeta).map(([id, meta]) => (
                <option key={id} value={id}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field-label">
          Дедлайн
          <input
            type="date"
            value={form.due}
            onInput={(event) => setForm({ ...form, due: event.currentTarget.value })}
            onChange={(event) => setForm({ ...form, due: event.target.value })}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="button primary" type="submit" disabled={busy || !form.title.trim()}>
            <Plus size={17} weight="bold" /> Создать задачу
          </button>
        </div>
      </form>
    </div>
  );
}

function ProjectModal({ isOpen, onClose, onSave }) {
  const { members: team, currentUserId } = useContext(MemberContext);
  const [form, setForm] = useState({
    name: "",
    summary: "",
    lead: currentUserId,
    target: "",
  });
  useEffect(() => {
    if (isOpen)
      setForm({ name: "", summary: "", lead: currentUserId, target: "" });
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="task-modal project-modal"
        onSubmit={(event) => {
          event.preventDefault();
          if (form.name.trim()) onSave(form);
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="modal-context">Новый проект</span>
            <h2>Создать проект</h2>
          </div>
          <button
            type="button"
            className="icon-button quiet"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={19} />
          </button>
        </div>
        <label className="field-label">
          Название
          <input
            autoFocus
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Например, Зимняя школа"
          />
        </label>
        <label className="field-label">
          Короткое описание
          <textarea
            value={form.summary}
            onChange={(event) =>
              setForm({ ...form, summary: event.target.value })
            }
            rows="3"
            placeholder="Какой результат нужен проекту"
          />
        </label>
        <div className="form-grid">
          <label className="field-label">
            Руководитель
            <select
              value={form.lead}
              onChange={(event) =>
                setForm({ ...form, lead: event.target.value })
              }
            >
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Целевая дата
            <input
              type="date"
              value={form.target}
              onChange={(event) =>
                setForm({ ...form, target: event.target.value })
              }
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="button primary" type="submit">
            <Plus size={17} weight="bold" /> Создать проект
          </button>
        </div>
      </form>
    </div>
  );
}

function PresentationModal({ isOpen, onClose, onSave, projects, initialProject }) {
  const [form, setForm] = useState({ title: "", projectId: initialProject });
  useEffect(() => {
    if (isOpen) setForm({ title: "", projectId: initialProject || "" });
  }, [isOpen, initialProject]);
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="task-modal presentation-modal"
        onSubmit={(event) => {
          event.preventDefault();
          if (form.title.trim()) onSave(form);
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="modal-context">Новая презентация</span>
            <h2>Создать презентацию</h2>
          </div>
          <button
            type="button"
            className="icon-button quiet"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={19} />
          </button>
        </div>
        <label className="field-label">
          Название
          <input
            autoFocus
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Например, итоги встречи"
          />
        </label>
        <label className="field-label">
          Проект
          <select
            value={form.projectId}
            onChange={(event) => setForm({ ...form, projectId: event.target.value })}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <p className="presentation-modal-note">
          {projects.length ? "Создадим титульный, текстовый и живой слайд с задачами выбранного проекта." : "Создадим титульный и текстовый слайды. Слайд задач можно добавить после создания проекта."}
        </p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="button primary" type="submit">
            <Plus size={17} weight="bold" /> Создать презентацию
          </button>
        </div>
      </form>
    </div>
  );
}

function ProjectSettingsModal({ project, isOpen, onClose, onSave }) {
  const { members: team, currentUserId } = useContext(MemberContext);
  const [form, setForm] = useState(project);
  useEffect(() => {
    if (isOpen) setForm({ ...project, target: toDateInput(project.target, "") });
  }, [isOpen, project]);
  if (!isOpen || !form) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="task-modal project-modal"
        onSubmit={(event) => {
          event.preventDefault();
          if (form.name.trim()) onSave(form);
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="modal-context">Настройки проекта</span>
            <h2>{project.name}</h2>
          </div>
          <button type="button" className="icon-button quiet" onClick={onClose} aria-label="Закрыть">
            <X size={19} />
          </button>
        </div>
        <label className="field-label">
          Название
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label className="field-label">
          Описание
          <textarea value={form.summary} rows="3" onChange={(event) => setForm({ ...form, summary: event.target.value })} />
        </label>
        <div className="form-grid">
          <label className="field-label">
            Руководитель
            <select value={form.lead} onChange={(event) => setForm({ ...form, lead: event.target.value })}>
              {team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>
          <label className="field-label">
            Целевая дата
            <input type="date" value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Отмена</button>
          <button className="button primary" type="submit"><CheckCircle size={17} /> Сохранить</button>
        </div>
      </form>
    </div>
  );
}

function MembersModal({ project, isOpen, onClose, onSave }) {
  const { members: team, currentUserId } = useContext(MemberContext);
  const defaultMembers = project
    ? Array.from(new Set(project.members ?? [project.lead, "nursultan", "madina"]))
    : [];
  const [members, setMembers] = useState(defaultMembers);
  useEffect(() => {
    if (isOpen) setMembers(defaultMembers);
  }, [isOpen, project?.id]);
  if (!isOpen || !project) return null;
  const toggleMember = (memberId) => {
    if (memberId === project.lead) return;
    setMembers((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="task-modal members-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(members);
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="modal-context">Участники проекта</span>
            <h2>{project.name}</h2>
          </div>
          <button type="button" className="icon-button quiet" onClick={onClose} aria-label="Закрыть">
            <X size={19} />
          </button>
        </div>
        <div className="member-options">
          {team.map((member) => {
            const checked = members.includes(member.id);
            const isLead = member.id === project.lead;
            return (
              <label className="member-option" key={member.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isLead}
                  onChange={() => toggleMember(member.id)}
                />
                <Avatar memberId={member.id} size="md" />
                <span>{member.name}</span>
                {isLead && <small>руководитель</small>}
              </label>
            );
          })}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Отмена</button>
          <button className="button primary" type="submit"><CheckCircle size={17} /> Сохранить состав</button>
        </div>
      </form>
    </div>
  );
}

function IssueSheet({ issue, onClose, onSave, onAddComment, onDelete, busy = false }) {
  const { members: team, currentUserId } = useContext(MemberContext);
  const [form, setForm] = useState(issue);
  const [comment, setComment] = useState("");
  const [commentId, setCommentId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (issue)
      setForm({ ...issue, due: toDateInput(issue.due, "") });
    setComment("");
  }, [issue?.id]);
  if (!issue || !form || form.id !== issue.id) return null;
  const conflict = form.version !== issue.version;
  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };
  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <form
        className="issue-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Редактирование задачи"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="issue-sheet-head">
          <span className="issue-id">{issue.identifier}</span>
          <div>
            <button
              type="button"
              className="icon-button quiet"
              onClick={onClose}
              aria-label="Закрыть задачу"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <input
          className="issue-title-input"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          aria-label="Название задачи"
        />
        {conflict && <div className="deck-conflict" role="alert">Задача изменена другим участником. Ваш текст оставлен в форме. <button type="button" onClick={() => downloadJson(form, "issue-draft.json")}>Скачать черновик</button><button type="button" onClick={() => setForm({ ...issue, due: toDateInput(issue.due, "") })}>Загрузить актуальную задачу</button></div>}
        <div className="sheet-properties">
          <label>
            <span>Статус</span>
            <select
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value })
              }
            >
              {Object.entries(statusMeta).map(([id, meta]) => (
                <option key={id} value={id}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Исполнитель</span>
            <select
              value={form.assignee || ""}
              onChange={(event) =>
                setForm({ ...form, assignee: event.target.value || null })
              }
            >
              <option value="">Без исполнителя</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Приоритет</span>
            <select
              value={form.priority}
              onChange={(event) =>
                setForm({ ...form, priority: event.target.value })
              }
            >
              {Object.entries(priorityMeta).map(([id, meta]) => (
                <option key={id} value={id}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Дедлайн</span>
            <input
              type="date"
              value={form.due}
              onInput={(event) => setForm({ ...form, due: event.currentTarget.value })}
              onChange={(event) =>
                setForm({ ...form, due: event.target.value })
              }
            />
          </label>
        </div>
        <label className="sheet-description">
          <span>Описание</span>
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
            rows="5"
          />
        </label>
        <div className="sheet-comments">
          <div className="section-heading">
            <h2>Комментарии</h2>
            <span>{issue.comments.length}</span>
          </div>
          {issue.comments.map((item) => (
            <div className="comment" key={item.id}>
              <Avatar memberId={item.author} size="sm" />
              <p>
                <strong>
                  {team.find((member) => member.id === item.author)?.name}
                </strong>
                {item.text}
              </p>
            </div>
          ))}
          <div className="comment-form">
            <Avatar memberId={currentUserId} size="sm" />
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Оставить комментарий"
            />
            <button
              type="button"
              className="icon-button quiet"
              disabled={!comment.trim() || busy || conflict}
              onClick={async () => {
                if (comment.trim()) {
                  const saved = await onAddComment(issue.id, comment, commentId);
                  if (saved) {
                    setForm((current) => ({ ...current, version: saved.version, comments: saved.comments }));
                    setComment("");
                    setCommentId(crypto.randomUUID());
                  }
                }
              }}
              aria-label="Отправить комментарий"
            >
              <PaperPlaneTilt size={17} weight="fill" />
            </button>
          </div>
        </div>
        <div className="sheet-actions">
          {onDelete && <button type="button" className="button secondary issue-delete-action" disabled={busy || conflict} onClick={() => onDelete(issue)}><Trash size={17} />Удалить задачу</button>}
          <button type="button" className="button secondary" onClick={onClose}>
            Закрыть
          </button>
          <button className="button primary" type="submit" disabled={busy || conflict || !form.title.trim()}>
            <CheckCircle size={17} /> Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}

function SearchModal({ isOpen, onClose, issues, onOpenIssue }) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);
  if (!isOpen) return null;
  const matches = issues
    .filter((issue) =>
      `${issue.identifier} ${issue.title}`.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 6);
  return (
    <div className="modal-backdrop search-backdrop" onMouseDown={onClose}>
      <div
        className="search-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="search-input-wrap">
          <MagnifyingGlass size={20} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти задачу или проект"
          />
          <kbd>ESC</kbd>
        </div>
        <div className="search-results">
          {matches.map((issue) => (
            <button
              key={issue.id}
              onClick={() => {
                onOpenIssue(issue);
                onClose();
              }}
            >
              <StatusBadge status={issue.status} compact />
              <span>
                <strong>{issue.title}</strong>
                <small>{issue.identifier}</small>
              </span>
              <CaretRight size={17} />
            </button>
          ))}
          {!matches.length && <p>Ничего не найдено</p>}
        </div>
      </div>
    </div>
  );
}


export const seeds = { projects: seedProjects, issues: seedIssues, presentations: seedPresentations, members: seedMembers };
export { Sidebar, Topbar, ProjectView, MyTasksView, InboxView, ProjectsDirectory, SettingsView, TaskModal, ProjectModal, PresentationModal, ProjectSettingsModal, MembersModal, IssueSheet, SearchModal };
