import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { getProjectAndClientById, getReportById } from "@/lib/activity";
import { generateReportPdfBuffer } from "@/lib/report-delivery";
import { canAccessActivity } from "@/lib/activity";
import { isValidId } from "@/lib/utils";

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

		const project = await getProjectAndClientById(report.projectId);
		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

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
			},
		});
	} catch (error) {
		console.error("GET /api/activity/reports/[reportId]/pdf error:", error);
		return NextResponse.json({ error: "Failed to generate report PDF" }, { status: 500 });
	}
}
