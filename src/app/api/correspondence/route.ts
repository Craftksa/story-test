import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { authenticate } from "@/lib/authenticate";
import { db } from "@/drizzle/db";
import { projectLetters, projectNotes, projectReports, projects, users } from "@/drizzle/schema";
import { canAccessProject, getAccessibleProjectIds, isStaff, notifyCorrespondenceRecipient, resolveRecipientId, validateStoredPdfUrl } from "@/lib/correspondence";

const createSchema = z.object({
	type: z.enum(["reports", "letters", "notes"]),
	action: z.enum(["save", "submit"]).optional().default("save"),
	projectId: z.string().min(1),
	recipientType: z.enum(["owner", "client"]),
	recipientId: z.string().optional(),
	title: z.string().max(200).optional(),
	summary: z.string().max(2000).optional(),
	details: z.string().max(20000).optional(),
	pdfUrl: z.string().url().optional(),
	pdfFileName: z.string().max(255).optional(),
	recipientName: z.string().max(180).optional(),
	subject: z.string().max(200).optional(),
	body: z.string().max(12000).optional(),
	content: z.string().max(4000).optional(),
});


export async function GET(req: NextRequest) {
	const { user } = await authenticate(req);
	if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const userId = user.id;

	const projectIds = await getAccessibleProjectIds(user);
	if (!projectIds.length) return NextResponse.json({ projects: [], reports: [], letters: [], notes: [], owners: [] });
	const client = user.role === "client";
	const visibleStatuses = ["approved", "sent"] as const;
	const projectRows = await db.select({ id: projects.id, name: projects.name, clientId: projects.clientId })
		.from(projects).where(inArray(projects.id, projectIds));

	const reports = await db.select({
		id: projectReports.id, projectId: projectReports.projectId, title: projectReports.title,
		summary: projectReports.summary, details: projectReports.details, reportType: projectReports.reportType,
		recipientType: projectReports.recipientType, recipientId: projectReports.recipientId, pdfUrl: projectReports.pdfUrl, pdfFileName: projectReports.pdfFileName,
		status: projectReports.status, authorId: projectReports.authorId, approvedAt: projectReports.approvedAt,
		rejectionReason: projectReports.rejectionReason, createdAt: projectReports.createdAt, updatedAt: projectReports.updatedAt,
	}).from(projectReports).where(and(
		inArray(projectReports.projectId, projectIds),
		...(client ? [eq(projectReports.recipientType, "client"), eq(projectReports.recipientId, userId), inArray(projectReports.status, visibleStatuses)] : []),
	)).orderBy(desc(projectReports.updatedAt));

	const letters = await db.select({
		id: projectLetters.id, projectId: projectLetters.projectId, recipientName: projectLetters.recipientName,
		subject: projectLetters.subject, body: projectLetters.body, status: projectLetters.status,
		recipientType: projectLetters.recipientType, recipientId: projectLetters.recipientId,
		authorId: projectLetters.authorId, approvedAt: projectLetters.approvedAt, rejectionReason: projectLetters.rejectionReason,
		createdAt: projectLetters.createdAt, updatedAt: projectLetters.updatedAt,
	}).from(projectLetters).where(and(
		inArray(projectLetters.projectId, projectIds),
		...(client ? [eq(projectLetters.recipientType, "client"), eq(projectLetters.recipientId, userId), inArray(projectLetters.status, visibleStatuses)] : []),
	)).orderBy(desc(projectLetters.updatedAt));

	const notes = await db.select({
		id: projectNotes.id, projectId: projectNotes.projectId, content: projectNotes.content,
		recipientType: projectNotes.recipientType, recipientId: projectNotes.recipientId, status: projectNotes.status, authorId: projectNotes.authorId,
		approvedAt: projectNotes.approvedAt, rejectionReason: projectNotes.rejectionReason,
		createdAt: projectNotes.createdAt, updatedAt: projectNotes.updatedAt,
	}).from(projectNotes).where(and(
		inArray(projectNotes.projectId, projectIds),
		...(client ? [eq(projectNotes.recipientType, "client"), eq(projectNotes.recipientId, userId), eq(projectNotes.status, "approved")] : []),
	)).orderBy(desc(projectNotes.updatedAt));

	const owners = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.role, "moderator"));
	return NextResponse.json({ projects: projectRows, reports, letters, notes, owners });
}

export async function POST(req: NextRequest) {
	const { user } = await authenticate(req);
	if (!user || !isStaff(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	const parsed = createSchema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "بيانات المحتوى غير مكتملة" }, { status: 400 });
	const data = parsed.data;
	if (!await canAccessProject(data.projectId, user)) return NextResponse.json({ error: "Project not found" }, { status: 404 });
	const recipientId = await resolveRecipientId(data.projectId, data.recipientType, data.recipientId);
	if (!recipientId) return NextResponse.json({ error: "المستلم الموثوق غير صالح" }, { status: 400 });
	const project = (await db.select({ name: projects.name }).from(projects).where(eq(projects.id, data.projectId)))[0];
	let emailSubject = "مراسلة جديدة";
	let emailContent = "";
	let pdfUrl: string | null = null;
	let pdfFileName: string | null = null;

	if (data.type === "notes") {
		if (!data.content?.trim()) return NextResponse.json({ error: "محتوى الملاحظة مطلوب" }, { status: 400 });
		await db.insert(projectNotes).values({ projectId: data.projectId, content: data.content.trim(), recipientType: data.recipientType, recipientId, status: data.recipientType === "client" && data.action === "submit" ? "pending_admin_approval" : data.recipientType === "client" ? "draft" : "approved", authorId: user.id ?? null, createdAt: new Date(), updatedAt: new Date() });
		emailSubject = "ملاحظة جديدة";
		emailContent = data.content.trim();
	} else if (data.type === "reports") {
		if (!data.title?.trim() || (!data.details?.trim() && !data.pdfUrl)) return NextResponse.json({ error: "عنوان ومحتوى أو PDF التقرير مطلوبان" }, { status: 400 });
		if (data.pdfUrl && !data.pdfFileName?.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "ملف التقرير يجب أن يكون PDF" }, { status: 400 });
		if (data.pdfUrl) {
			try { await validateStoredPdfUrl(data.pdfUrl); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "ملف PDF غير صالح" }, { status: 400 }); }
		}
		await db.insert(projectReports).values({ projectId: data.projectId, reportType: data.recipientType === "client" ? "client" : "internal", title: data.title.trim(), summary: data.summary?.trim() || null, details: data.details?.trim() || "", attachments: data.pdfUrl ? JSON.stringify([{ url: data.pdfUrl, name: data.pdfFileName, type: "application/pdf" }]) : null, recipientType: data.recipientType, recipientId, pdfUrl: data.pdfUrl ?? null, pdfFileName: data.pdfFileName ?? null, status: data.recipientType === "client" && data.action === "submit" ? "pending_admin_approval" : data.recipientType === "client" ? "draft" : "approved", authorId: user.id ?? null, createdAt: new Date(), updatedAt: new Date() });
		emailSubject = data.title.trim();
		emailContent = data.details?.trim() || "تم إنشاء تقرير PDF.";
		pdfUrl = data.pdfUrl ?? null;
		pdfFileName = data.pdfFileName ?? null;
	} else {
		if (!data.subject?.trim() || !data.body?.trim()) return NextResponse.json({ error: "بيانات الخطاب مطلوبة" }, { status: 400 });
		await db.insert(projectLetters).values({ projectId: data.projectId, recipientName: data.recipientName?.trim() || (data.recipientType === "client" ? "العميل" : "الأونر"), subject: data.subject.trim(), body: data.body.trim(), recipientType: data.recipientType, recipientId, status: data.recipientType === "client" && data.action === "submit" ? "pending_admin_approval" : data.recipientType === "client" ? "draft" : "approved", authorId: user.id ?? null, createdAt: new Date(), updatedAt: new Date() });
		emailSubject = data.subject.trim();
		emailContent = data.body.trim();
	}
	if (data.recipientType === "owner" && project?.name) {
		try { await notifyCorrespondenceRecipient({ recipientId, projectName: project.name, subject: emailSubject, content: emailContent, pdfUrl, pdfFileName }); } catch (error) { console.error("Owner correspondence email failed", error); }
	}
	return NextResponse.json({ message: "تم حفظ المسودة." }, { status: 201 });
}