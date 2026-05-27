CREATE TABLE IF NOT EXISTS "project_letter" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"recipient_name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"letter_date" timestamp,
	"attachments" text,
	"status" text DEFAULT 'ready' NOT NULL,
	"author_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

DO $$ BEGIN
 ALTER TABLE "project_letter"
 ADD CONSTRAINT "project_letter_project_id_project_id_fk"
 FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_letter"
 ADD CONSTRAINT "project_letter_author_id_user_id_fk"
 FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
