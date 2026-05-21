CREATE TABLE IF NOT EXISTS "project_note" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"author_id" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "project_report" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"report_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"details" text NOT NULL,
	"work_details" text,
	"attachments" text,
	"recipients" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"author_id" text,
	"approved_by" text,
	"approved_at" timestamp,
	"rejection_reason" text,
	"admin_decision_note" text,
	"pdf_status" text DEFAULT 'not_generated' NOT NULL,
	"email_status" text DEFAULT 'not_applicable' NOT NULL,
	"whatsapp_status" text DEFAULT 'not_applicable' NOT NULL,
	"last_delivery_error" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "project_report_permission" (
	"report_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_level" text DEFAULT 'view' NOT NULL,
	"assigned_by" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "project_report_permission_pk" PRIMARY KEY("report_id", "user_id")
);

DO $$ BEGIN
 ALTER TABLE "project_note"
 ADD CONSTRAINT "project_note_project_id_project_id_fk"
 FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_note"
 ADD CONSTRAINT "project_note_author_id_user_id_fk"
 FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_report"
 ADD CONSTRAINT "project_report_project_id_project_id_fk"
 FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_report"
 ADD CONSTRAINT "project_report_author_id_user_id_fk"
 FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_report"
 ADD CONSTRAINT "project_report_approved_by_user_id_fk"
 FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_report_permission"
 ADD CONSTRAINT "project_report_permission_report_id_project_report_id_fk"
 FOREIGN KEY ("report_id") REFERENCES "project_report"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_report_permission"
 ADD CONSTRAINT "project_report_permission_user_id_user_id_fk"
 FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_report_permission"
 ADD CONSTRAINT "project_report_permission_assigned_by_user_id_fk"
 FOREIGN KEY ("assigned_by") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
