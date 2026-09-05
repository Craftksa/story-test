import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { authenticate } from "@/lib/authenticate";
import { db } from "@/drizzle/db";
import { projectReports, projects, users } from "@/drizzle/schema";
import { generateReportPdfBuffer, getReportPdfFileName } from "@/lib/report-pdf";
import type { ActivityReport } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ reportId: string }> }
) {
	const { user } = await authenticate(_request);
	const { reportId } = await params;
	if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const rows = await db.select({
		report: projectReports,
		project: projects,
		authorName: users.name,
	})
		.from(projectReports)
		.innerJoin(projects, eq(projectReports.projectId, projects.id))
		.leftJoin(users, eq(projectReports.authorId, users.id))
		.where(and(eq(projectReports.id, reportId), inArray(projectReports.status, ["approved", "sent"])));
	const row = rows[0];
	if (!row) return NextResponse.json({ error: "Report not found" }, { status: 404 });
	const isRecipient = row.report.recipientId === user.id;
	const isStaff = ["employee", "moderator", "admin"].includes(user.role);
	if (!isRecipient && !isStaff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	const report = {
		id: row.report.id,
		projectId: row.report.projectId,
		reportType: row.report.reportType,
		title: row.report.title,
		summary: row.report.summary,
		details: row.report.details,
		workDetails: row.report.workDetails,
		attachments: [],
		recipients: [],
		status: row.report.status,
		authorId: row.report.authorId,
		authorName: row.authorName || "Craft Flow",
		approvedBy: row.report.approvedBy,
		approvedByName: null,
		approvedAt: row.report.approvedAt?.toISOString() ?? null,
		rejectionReason: row.report.rejectionReason,
		adminDecisionNote: row.report.adminDecisionNote,
		pdfStatus: row.report.pdfStatus,
		emailStatus: row.report.emailStatus,
		whatsappStatus: row.report.whatsappStatus,
		lastDeliveryError: row.report.lastDeliveryError,
		sentAt: row.report.sentAt?.toISOString() ?? null,
		createdAt: row.report.createdAt?.toISOString() ?? null,
		updatedAt: row.report.updatedAt?.toISOString() ?? null,
		permissions: [],
		canEdit: false,
		canApprove: false,
		canSendToClient: false,
	} as ActivityReport;
	const pdf = await generateReportPdfBuffer({
		project: {
			id: row.project.id,
			name: row.project.name,
			city: row.project.city,
			district: row.project.district,
			clientName: null,
			clientEmail: null,
			description: row.project.description,
		},
		report,
	});
	return new NextResponse(pdf, {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `inline; filename="${getReportPdfFileName(reportId)}"`,
			"Cache-Control": "private, no-store",
		},
	});
}