import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { authenticate } from "@/lib/authenticate";
import {
	canAccessActivity,
	canUserModifyReport,
	getActivityProjectDetails,
	getReportById,
	serializeJsonList,
} from "@/lib/activity";
import { db } from "@/drizzle/db";
import { projectReportPermissions, projectReports, users } from "@/drizzle/schema";
import { hasRole, isValidId } from "@/lib/utils";

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

const updateReportSchema = z.object({
	title: z.string().min(3).max(180),
	summary: z.string().max(4000).optional().nullable(),
	details: z.string().min(5).max(12000),
	workDetails: z.string().max(12000).optional().nullable(),
	attachments: z.array(attachmentSchema).optional().default([]),
	recipients: z.array(recipientSchema).optional().default([]),
	permissions: z.array(reportPermissionSchema).optional().default([]),
});

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

		const isAdmin = hasRole(user, ["admin", "moderator"]);
		const requestedPermissions = isAdmin ? parsed.data.permissions : existingReport.permissions;
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

		await db
			.update(projectReports)
			.set({
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

		const details = await getActivityProjectDetails(existingReport.projectId, user ?? {});
		return NextResponse.json({
			details,
			message: "تم تحديث التقرير بنجاح.",
		});
	} catch (error) {
		console.error("PATCH /api/activity/reports/[reportId] error:", error);
		return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
	}
}
