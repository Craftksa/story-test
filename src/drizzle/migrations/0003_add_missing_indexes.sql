CREATE INDEX IF NOT EXISTS "project_client_id_idx" ON "project" ("client_id");

CREATE INDEX IF NOT EXISTS "user_email_idx" ON "user" ("email");

CREATE INDEX IF NOT EXISTS "user_username_idx" ON "user" ("username");

CREATE INDEX IF NOT EXISTS "project_assignment_user_id_idx" ON "project_assignment" ("user_id");

CREATE INDEX IF NOT EXISTS "project_assignment_project_id_idx" ON "project_assignment" ("project_id");
