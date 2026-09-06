CREATE TABLE IF NOT EXISTS "installment_payment_proof" (
	"installment_id" text PRIMARY KEY NOT NULL,
	"file_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_by" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "installment_payment_proof_file_key_unique" UNIQUE("file_key")
);

DO $$ BEGIN
 ALTER TABLE "installment_payment_proof"
 ADD CONSTRAINT "installment_payment_proof_installment_id_contract_installment_id_fk"
 FOREIGN KEY ("installment_id") REFERENCES "contract_installment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "installment_payment_proof"
 ADD CONSTRAINT "installment_payment_proof_uploaded_by_user_id_fk"
 FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
