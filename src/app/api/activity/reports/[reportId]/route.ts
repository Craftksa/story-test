import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { authenticate } from "@/lib/authenticate";
import {
	canAccessActivity,
	canUserModifyReport,
	createActivitySystemNoteContent,
	getActivityProjectDetails,
	getReportById,
	serializeJsonList,
} from "@/lib/activity";
import { db } from "@/drizzle/db";
import { projectNotes, projectReportPermissions, projectReports, users } from "@/drizzle/schema";
import { hasRole, isValidId } from "@/lib/utils";
import type { ReportDeliveryOption } from "@/lib/report-delivery";

const recipientChannelSchema = z.enum(["email", "whatsapp", "both", "email_whatsapp", "none"]);
const REPORT_EMAIL_REQUIRED_MESSAGE = "البريد الإلكتروني مطلوب لإرسال التقرير";

const recipientSchema = z.object({
	name: z.string().min(1),
	email: z.string().optional().or(z.literal("")).nullable(),
	phone: z.string().optional().or(z.literal("")).nullable(),
	channel: recipientChannelSchema.optional(),
});

const attachmentSchema = z.object({
	url: z.string().url(),
	name: z.string().optional().nullable(),
	type: z.string().optional().nullable(),
});

const reportPermissionSchema = z.object({
	userId: z.string().min(1),
	accessLevel: z.enum(["view", "edit"]),
});

const reportSubmitActionSchema = z.enum(["draft", "save", "send"]);

const dedupePermissions = (permissions: Array<z.infer<typeof reportPermissionSchema>>) => {
	const uniquePermissions = new Map<string, z.infer<typeof reportPermissionSchema>>();

	permissions.forEach((permission) => {
		const userId = permission.userId.trim();
		if (!userId) return;

		uniquePermissions.set(userId, {
			userId,
			accessLevel: permission.accessLevel,
		});
	});

	return Array.from(uniquePermissions.values());
};

const updateReportSchema = z.object({
	title: z.string().min(3).max(180),
	summary: z.string().max(4000).optional().nullable(),
	details: z.string().min(5).max(12000),
	workDetails: z.string().max(12000).optional().nullable(),
	attachments: z.array(attachmentSchema).optional().default([]),
	recipients: z.array(recipientSchema).optional().default([]),
	permissions: z.array(reportPermissionSchema).optional().default([]),
	deliveryOption: z
		.enum(["draft", "pdf_only", "email", "whatsapp", "email_whatsapp"])
		.optional()
		.default("draft"),
	submitAction: reportSubmitActionSchema.optional(),
});

const getEffectiveDeliveryOption = (option: ReportDeliveryOption): ReportDeliveryOption =>
	option === "draft" ? "draft" : "email";

const hasValidRecipientEmail = (email?: string | null) =>
	!!email && z.string().email().safeParse(email.trim()).success;

const validateRecipientsForEmailDelivery = (
	recipients: Array<z.infer<typeof recipientSchema>>,
	option: ReportDeliveryOption
) => {
	if (getEffectiveDeliveryOption(option) === "draft") {
		return null;
	}

	if (
		recipients.length === 0 ||
		recipients.some((recipient) => !hasValidRecipientEmail(recipient.email))
	) {
		return REPORT_EMAIL_REQUIRED_MESSAGE;
	}

	return null;
};

const normalizeRecipientChannel = (
	option: ReportDeliveryOption,
	recipient: z.infer<typeof recipientSchema>
) => {
	return getEffectiveDeliveryOption(option) === "draft"
		? recipient.email?.trim()
			? "email"
			: "none"
		: "email";
};

const recordWorkflowEvent = async ({
	projectId,
	authorId,
	payload,
}: {
	projectId: string;
	authorId: string | null | undefined;
	payload: Parameters<typeof createActivitySystemNoteContent>[0];
}) => {
	await db.insert(projectNotes).values({
		projectId,
		authorId: authorId ?? null,
		content: createActivitySystemNoteContent(payload),
		createdAt: new Date(),
		updatedAt: new Date(),
	});
};

const getStatusForSubmitAction = ({
	existingStatus,
	reportType,
	isAdmin,
	submitAction,
}: {
	existingStatus: "draft" | "pending_admin_approval" | "approved" | "rejected" | "sent";
	reportType: "client" | "internal" | "shared";
	isAdmin: boolean;
	submitAction?: z.infer<typeof reportSubmitActionSchema>;
}) => {
	if (submitAction === "draft") {
		return "draft" as const;
	}

	if (submitAction === "send") {
		if (existingStatus === "sent") {
			return "sent" as const;
		}

		if (reportType === "client") {
			return isAdmin ? ("approved" as const) : ("pending_admin_approval" as const);
		}

		return "approved" as const;
	}

	if (submitAction === "save" && existingStatus === "rejected") {
		if (reportType === "client") {
			return isAdmin ? ("approved" as const) : ("pending_admin_approval" as const);
		}

		return "approved" as const;
	}

	return existingStatus;
};

export async function GET(
	req: NextRequest,
	{ params }: { params: { reportId: string } }
) {
	const { user } = await authenticate(req);

	if (!canAccessActivity(user) || !isValidId(params.reportId)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const report = await getReportById(params.reportId, user ?? {});
		if (!report) {
			return NextResponse.json({ error: "Report not found" }, { status: 404 });
		}

		return NextResponse.json(report);
	} catch (error) {
		console.error("GET /api/activity/reports/[reportId] error:", error);
		return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
	}
}

export async function PATCH(
	req: NextRequest,
	{ params }: { params: { reportId: string } }
) {
	const { user } = await authenticate(req);

	if (!canAccessActivity(user) || !isValidId(params.reportId)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const canModify = await canUserModifyReport(params.reportId, user ?? {});
		if (!canModify) {
			return NextResponse.json({ error: "You do not have permission to edit this report." }, { status: 403 });
		}

		const existingReport = await getReportById(params.reportId, user ?? {});
		if (!existingReport) {
			return NextResponse.json({ error: "Report not found" }, { status: 404 });
		}

		const body = await req.json();
		const parsed = updateReportSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: "Invalid report data", issues: parsed.error.errors }, { status: 400 });
		}

		const effectiveDeliveryOption = getEffectiveDeliveryOption(parsed.data.deliveryOption);
		const recipientValidationError = validateRecipientsForEmailDelivery(
			parsed.data.recipients,
			parsed.data.deliveryOption
		);
		if (recipientValidationError) {
			return NextResponse.json({ error: recipientValidationError }, { status: 400 });
		}

		const isAdmin = hasRole(user, ["admin", "moderator"]);
		const requestedPermissions = isAdmin
			? dedupePermissions(parsed.data.permissions)
			: existingReport.permissions.map((permission) => ({
					userId: permission.userId.trim(),
					accessLevel: permission.accessLevel,
				}));
		const uniquePermissionUserIds = [...new Set(requestedPermissions.map((permission) => permission.userId))];

		if (uniquePermissionUserIds.length > 0) {
			const internalUsers = await db
				.select({
					id: users.id,
					role: users.role,
				})
				.from(users)
				.where(inArray(users.id, uniquePermissionUserIds));

			const validIds = new Set(
				internalUsers
					.filter((internalUser) => ["admin", "moderator", "employee"].includes(internalUser.role ?? ""))
					.map((internalUser) => internalUser.id)
			);

			if (validIds.size !== uniquePermissionUserIds.length) {
				return NextResponse.json({ error: "One or more report permissions are invalid." }, { status: 400 });
			}
		}

		const normalizedRecipients = parsed.data.recipients.map((recipient) => ({
			name: recipient.name.trim(),
			email: recipient.email?.trim() || null,
			phone: recipient.phone?.trim() || null,
			channel: normalizeRecipientChannel(effectiveDeliveryOption, recipient),
		}));
		const nextStatus = getStatusForSubmitAction({
			existingStatus: existingReport.status,
			reportType: existingReport.reportType,
			isAdmin,
			submitAction: parsed.data.submitAction,
		});
		const shouldResetToDraft = parsed.data.submitAction === "draft";

		await db
			.update(projectReports)
			.set({
				title: parsed.data.title.trim(),
				summary: parsed.data.summary?.trim() || null,
				details: parsed.data.details.trim(),
				workDetails: parsed.data.workDetails?.trim() || null,
				attachments: serializeJsonList(parsed.data.attachments),
				recipients: serializeJsonList(normalizedRecipients),
				status: nextStatus,
				approvedBy: shouldResetToDraft ? null : existingReport.approvedBy,
				approvedAt: shouldResetToDraft ? null : existingReport.approvedAt ? new Date(existingReport.approvedAt) : null,
				rejectionReason: shouldResetToDraft ? null : existingReport.rejectionReason,
				adminDecisionNote: shouldResetToDraft ? null : existingReport.adminDecisionNote,
				pdfStatus: shouldResetToDraft ? "not_generated" : existingReport.pdfStatus,
				emailStatus: shouldResetToDraft ? "not_applicable" : existingReport.emailStatus,
				whatsappStatus: shouldResetToDraft ? "not_applicable" : existingReport.whatsappStatus,
				lastDeliveryError: shouldResetToDraft ? null : existingReport.lastDeliveryError,
				sentAt: shouldResetToDraft ? null : existingReport.sentAt ? new Date(existingReport.sentAt) : null,
				updatedAt: new Date(),
			})
			.where(eq(projectReports.id, params.reportId));

		if (isAdmin) {
			await db.delete(projectReportPermissions).where(eq(projectReportPermissions.reportId, params.reportId));
			if (requestedPermissions.length > 0) {
				await db.insert(projectReportPermissions).values(
					requestedPermissions.map((permission) => ({
						reportId: params.reportId,
						userId: permission.userId,
						accessLevel: permission.accessLevel,
						assignedBy: user?.id ?? null,
						createdAt: new Date(),
					}))
				);
			}
		}

		if (
			!isAdmin &&
			existingReport.reportType === "client" &&
			parsed.data.submitAction === "save" &&
			nextStatus === "pending_admin_approval"
		) {
			await recordWorkflowEvent({
				projectId: existingReport.projectId,
				authorId: user?.id,
				payload: {
					version: 1,
					eventType:
						existingReport.status === "rejected"
							? "report_resubmitted_for_review"
							: "report_submitted_for_review",
					relatedType: "report",
					relatedId: existingReport.id,
					projectId: existingReport.projectId,
					title: parsed.data.title.trim(),
					summary: parsed.data.summary?.trim() || parsed.data.details.trim().slice(0, 220),
					actorId: user?.id ?? null,
					actorName: user?.name || user?.email || null,
				},
			});
		}

		const details = await getActivityProjectDetails(existingReport.projectId, user ?? {});
		return NextResponse.json({
			details,
			message:
				parsed.data.submitAction === "draft"
					? "تم حفظ التقرير كمسودة"
					: "تم تحديث التقرير بنجاح.",
			reportId: existingReport.id,
		});
	} catch (error) {
		console.error("PATCH /api/activity/reports/[reportId] error:", error);
		return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
	}
}
