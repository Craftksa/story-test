import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/authenticate";
import { getActivityProjectDetails, getProjectAndClientById, getReportById } from "@/lib/activity";
import { deliverClientReport } from "@/lib/report-delivery";
import { db } from "@/drizzle/db";
import { projectReports } from "@/drizzle/schema";
import { hasRole, isValidId } from "@/lib/utils";

const approvalSchema = z.object({
	decision: z.enum(["approve", "reject"]),
	reason: z.string().max(2000).optional().nullable(),
});

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

			const emailCompleted = emailStatus === "sent" || emailStatus === "not_applicable" || emailStatus === "not_configured";
			const whatsappCompleted =
				whatsappStatus === "sent" ||
				whatsappStatus === "not_applicable" ||
				whatsappStatus === "not_configured";

			if (pdfStatus === "generated" && emailCompleted && whatsappCompleted) {
				nextStatus = "sent";
				sentAt = new Date();
			}
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

		const details = await getActivityProjectDetails(report.projectId, user ?? {});
		return NextResponse.json({
			details,
			message:
				report.reportType === "client"
					? deliveryMessageFromStatuses({
						pdfStatus,
						emailStatus,
						whatsappStatus,
						lastDeliveryError,
					})
					: "تم اعتماد التقرير الداخلي بنجاح.",
		});
	} catch (error) {
		console.error("PATCH /api/activity/reports/[reportId]/approval error:", error);
		return NextResponse.json({ error: "Failed to process approval" }, { status: 500 });
	}
}

const deliveryMessageFromStatuses = ({
	pdfStatus,
	emailStatus,
	whatsappStatus,
	lastDeliveryError,
}: {
	pdfStatus: "not_generated" | "generated" | "failed";
	emailStatus: string;
	whatsappStatus: string;
	lastDeliveryError: string | null;
}) => {
	if (pdfStatus === "failed") {
		return lastDeliveryError || "تم اعتماد التقرير لكن تعذر توليد ملف PDF.";
	}

	if (emailStatus === "not_configured" || whatsappStatus === "not_configured") {
		return "تم إنشاء التقرير وملف PDF، لكن لم يتم الإرسال بسبب عدم إعداد خدمة البريد أو الواتساب.";
	}

	if (emailStatus === "failed" || whatsappStatus === "failed") {
		return lastDeliveryError || "تم إنشاء التقرير وملف PDF، لكن فشل الإرسال عبر إحدى القنوات.";
	}

	return "تم اعتماد التقرير وإنشاء ملف PDF ومحاولة الإرسال بنجاح.";
};
