import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { canAccessActivity, getProjectAndClientById, getReportById } from "@/lib/activity";
import {
	generateReportPdfBuffer,
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
		const report = await getReportById(params.reportId, user ?? {});
		if (!report) {
			return NextResponse.json({ error: "Report not found" }, { status: 404 });
		}

		const project = await getProjectAndClientById(report.projectId);
		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		console.log("[pdf-route] before generateReportPdf");
		const pdfBuffer = await generateReportPdfBuffer({
			project,
			report,
			approvedByName: report.approvedByName,
		});

		return new NextResponse(pdfBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `inline; filename="${encodeURIComponent(report.title)}.pdf"`,
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
		return NextResponse.json({ error: PDF_VIEW_FAILURE_MESSAGE }, { status: 500 });
	}
}
