import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

test("D1 reference schema is executable SQLite with tenant isolation and strict slide kinds", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(readFileSync(new URL("../docs/cloudflare-schema.sql", import.meta.url), "utf8"));
    db.exec(`INSERT INTO workspaces(id,name) VALUES ('w1','ACM'),('w2','Another');
      INSERT INTO members(workspace_id,id,name,initials) VALUES ('w1','u','Member','ME'),('w2','other','Other','OT');
      INSERT INTO projects(workspace_id,id,code,name,lead_id,created_at,updated_at,created_by,updated_by)
      VALUES ('w1','p1','WEB','Website','u','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z','u','u');
      INSERT INTO presentations(workspace_id,id,title,owner_id,template_id,created_at,updated_at,created_by,updated_by)
      VALUES ('w1','d1','Meeting','u','acm-standard-v1','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z','u','u');`);
    const slide = db.prepare("INSERT INTO slides(workspace_id,presentation_id,id,position,kind,project_id) VALUES ('w1','d1',?,?,?,?)");
    slide.run("s1", 0, "title", null);
    slide.run("s2", 1, "tickets", "p1");
    assert.throws(() => slide.run("s3", 2, "tickets", null));
    assert.throws(() => slide.run("s3", 2, "tickets", "missing"));
    assert.throws(() => slide.run("s3", 2, "freeform", null));
    assert.throws(() => db.exec("UPDATE projects SET lead_id='other' WHERE id='p1'"));
    assert.throws(() => db.exec("DELETE FROM projects WHERE id='p1'"));
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { db.close(); }
});
