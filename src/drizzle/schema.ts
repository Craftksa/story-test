import {
	boolean,
	timestamp,
	pgTable,
	text,
	primaryKey,
	integer,
	varchar,
	decimal,
	index,
	type AnyPgColumn,
} from "drizzle-orm/pg-core"
import type { AdapterAccountType } from "next-auth/adapters"
import { nanoid } from "nanoid"

export const users = pgTable("user", {
	id: text("id").primaryKey().$defaultFn(() =>  nanoid(12)),
	name: text("name"),
	username: text("username").unique(),
	email: text("email").unique(),
	image: text("image"),
	role: text('role').$type<'admin' | 'moderator' | 'employee' | 'client'>().default('client'),
	password: text("password"),
	updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),
	createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
}, (table) => ({
	emailIdx: index("user_email_idx").on(table.email),
	usernameIdx: index("user_username_idx").on(table.username),
}))

export const passwordResetTokens = pgTable('password_reset_tokens', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	token: varchar('token', { length: 6 }).notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	used: boolean('used').default(false).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accounts = pgTable(
	"account",
	{
		userId: text("userId")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: text("type").$type<AdapterAccountType>().notNull(),
		provider: text("provider").notNull(),
		providerAccountId: text("providerAccountId").notNull(),
		refresh_token: text("refresh_token"),
		access_token: text("access_token"),
		expires_at: integer("expires_at"),
		token_type: text("token_type"),
		scope: text("scope"),
		id_token: text("id_token"),
		session_state: text("session_state"),
	},
	(account) => [
		{
			compoundKey: primaryKey({
				columns: [account.provider, account.providerAccountId],
			}),
		},
	]
)

export const sessions = pgTable("session", {
	sessionToken: text("sessionToken").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
	"verificationToken",
	{
		identifier: text("identifier").notNull(),
		token: text("token").notNull(),
		expires: timestamp("expires", { mode: "date" }).notNull(),
	},
	(verificationToken) => [
		{
			compositePk: primaryKey({
				columns: [verificationToken.identifier, verificationToken.token],
			}),
		},
	]
)

export const authenticators = pgTable(
	"authenticator",
	{
		credentialID: text("credentialID").notNull().unique(),
		userId: text("userId")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		providerAccountId: text("providerAccountId").notNull(),
		credentialPublicKey: text("credentialPublicKey").notNull(),
		counter: integer("counter").notNull(),
		credentialDeviceType: text("credentialDeviceType").notNull(),
		credentialBackedUp: boolean("credentialBackedUp").notNull(),
		transports: text("transports"),
	},
	(authenticator) => [
		{
			compositePK: primaryKey({
				columns: [authenticator.userId, authenticator.credentialID],
			}),
		},
	]
)

export const projects = pgTable("project", {
	id: text("id").primaryKey().$defaultFn(() =>  nanoid(14)),
	name: text("name").notNull(),
	status: text("status").$type<"not_started" | "in_progress" | "completed" | "on_hold" | "needs_review">().notNull().default("not_started"),
	city: text("city").notNull(),
	district: text("district").notNull(),
	projectType: text("project_type").notNull(),
	startDate: timestamp("start_date", { mode: "date" }),
	endDate: timestamp("end_date", { mode: "date" }),
	description: text("description"),

	clientId: text("client_id")
		.references(() => users.id, { onDelete: "restrict" }),

	designer: text("designer").notNull(),

	createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
	clientIdIdx: index("project_client_id_idx").on(table.clientId),
}));


export const tasks = pgTable("task", {
	id: text("id").primaryKey().$defaultFn(() =>  nanoid(14)),
	name: text("name").notNull(),
	status: text("status").$type<"not_started" | "in_progress" | "completed" | "on_hold" | "needs_review">().notNull().default("not_started"),
	type: text("type").$type<"foundations" | "finishes">().notNull(),
	startDate: timestamp("start_date", { mode: "date" }),
	endDate: timestamp("end_date", { mode: "date" }),
	notes: text("notes"),

	projectId: text("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),

	dependsOnTaskId: text("depends_on_task_id")
		.references((): AnyPgColumn => tasks.id, { onDelete: "set null" }),
	isMilestone: boolean("is_milestone").notNull().default(false),
	blockedReason: text("blocked_reason")
		.$type<"client_approval" | "client_documents" | "internal" | "external">(),
	blockedNote: text("blocked_note"),
	blockedAt: timestamp("blocked_at", { mode: "date" }),

	createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Contracts Table
export const contracts = pgTable("contract", {
	id: text("id").primaryKey().$defaultFn(() => nanoid(14)),
	projectId: text("project_id")
		.references(() => projects.id, { onDelete: "cascade" })
		.notNull(),
	description: text("description"),
	contractorName: text("contractor_name").notNull(),
	contractedAmount: decimal("contracted_amount", { precision: 12, scale: 2 }).notNull(),
	fileUrl: text("file_url"), // original file URL
	createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Contract Installments Table
export const contractInstallments = pgTable("contract_installment", {
	id: text("id").primaryKey().$defaultFn(() => nanoid(14)),
	contractId: text("contract_id")
		.references(() => contracts.id, { onDelete: "cascade" })
		.notNull(),
	notes: text("notes"),
	installmentNo: integer("installment_no").notNull(),
	installmentAmount: decimal("installment_amount", { precision: 12, scale: 2 }).notNull(),
	paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
	paymentDate: timestamp("payment_date", { mode: "date" }),
	createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// One-to-one PDF payment proof for a contract installment.
// Managed exclusively through the `paymentProofUploader` route by an employee
// assigned to the owning project. Deleting the installment removes the proof row
// (the underlying stored file is cleaned up on replace by the uploader).
//
// The file is stored privately in UploadThing; access is always through a
// signed URL generated at request time, so no URL is persisted here.
export const installmentPaymentProofs = pgTable("installment_payment_proof", {
	installmentId: text("installment_id")
		.primaryKey()
		.references(() => contractInstallments.id, { onDelete: "cascade" }),
	fileKey: text("file_key").notNull().unique(),
	mimeType: text("mime_type").notNull(),
	fileName: text("file_name").notNull(),
	fileSize: integer("file_size").notNull(),
	uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
	uploadedAt: timestamp("uploaded_at", { mode: "date" }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const projectAssignments = pgTable("project_assignment", {
	projectId: text("project_id")
		.references(() => projects.id, { onDelete: "cascade" })
		.notNull(),
	userId: text("user_id")
		.references(() => users.id, { onDelete: "cascade" })
		.notNull(),
}, (table) => ({
	pk: primaryKey({ columns: [table.projectId, table.userId] }),
	userIdIdx: index("project_assignment_user_id_idx").on(table.userId),
	projectIdIdx: index("project_assignment_project_id_idx").on(table.projectId),
}));

export const taskImages = pgTable("task_image", {
	id: text("id").primaryKey().$defaultFn(() =>  nanoid(12)),
	taskId: text("task_id")
		.references(() => tasks.id, { onDelete: "cascade" })
		.notNull(),
	url: text("url").notNull(),
	description: text("description"),
	uploadedBy: text("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: "date" }).defaultNow(),
});

export const projectNotes = pgTable("project_note", {
	id: text("id").primaryKey().$defaultFn(() => nanoid(14)),
	projectId: text("project_id")
		.references(() => projects.id, { onDelete: "cascade" })
		.notNull(),
	authorId: text("author_id")
		.references(() => users.id, { onDelete: "set null" }),
	content: text("content").notNull(),
	recipientType: text("recipient_type").$type<"owner" | "client">(),
	recipientId: text("recipient_id").references(() => users.id, { onDelete: "set null" }),
	visibility: text("visibility").$type<"internal" | "client">().notNull().default("internal"),
	status: text("status")
		.$type<"draft" | "pending_admin_approval" | "approved" | "rejected">()
		.notNull()
		.default("approved"),
	approvedBy: text("approved_by").references(() => users.id, { onDelete: "set null" }),
	approvedAt: timestamp("approved_at", { mode: "date" }),
	rejectionReason: text("rejection_reason"),
	createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const projectReports = pgTable("project_report", {
	id: text("id").primaryKey().$defaultFn(() => nanoid(14)),
	projectId: text("project_id")
		.references(() => projects.id, { onDelete: "cascade" })
		.notNull(),
	reportType: text("report_type")
		.$type<"client" | "internal" | "shared">()
		.notNull(),
	title: text("title").notNull(),
	summary: text("summary"),
	details: text("details").notNull(),
	workDetails: text("work_details"),
	attachments: text("attachments"),
	recipients: text("recipients"),
	recipientType: text("recipient_type").$type<"owner" | "client">(),
	recipientId: text("recipient_id").references(() => users.id, { onDelete: "set null" }),
	pdfUrl: text("pdf_url"),
	pdfFileName: text("pdf_file_name"),
	status: text("status")
		.$type<"draft" | "pending_admin_approval" | "approved" | "rejected" | "sent">()
		.notNull()
		.default("draft"),
	authorId: text("author_id")
		.references(() => users.id, { onDelete: "set null" }),
	approvedBy: text("approved_by")
		.references(() => users.id, { onDelete: "set null" }),
	approvedAt: timestamp("approved_at", { mode: "date" }),
	rejectionReason: text("rejection_reason"),
	adminDecisionNote: text("admin_decision_note"),
	pdfStatus: text("pdf_status")
		.$type<"not_generated" | "generated" | "failed">()
		.notNull()
		.default("not_generated"),
	emailStatus: text("email_status")
		.$type<"not_applicable" | "pending" | "sent" | "failed" | "not_configured">()
		.notNull()
		.default("not_applicable"),
	whatsappStatus: text("whatsapp_status")
		.$type<"not_applicable" | "pending" | "sent" | "failed" | "not_configured">()
		.notNull()
		.default("not_applicable"),
	lastDeliveryError: text("last_delivery_error"),
	sentAt: timestamp("sent_at", { mode: "date" }),
	createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const projectReportPermissions = pgTable("project_report_permission", {
	reportId: text("report_id")
		.references(() => projectReports.id, { onDelete: "cascade" })
		.notNull(),
	userId: text("user_id")
		.references(() => users.id, { onDelete: "cascade" })
		.notNull(),
	accessLevel: text("access_level")
		.$type<"view" | "edit">()
		.notNull()
		.default("view"),
	assignedBy: text("assigned_by")
		.references(() => users.id, { onDelete: "set null" }),
	createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
}, (table) => ({
	pk: primaryKey({ columns: [table.reportId, table.userId] }),
}));

export const projectLetters = pgTable("project_letter", {
	id: text("id").primaryKey().$defaultFn(() => nanoid(14)),
	projectId: text("project_id")
		.references(() => projects.id, { onDelete: "cascade" })
		.notNull(),
	recipientName: text("recipient_name").notNull(),
	subject: text("subject").notNull(),
	body: text("body").notNull(),
	recipientType: text("recipient_type").$type<"owner" | "client">(),
	recipientId: text("recipient_id").references(() => users.id, { onDelete: "set null" }),
	letterDate: timestamp("letter_date", { mode: "date" }),
	attachments: text("attachments"),
	status: text("status")
		.$type<"draft" | "ready" | "pending_admin_approval" | "approved" | "rejected" | "sent">()
		.notNull()
		.default("draft"),
	authorId: text("author_id")
		.references(() => users.id, { onDelete: "set null" }),
	approvedBy: text("approved_by").references(() => users.id, { onDelete: "set null" }),
	approvedAt: timestamp("approved_at", { mode: "date" }),
	rejectionReason: text("rejection_reason"),
	sentAt: timestamp("sent_at", { mode: "date" }),
	createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});
