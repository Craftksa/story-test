import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/authenticate";
import { getActivityProjectDetails } from "@/lib/activity";
import { deliverClientReport } from "@/lib/report-delivery";
import { getReportPdfPayload, getReportPdfUserMessage } from "@/lib/report-pdf";
import { db } from "@/drizzle/db";
import { projectReports } from "@/drizzle/schema";
import { hasRole, isValidId } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
	req: NextRequest,
	{ params }: { params: { reportId: string } }
) {
	const { user } = await authenticate(req);

	if (!hasRole(user, ["admin", "moderator"]) || !isValidId(params.reportId)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const result = await getReportPdfPayload({
			reportId: params.reportId,
			user: user ?? {},
			approvedByName: user?.name || null,
		});
		if ("error" in result && result.error === "report_not_found") {
			return NextResponse.json({ error: "Report not found" }, { status: 404 });
		}
		if ("error" in result && result.error === "project_not_found") {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		const { payload } = result;
		const { report } = payload;

		if (report.reportType !== "client") {
			return NextResponse.json({ error: "Only client reports can be sent." }, { status: 400 });
		}

		if (!["approved", "sent"].includes(report.status)) {
			return NextResponse.json({ error: "Report must be approved before sending." }, { status: 400 });
		}

		const delivery = await deliverClientReport(payload, { option: "email" });

		const emailSentSuccessfully =
			delivery.pdfStatus === "generated" && delivery.emailOutcome === "success";

		if (!emailSentSuccessfully) {
			return NextResponse.json(
				{ error: delivery.userMessage },
				{
					status:
						delivery.emailOutcome === "not_configured" || delivery.emailOutcome === "skipped"
							? 400
							: 502,
				}
			);
		}

		await db
			.update(projectReports)
			.set({
				status: "sent",
				pdfStatus: delivery.pdfStatus,
				emailStatus: delivery.emailStatus,
				whatsappStatus: delivery.whatsappStatus,
				lastDeliveryError: delivery.lastDeliveryError,
				sentAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(projectReports.id, params.reportId));

		const details = await getActivityProjectDetails(report.projectId, user ?? {});
		return NextResponse.json({
			details,
			message: delivery.userMessage,
		});
	} catch (error) {
		console.error("POST /api/activity/reports/[reportId]/send error:", error);
		const userMessage = getReportPdfUserMessage(error, "فشل إرسال التقرير عبر البريد الإلكتروني");
		return NextResponse.json(
			{ error: userMessage },
			{ status: userMessage === "فشل إرسال التقرير عبر البريد الإلكتروني" ? 500 : 400 }
		);
	}
}
