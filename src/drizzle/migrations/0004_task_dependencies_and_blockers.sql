ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "depends_on_task_id" text;
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "is_milestone" boolean DEFAULT false NOT NULL;
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "blocked_reason" text;
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "blocked_note" text;
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "blocked_at" timestamp;

DO $$ BEGIN
 ALTER TABLE "task"
 ADD CONSTRAINT "task_depends_on_task_id_task_id_fk"
 FOREIGN KEY ("depends_on_task_id") REFERENCES "task"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
