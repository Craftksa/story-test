import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { authenticate } from "@/lib/authenticate";
import {
	canAccessActivity,
	createActivitySystemNoteContent,
	getActivityProjectDetails,
	serializeJsonList,
	userCanAccessProjectActivity,
} from "@/lib/activity";
import { db } from "@/drizzle/db";
import { projectNotes, projectReportPermissions, projectReports, users } from "@/drizzle/schema";
import { hasRole } from "@/lib/utils";
import { deliverClientReport, type ReportDeliveryOption } from "@/lib/report-delivery";
import { getReportPdfPayload } from "@/lib/report-pdf";

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

const createReportSchema = z.object({
	projectId: z.string().min(1),
	reportType: z.enum(["client", "internal", "shared"]),
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

const getInitialStatus = ({
	reportType,
	deliveryOption,
	isAdmin,
}: {
	reportType: "client" | "internal" | "shared";
	deliveryOption: ReportDeliveryOption;
	isAdmin: boolean;
}) => {
	if (deliveryOption === "draft") {
		return "draft" as const;
	}

	if (reportType === "client") {
		return isAdmin ? ("approved" as const) : ("pending_admin_approval" as const);
	}

	return "approved" as const;
};

const getInitialChannelStatuses = (option: ReportDeliveryOption) => ({
	pdfStatus: "not_generated" as const,
	emailStatus:
		option === "email" || option === "email_whatsapp"
			? ("pending" as const)
			: ("not_applicable" as const),
	whatsappStatus:
		option === "whatsapp" || option === "email_whatsapp"
			? ("pending" as const)
			: ("not_applicable" as const),
});

const getStatusForSubmitAction = ({
	reportType,
	deliveryOption,
	isAdmin,
	submitAction,
}: {
	reportType: "client" | "internal" | "shared";
	deliveryOption: ReportDeliveryOption;
	isAdmin: boolean;
	submitAction?: z.infer<typeof reportSubmitActionSchema>;
}) => {
	if (submitAction === "draft") {
		return "draft" as const;
	}

	if (submitAction === "save" || submitAction === "send") {
		if (reportType === "client") {
			return isAdmin ? ("approved" as const) : ("pending_admin_approval" as const);
		}

		return "approved" as const;
	}

	return getInitialStatus({
		reportType,
		deliveryOption,
		isAdmin,
	});
};

const getChannelStatusesForSubmitAction = ({
	deliveryOption,
	submitAction,
}: {
	deliveryOption: ReportDeliveryOption;
	submitAction?: z.infer<typeof reportSubmitActionSchema>;
}) => {
	if (submitAction) {
		return {
			pdfStatus: "not_generated" as const,
			emailStatus: "not_applicable" as const,
			whatsappStatus: "not_applicable" as const,
		};
	}

	return getInitialChannelStatuses(deliveryOption);
};

export async function POST(req: NextRequest) {
	const { user } = await authenticate(req);

	if (!canAccessActivity(user)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = await req.json();
		const parsed = createReportSchema.safeParse(body);

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

		const hasAccess = await userCanAccessProjectActivity(parsed.data.projectId, user ?? {});
		if (!hasAccess) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		const isAdmin = hasRole(user, ["admin", "moderator"]);
		const requestedPermissions = isAdmin ? dedupePermissions(parsed.data.permissions) : [];
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

		const initialStatus = getStatusForSubmitAction({
			reportType: parsed.data.reportType,
			deliveryOption: effectiveDeliveryOption,
			isAdmin,
			submitAction: parsed.data.submitAction,
		});
		const initialChannelStatuses = getChannelStatusesForSubmitAction({
			deliveryOption: effectiveDeliveryOption,
			submitAction: parsed.data.submitAction,
		});

		const insertedReports = await db
			.insert(projectReports)
			.values({
				projectId: parsed.data.projectId,
				reportType: parsed.data.reportType,
				title: parsed.data.title.trim(),
				summary: parsed.data.summary?.trim() || null,
				details: parsed.data.details.trim(),
				workDetails: parsed.data.workDetails?.trim() || null,
				attachments: serializeJsonList(parsed.data.attachments),
				recipients: serializeJsonList(normalizedRecipients),
				status: initialStatus,
				authorId: user?.id ?? null,
				pdfStatus: initialChannelStatuses.pdfStatus,
				emailStatus: initialChannelStatuses.emailStatus,
				whatsappStatus: initialChannelStatuses.whatsappStatus,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({ id: projectReports.id });

		const createdReport = insertedReports[0];

		if (requestedPermissions.length > 0) {
			await db.insert(projectReportPermissions).values(
				requestedPermissions.map((permission) => ({
					reportId: createdReport.id,
					userId: permission.userId,
					accessLevel: permission.accessLevel,
					assignedBy: user?.id ?? null,
					createdAt: new Date(),
				}))
			);
		}

		let message: string;
		const shouldProcessImmediately =
			!parsed.data.submitAction &&
			effectiveDeliveryOption !== "draft" &&
			(parsed.data.reportType !== "client" || isAdmin);
		const requestedImmediateClientDelivery =
			parsed.data.reportType === "client" &&
			effectiveDeliveryOption === "email";

		if (shouldProcessImmediately) {
			const result = await getReportPdfPayload({
				reportId: createdReport.id,
				user: user ?? {},
				approvedByName: user?.name || null,
			});

			if ("payload" in result) {
				const { payload } = result;
				const delivery = await deliverClientReport(payload, {
					option: effectiveDeliveryOption,
				});

				const nextStatus =
					parsed.data.reportType === "client" &&
					requestedImmediateClientDelivery &&
					delivery.deliverySucceeded
						? ("sent" as const)
						: initialStatus === "draft"
							? ("draft" as const)
							: ("approved" as const);

				await db
					.update(projectReports)
					.set({
						status: nextStatus,
						pdfStatus: delivery.pdfStatus,
						emailStatus: delivery.emailStatus,
						whatsappStatus: delivery.whatsappStatus,
						lastDeliveryError: delivery.lastDeliveryError,
						sentAt: nextStatus === "sent" ? new Date() : null,
						updatedAt: new Date(),
					})
					.where(eq(projectReports.id, createdReport.id));

				message = delivery.userMessage;
			} else {
				message = "تم إنشاء التقرير، لكن تعذر تحميل بياناته الكاملة بعد الحفظ.";
			}
		} else if (effectiveDeliveryOption === "draft") {
			message = "تم حفظ التقرير كمسودة.";
		} else if (parsed.data.reportType === "client" && !isAdmin) {
			message = "تم إنشاء التقرير وبانتظار موافقة الأدمن.";
		} else {
			message =
				parsed.data.reportType === "client"
					? "تم إنشاء تقرير العميل وهو جاهز للاعتماد أو الإرسال."
					: "تم إنشاء التقرير بنجاح.";
		}

		if (!isAdmin && parsed.data.reportType === "client" && initialStatus === "pending_admin_approval") {
			await recordWorkflowEvent({
				projectId: parsed.data.projectId,
				authorId: user?.id,
				payload: {
					version: 1,
					eventType: "report_submitted_for_review",
					relatedType: "report",
					relatedId: createdReport.id,
					projectId: parsed.data.projectId,
					title: parsed.data.title.trim(),
					summary: parsed.data.summary?.trim() || parsed.data.details.trim().slice(0, 220),
					actorId: user?.id ?? null,
					actorName: user?.name || user?.email || null,
				},
			});
		}

		const details = await getActivityProjectDetails(parsed.data.projectId, user ?? {});
		return NextResponse.json({
			details,
			message,
			reportId: createdReport.id,
		});
	} catch (error) {
		console.error("POST /api/activity/reports error:", error);
		return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
	}
}
