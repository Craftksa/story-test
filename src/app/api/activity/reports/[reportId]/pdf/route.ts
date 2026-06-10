import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { canAccessActivity } from "@/lib/activity";
import {
	generateReportPdfBuffer,
	getReportPdfFileName,
	getReportPdfPayload,
	getReportPdfUserMessage,
	logPdfErrorDetails,
	PDF_VIEW_FAILURE_MESSAGE,
} from "@/lib/report-pdf";
import { isValidId } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
	req: NextRequest,
	{ params }: { params: { reportId: string } }
) {
	console.log("[pdf-route] request started");
	console.log(`[pdf-route] reportId=${params.reportId}`);
	const { user } = await authenticate(req);

	if (!canAccessActivity(user) || !isValidId(params.reportId)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const result = await getReportPdfPayload({
			reportId: params.reportId,
			user: user ?? {},
		});
		if ("error" in result && result.error === "report_not_found") {
			return NextResponse.json({ error: "Report not found" }, { status: 404 });
		}
		if ("error" in result && result.error === "project_not_found") {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		console.log("[pdf-route] before generateReportPdf");
		const { payload } = result;
		const pdfBuffer = await generateReportPdfBuffer(payload);

		return new NextResponse(pdfBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `inline; filename="${getReportPdfFileName(payload.report.id)}"`,
				"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
				Pragma: "no-cache",
				Expires: "0",
			},
		});
	} catch (error) {
		console.error("[pdf-route] failed");
		console.error(
			`[pdf-route] error message=${error instanceof Error ? error.message : String(error)}`
		);
		console.error(
			`[pdf-route] error stack=${error instanceof Error ? error.stack || "null" : "null"}`
		);
		console.error(
			`[pdf-route] error cause=${
				error instanceof Error && error.cause ? JSON.stringify(error.cause) : "null"
			}`
		);
		logPdfErrorDetails("GET /api/activity/reports/[reportId]/pdf", error, {
			reportId: params.reportId,
		});
		const userMessage = getReportPdfUserMessage(error, PDF_VIEW_FAILURE_MESSAGE);
		return NextResponse.json(
			{ error: userMessage },
			{ status: userMessage === PDF_VIEW_FAILURE_MESSAGE ? 500 : 400 }
		);
	}
}
