ALTER TABLE "project_note" ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'internal';
ALTER TABLE "project_note" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'approved';
ALTER TABLE "project_note" ADD COLUMN IF NOT EXISTS "approved_by" text;
ALTER TABLE "project_note" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
ALTER TABLE "project_note" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE "project_note" ADD COLUMN IF NOT EXISTS "recipient_type" text;
ALTER TABLE "project_note" ADD COLUMN IF NOT EXISTS "recipient_id" text;

ALTER TABLE "project_letter" ADD COLUMN IF NOT EXISTS "approved_by" text;
ALTER TABLE "project_letter" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
ALTER TABLE "project_letter" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE "project_letter" ADD COLUMN IF NOT EXISTS "sent_at" timestamp;
ALTER TABLE "project_letter" ADD COLUMN IF NOT EXISTS "recipient_type" text;
ALTER TABLE "project_letter" ADD COLUMN IF NOT EXISTS "recipient_id" text;

ALTER TABLE "project_report" ADD COLUMN IF NOT EXISTS "recipient_type" text;
ALTER TABLE "project_report" ADD COLUMN IF NOT EXISTS "recipient_id" text;
ALTER TABLE "project_report" ADD COLUMN IF NOT EXISTS "pdf_url" text;
ALTER TABLE "project_report" ADD COLUMN IF NOT EXISTS "pdf_file_name" text;

UPDATE "project_report" AS report
SET "recipient_type" = 'client'
FROM "project" AS project
WHERE report."project_id" = project."id"
	AND report."report_type" = 'client'
	AND project."client_id" IS NOT NULL
	AND report."recipient_type" IS NULL;

UPDATE "project_report" AS report
SET "recipient_id" = project."client_id"
FROM "project" AS project
WHERE report."project_id" = project."id" AND report."recipient_type" = 'client' AND project."client_id" IS NOT NULL AND report."recipient_id" IS NULL;

DO $$ BEGIN
 ALTER TABLE "project_note" ADD CONSTRAINT "project_note_recipient_id_user_id_fk"
 FOREIGN KEY ("recipient_id") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_report" ADD CONSTRAINT "project_report_recipient_id_user_id_fk"
 FOREIGN KEY ("recipient_id") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_letter" ADD CONSTRAINT "project_letter_recipient_id_user_id_fk"
 FOREIGN KEY ("recipient_id") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;


DO $$ BEGIN
 ALTER TABLE "project_note" ADD CONSTRAINT "project_note_approved_by_user_id_fk"
 FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_letter" ADD CONSTRAINT "project_letter_approved_by_user_id_fk"
 FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;