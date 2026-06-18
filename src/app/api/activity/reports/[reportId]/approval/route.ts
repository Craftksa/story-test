import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/authenticate";
import {
	createActivitySystemNoteContent,
	getActivityProjectDetails,
	getProjectAndClientById,
	getReportById,
} from "@/lib/activity";
import { deliverClientReport } from "@/lib/report-delivery";
import { db } from "@/drizzle/db";
import { projectNotes, projectReports } from "@/drizzle/schema";
import { hasRole, isValidId } from "@/lib/utils";

const approvalSchema = z.object({
	decision: z.enum(["approve", "reject"]),
	reason: z.string().max(2000).optional().nullable(),
});

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

export async function PATCH(
	req: NextRequest,
	{ params }: { params: { reportId: string } }
) {
	const { user } = await authenticate(req);

	if (!hasRole(user, ["admin", "moderator"]) || !isValidId(params.reportId)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = await req.json();
		const parsed = approvalSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: "Invalid approval payload", issues: parsed.error.errors }, { status: 400 });
		}

		const report = await getReportById(params.reportId, user ?? {});
		if (!report) {
			return NextResponse.json({ error: "Report not found" }, { status: 404 });
		}

		if (parsed.data.decision === "reject") {
			if (!parsed.data.reason?.trim()) {
				return NextResponse.json({ error: "Rejection reason is required." }, { status: 400 });
			}

			await db
				.update(projectReports)
				.set({
					status: "rejected",
					rejectionReason: parsed.data.reason.trim(),
					adminDecisionNote: parsed.data.reason.trim(),
					approvedBy: user?.id ?? null,
					approvedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(projectReports.id, params.reportId));

			await recordWorkflowEvent({
				projectId: report.projectId,
				authorId: user?.id,
				payload: {
					version: 1,
					eventType: "report_returned_for_changes",
					relatedType: "report",
					relatedId: report.id,
					projectId: report.projectId,
					title: report.title,
					summary: report.summary || report.details.slice(0, 220),
					actorId: user?.id ?? null,
					actorName: user?.name || user?.email || null,
					note: parsed.data.reason.trim(),
				},
			});

			const details = await getActivityProjectDetails(report.projectId, user ?? {});
			return NextResponse.json({
				details,
				message: "تم رفض التقرير وتسجيل سبب الرفض.",
			});
		}

		let nextStatus: "approved" | "sent" = "approved";
		let pdfStatus: "not_generated" | "generated" | "failed" = report.pdfStatus;
		let emailStatus = report.emailStatus;
		let whatsappStatus = report.whatsappStatus;
		let lastDeliveryError: string | null = null;
		let sentAt: Date | null = null;
		let failureStatusCode = 400;
		let message = "تم اعتماد التقرير الداخلي بنجاح.";

		if (report.reportType === "client") {
			const project = await getProjectAndClientById(report.projectId);
			if (!project) {
				return NextResponse.json({ error: "Project not found" }, { status: 404 });
			}

			const delivery = await deliverClientReport({
				project,
				report,
				approvedByName: user?.name ?? null,
			});

			pdfStatus = delivery.pdfStatus;
			emailStatus = delivery.emailStatus;
			whatsappStatus = delivery.whatsappStatus;
			lastDeliveryError = delivery.lastDeliveryError;
			message = delivery.userMessage;
			failureStatusCode = delivery.failureStatusCode ?? 400;
			nextStatus = delivery.deliverySucceeded ? "sent" : "approved";
			sentAt = delivery.deliverySucceeded ? new Date() : null;
		}

		await db
			.update(projectReports)
			.set({
				status: nextStatus,
				rejectionReason: null,
				adminDecisionNote: parsed.data.reason?.trim() || null,
				approvedBy: user?.id ?? null,
				approvedAt: new Date(),
				pdfStatus,
				emailStatus,
				whatsappStatus,
				lastDeliveryError,
				sentAt,
				updatedAt: new Date(),
			})
			.where(eq(projectReports.id, params.reportId));

		await recordWorkflowEvent({
			projectId: report.projectId,
			authorId: user?.id,
			payload: {
				version: 1,
				eventType: nextStatus === "sent" ? "report_sent" : "report_send_failed",
				relatedType: "report",
				relatedId: report.id,
				projectId: report.projectId,
				title: report.title,
				summary: nextStatus === "sent" ? message : lastDeliveryError || message,
				actorId: user?.id ?? null,
				actorName: user?.name || user?.email || null,
				note: nextStatus === "sent" ? null : lastDeliveryError || message,
			},
		});

		if (report.reportType === "client" && nextStatus !== "sent") {
			return NextResponse.json(
				{ error: message },
				{
					status: failureStatusCode,
				}
			);
		}

		const details = await getActivityProjectDetails(report.projectId, user ?? {});
		return NextResponse.json({
			details,
			message,
		});
	} catch (error) {
		console.error("PATCH /api/activity/reports/[reportId]/approval error:", error);
		return NextResponse.json({ error: "Failed to process approval" }, { status: 500 });
	}
}
