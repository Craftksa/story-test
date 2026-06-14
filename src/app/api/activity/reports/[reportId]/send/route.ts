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

const formatDeliveryErrorWithDebug = (
	message: string,
	diagnostic?: {
		whatsappStageReached?: string | null;
		metaUploadStatus?: number | null;
		metaErrorCode?: number | null;
		metaErrorSubcode?: number | null;
		metaErrorType?: string | null;
		metaErrorMessage?: string | null;
	} | null
) => {
	if (!diagnostic) {
		return message;
	}

	const parts: string[] = [];

	if (diagnostic.whatsappStageReached) {
		parts.push(`stage: ${diagnostic.whatsappStageReached}`);
	}

	if (typeof diagnostic.metaUploadStatus === "number") {
		parts.push(`status: ${diagnostic.metaUploadStatus}`);
	}

	if (typeof diagnostic.metaErrorCode === "number") {
		parts.push(`code: ${diagnostic.metaErrorCode}`);
	}

	if (typeof diagnostic.metaErrorSubcode === "number") {
		parts.push(`subcode: ${diagnostic.metaErrorSubcode}`);
	}

	if (diagnostic.metaErrorType) {
		parts.push(`type: ${diagnostic.metaErrorType}`);
	}

	if (diagnostic.metaErrorMessage) {
		parts.push(diagnostic.metaErrorMessage);
	}

	return parts.length > 0 ? `${message} — ${parts.join(" — ")}` : message;
};

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

		const delivery = await deliverClientReport(payload);
		const nextStatus = delivery.deliverySucceeded ? "sent" : report.status;
		const sentAt =
			nextStatus === "sent"
				? new Date()
				: report.sentAt
					? new Date(report.sentAt)
					: null;

		await db
			.update(projectReports)
			.set({
				status: nextStatus,
				pdfStatus: delivery.pdfStatus,
				emailStatus: delivery.emailStatus,
				whatsappStatus: delivery.whatsappStatus,
				lastDeliveryError: delivery.lastDeliveryError,
				sentAt,
				updatedAt: new Date(),
			})
			.where(eq(projectReports.id, params.reportId));

		if (!delivery.deliverySucceeded) {
			const failureDebug = delivery.diagnostic ?? null;
			const failureMessage = formatDeliveryErrorWithDebug(delivery.userMessage, failureDebug);

			console.error("POST /api/activity/reports/[reportId]/send delivery failed", {
				hasDebug: !!failureDebug,
				whatsappStageReached: failureDebug?.whatsappStageReached ?? null,
				metaUploadStatus: failureDebug?.metaUploadStatus ?? null,
				metaErrorCode: failureDebug?.metaErrorCode ?? null,
				metaErrorMessage: failureDebug?.metaErrorMessage ?? null,
			});

			return NextResponse.json(
				{
					error: failureMessage,
					debug: failureDebug,
				},
				{
					status: delivery.failureStatusCode ?? 502,
				}
			);
		}

		const details = await getActivityProjectDetails(report.projectId, user ?? {});
		return NextResponse.json({
			details,
			message: delivery.userMessage,
		});
	} catch (error) {
		console.error("POST /api/activity/reports/[reportId]/send error:", error);
		const userMessage = getReportPdfUserMessage(error, "فشل إرسال التقرير");
		return NextResponse.json({ error: userMessage }, { status: 500 });
	}
}
