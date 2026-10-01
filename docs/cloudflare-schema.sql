-- Reference D1 schema; reviewed handoff, NOT applied to a live database.
-- CamelCase API mapping and transaction requirements: backend-contract.md.
PRAGMA foreign_keys = ON;

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Almaty',
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
CREATE TABLE members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  auth_subject TEXT,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'blue',
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  disabled_at TEXT,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, auth_subject)
);
CREATE TABLE projects (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 300),
  summary TEXT NOT NULL DEFAULT '',
  lead_id TEXT NOT NULL,
  target_on TEXT,
  accent TEXT NOT NULL DEFAULT 'blue',
  next_issue_number INTEGER NOT NULL DEFAULT 1 CHECK (next_issue_number > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  archived_at TEXT,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, code),
  FOREIGN KEY (workspace_id, lead_id) REFERENCES members(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, created_by) REFERENCES members(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, updated_by) REFERENCES members(workspace_id, id) ON DELETE RESTRICT
);
CREATE TABLE project_members (
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  PRIMARY KEY (workspace_id, project_id, member_id),
  FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, member_id) REFERENCES members(workspace_id, id) ON DELETE RESTRICT
);
CREATE TABLE issues (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  number INTEGER NOT NULL CHECK (number > 0),
  identifier TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('backlog','planned','progress','review','done')),
  priority TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  assignee_id TEXT,
  due_on TEXT CHECK (due_on IS NULL OR due_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  labels_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(labels_json) AND json_type(labels_json) = 'array'),
  reminder_generation INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  archived_at TEXT,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, identifier),
  UNIQUE (workspace_id, project_id, number),
  FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, assignee_id) REFERENCES members(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, created_by) REFERENCES members(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, updated_by) REFERENCES members(workspace_id, id) ON DELETE RESTRICT
);
CREATE INDEX issues_by_project ON issues(workspace_id, project_id, archived_at, status);
CREATE INDEX issues_by_assignee ON issues(workspace_id, assignee_id, archived_at, status);
CREATE INDEX issues_by_due ON issues(workspace_id, due_on) WHERE archived_at IS NULL AND status != 'done';
CREATE TABLE issue_comments (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  text TEXT NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 10000),
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, issue_id) REFERENCES issues(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, author_id) REFERENCES members(workspace_id, id) ON DELETE RESTRICT
);
CREATE INDEX comments_by_issue ON issue_comments(workspace_id, issue_id, created_at);
CREATE TABLE presentations (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  owner_id TEXT NOT NULL,
  template_id TEXT NOT NULL CHECK (template_id = 'acm-standard-v1'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  archived_at TEXT,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, owner_id) REFERENCES members(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, created_by) REFERENCES members(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, updated_by) REFERENCES members(workspace_id, id) ON DELETE RESTRICT
);
CREATE TABLE slides (
  workspace_id TEXT NOT NULL,
  presentation_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('title','text','tickets')),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  project_id TEXT,
  statuses_json TEXT NOT NULL DEFAULT '["planned","progress","review"]' CHECK (json_valid(statuses_json) AND json_type(statuses_json) = 'array' AND json_array_length(statuses_json) > 0),
  assignee_id TEXT,
  PRIMARY KEY (workspace_id, presentation_id, id),
  UNIQUE (workspace_id, presentation_id, position),
  CHECK ((kind = 'tickets' AND project_id IS NOT NULL) OR (kind != 'tickets' AND project_id IS NULL)),
  FOREIGN KEY (workspace_id, presentation_id) REFERENCES presentations(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, assignee_id) REFERENCES members(workspace_id, id) ON DELETE RESTRICT
);
CREATE TABLE command_receipts (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  command_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_version INTEGER NOT NULL,
  committed_revision INTEGER NOT NULL,
  committed_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, command_id),
  FOREIGN KEY (workspace_id, actor_id) REFERENCES members(workspace_id, id) ON DELETE RESTRICT
);
CREATE TABLE change_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_version INTEGER NOT NULL,
  project_id TEXT,
  actor_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  changes_json TEXT NOT NULL CHECK (json_valid(changes_json)),
  comment_id TEXT,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, command_id),
  FOREIGN KEY (workspace_id, command_id) REFERENCES command_receipts(workspace_id, command_id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, actor_id) REFERENCES members(workspace_id, id) ON DELETE RESTRICT
);
CREATE INDEX events_by_project ON change_events(workspace_id, project_id, sequence);

-- Backend-only. Never serialize these tables into the browser snapshot.
CREATE TABLE telegram_links (
  workspace_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  opted_in_at TEXT NOT NULL,
  disabled_at TEXT,
  PRIMARY KEY (workspace_id, member_id),
  UNIQUE (workspace_id, telegram_user_id),
  FOREIGN KEY (workspace_id, member_id) REFERENCES members(workspace_id, id) ON DELETE RESTRICT
);
CREATE TABLE reminder_jobs (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  generation INTEGER NOT NULL,
  rule TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  completed_at TEXT,
  cancelled_at TEXT,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, issue_id, recipient_id, generation, rule),
  FOREIGN KEY (workspace_id, issue_id) REFERENCES issues(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, recipient_id) REFERENCES members(workspace_id, id) ON DELETE RESTRICT
);
CREATE INDEX reminders_ready ON reminder_jobs(scheduled_at) WHERE completed_at IS NULL AND cancelled_at IS NULL;
CREATE TABLE notification_outbox (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  event_id TEXT,
  reminder_id TEXT,
  issue_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','sent','failed','cancelled','uncertain')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  sent_at TEXT,
  provider_message_id TEXT,
  last_error TEXT,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, dedupe_key),
  CHECK ((event_id IS NULL) != (reminder_id IS NULL)),
  FOREIGN KEY (workspace_id, event_id) REFERENCES change_events(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, reminder_id) REFERENCES reminder_jobs(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, issue_id) REFERENCES issues(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, recipient_id) REFERENCES members(workspace_id, id) ON DELETE RESTRICT
);
CREATE INDEX outbox_ready ON notification_outbox(state, next_attempt_at);
