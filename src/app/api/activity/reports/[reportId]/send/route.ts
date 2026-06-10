import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/authenticate";
import { getActivityProjectDetails, getProjectAndClientById, getReportById } from "@/lib/activity";
import { deliverClientReport } from "@/lib/report-delivery";
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
		const report = await getReportById(params.reportId, user ?? {});
		if (!report) {
			return NextResponse.json({ error: "Report not found" }, { status: 404 });
		}

		if (report.reportType !== "client") {
			return NextResponse.json({ error: "Only client reports can be sent." }, { status: 400 });
		}

		if (!["approved", "sent"].includes(report.status)) {
			return NextResponse.json({ error: "Report must be approved before sending." }, { status: 400 });
		}

		const project = await getProjectAndClientById(report.projectId);
		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		const delivery = await deliverClientReport({
			project,
			report,
			approvedByName: report.approvedByName || user?.name || null,
		}, { option: "email" });

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
		return NextResponse.json({ error: "Failed to send report" }, { status: 500 });
	}
}
