import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { authenticate } from "@/lib/authenticate";
import { db } from "@/drizzle/db";
import { projectReports } from "@/drizzle/schema";
import { validateStoredPdfUrl } from "@/lib/correspondence";

export const dynamic = "force-dynamic";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ reportId: string }> }
) {
	const { user } = await authenticate(_request);
	const { reportId } = await params;
	if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const rows = await db.select({ pdfUrl: projectReports.pdfUrl, pdfFileName: projectReports.pdfFileName, recipientId: projectReports.recipientId, projectId: projectReports.projectId })
		.from(projectReports)
		.where(and(eq(projectReports.id, reportId), inArray(projectReports.status, ["approved", "sent"])));
	const report = rows[0];
	if (!report?.pdfUrl) return NextResponse.json({ error: "Original PDF not found" }, { status: 404 });
	if (report.recipientId !== user.id && !["employee", "moderator", "admin"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	let buffer: Buffer;
	try { buffer = await validateStoredPdfUrl(report.pdfUrl); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid PDF" }, { status: 422 }); }
	return new NextResponse(buffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${report.pdfFileName || "report.pdf"}"`, "Cache-Control": "private, no-store" } });
}