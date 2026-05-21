import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { authenticate } from "@/lib/authenticate";
import {
	canAccessActivity,
	getActivityProjectDetails,
	serializeJsonList,
	userCanAccessProjectActivity,
} from "@/lib/activity";
import { db } from "@/drizzle/db";
import { projectReportPermissions, projectReports, users } from "@/drizzle/schema";
import { hasRole } from "@/lib/utils";

const recipientSchema = z.object({
	name: z.string().min(1),
	email: z.string().email().optional().or(z.literal("")).nullable(),
	phone: z.string().optional().or(z.literal("")).nullable(),
	channel: z.enum(["email", "whatsapp", "both"]).optional(),
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
});

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

		const hasAccess = await userCanAccessProjectActivity(parsed.data.projectId, user ?? {});
		if (!hasAccess) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		const isAdmin = hasRole(user, ["admin", "moderator"]);
		const requestedPermissions = isAdmin ? parsed.data.permissions : [];
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

		const status =
			parsed.data.reportType === "client"
				? isAdmin
					? "approved"
					: "pending_admin_approval"
				: "approved";

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
				recipients: serializeJsonList(
					parsed.data.recipients.map((recipient) => ({
						name: recipient.name.trim(),
						email: recipient.email?.trim() || null,
						phone: recipient.phone?.trim() || null,
						channel: recipient.channel ?? "both",
					}))
				),
				status,
				authorId: user?.id ?? null,
				emailStatus: parsed.data.reportType === "client" ? "pending" : "not_applicable",
				whatsappStatus: parsed.data.reportType === "client" ? "pending" : "not_applicable",
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

		const details = await getActivityProjectDetails(parsed.data.projectId, user ?? {});
		return NextResponse.json({
			details,
			message:
				parsed.data.reportType === "client" && !isAdmin
					? "تم إنشاء التقرير وبانتظار موافقة الأدمن."
					: parsed.data.reportType === "client"
						? "تم إنشاء تقرير العميل وهو جاهز للاعتماد أو الإرسال."
						: "تم إنشاء التقرير الداخلي بنجاح.",
		});
	} catch (error) {
		console.error("POST /api/activity/reports error:", error);
		return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
	}
}
