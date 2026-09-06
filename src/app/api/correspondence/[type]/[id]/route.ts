import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authenticate } from "@/lib/authenticate";
import { db } from "@/drizzle/db";
import { projectLetters, projectNotes, projectReports, projects } from "@/drizzle/schema";
import { canAccessProject, isReviewer, isStaff, notifyCorrespondenceRecipient, resolveRecipientId } from "@/lib/correspondence";

const actionSchema = z.object({
	action: z.enum(["save", "submit", "approve", "reject"]),
	reason: z.string().max(2000).optional(),
	title: z.string().max(200).optional(), summary: z.string().max(2000).optional(), details: z.string().max(20000).optional(),
	recipientName: z.string().max(180).optional(), subject: z.string().max(200).optional(), body: z.string().max(12000).optional(),
	content: z.string().max(4000).optional(),
	recipientType: z.enum(["owner", "client"]).optional(), recipientId: z.string().optional(),
});
type Params = { params: Promise<{ type: string; id: string }> };

const tableFor = (type: string) => type === "reports" ? projectReports : type === "letters" ? projectLetters : type === "notes" ? projectNotes : null;

export async function PATCH(req: NextRequest, { params }: Params) {
	const { user } = await authenticate(req);
	if (!user || !isStaff(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	const { type, id } = await params;
	const action = actionSchema.safeParse(await req.json().catch(() => null));
	if (!action.success) return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
	const table = tableFor(type);
	if (!table) return NextResponse.json({ error: "نوع غير صالح" }, { status: 400 });

	const rows = await db.select().from(table).where(eq(table.id, id));
	const item = rows[0] as { projectId?: string; status?: string; authorId?: string | null; content?: string; title?: string; details?: string; subject?: string; body?: string; pdfUrl?: string | null; pdfFileName?: string | null; recipientType?: "owner" | "client"; recipientId?: string | null } | undefined;
	if (!item?.projectId || !await canAccessProject(item.projectId, user)) return NextResponse.json({ error: "Not found" }, { status: 404 });
	if (action.data.action === "save") {
		if (item.authorId !== user.id && !isReviewer(user)) return NextResponse.json({ error: "لا تملك صلاحية التعديل" }, { status: 403 });
		if (type === "notes" && item.content?.startsWith("__CRAFT_ACTIVITY__:")) return NextResponse.json({ error: "لا يمكن تعديل ملاحظة نظامية" }, { status: 409 });
		if (!["draft", "rejected"].includes(item.status ?? "")) return NextResponse.json({ error: "لا يمكن تعديل هذا المحتوى الآن" }, { status: 409 });
		const recipientType = action.data.recipientType ?? item.recipientType ?? "owner";
		const recipientId = await resolveRecipientId(item.projectId, recipientType, action.data.recipientId ?? item.recipientId ?? undefined);
		if (!recipientId) return NextResponse.json({ error: "المستلم الموثوق غير صالح" }, { status: 400 });
		const values = type === "reports"
			? { title: action.data.title?.trim(), summary: action.data.summary?.trim() || null, details: action.data.details?.trim(), updatedAt: new Date() }
			: type === "letters"
				? { recipientName: action.data.recipientName?.trim(), subject: action.data.subject?.trim(), body: action.data.body?.trim(), updatedAt: new Date() }
				: { content: action.data.content?.trim(), updatedAt: new Date() };
		await db.update(table).set({ ...values, recipientType, recipientId } as never).where(eq(table.id, id));
		return NextResponse.json({ message: "تم حفظ التعديل." });
	}
	if (action.data.action === "submit") {
		if (item.authorId !== user.id && !isReviewer(user)) return NextResponse.json({ error: "لا تملك صلاحية الإرسال" }, { status: 403 });
		if (type === "notes" && item.content?.startsWith("__CRAFT_ACTIVITY__:")) return NextResponse.json({ error: "لا يمكن تغيير ملاحظة نظامية" }, { status: 409 });
		if (!["draft", "rejected"].includes(item.status ?? "")) return NextResponse.json({ error: "لا يمكن إرسال هذا المحتوى للمراجعة من حالته الحالية" }, { status: 409 });
		const recipientType = item.recipientType ?? "owner";
		const recipientId = await resolveRecipientId(item.projectId, recipientType, item.recipientId ?? undefined);
		if (!recipientId) return NextResponse.json({ error: "المستلم الموثوق غير صالح" }, { status: 400 });
		const nextStatus = recipientType === "client" ? "pending_admin_approval" : "approved";
		await db.update(table).set({ status: nextStatus, recipientId, rejectionReason: null, updatedAt: new Date() } as never).where(eq(table.id, id));
		return NextResponse.json({ message: "تم إرسال المحتوى للمراجعة." });
	}
	if (!isReviewer(user) || item.status !== "pending_admin_approval") return NextResponse.json({ error: "العنصر ليس في انتظار المراجعة" }, { status: 409 });
	if (action.data.action === "reject" && !action.data.reason?.trim()) return NextResponse.json({ error: "سبب الرفض مطلوب" }, { status: 400 });
	const approved = action.data.action === "approve";
	await db.update(table).set({ status: approved ? "approved" : "rejected", approvedBy: user.id, approvedAt: approved ? new Date() : null, rejectionReason: approved ? null : action.data.reason?.trim(), updatedAt: new Date() } as never).where(and(eq(table.id, id), eq(table.status, "pending_admin_approval")));
	if (approved && item.recipientType === "client" && item.recipientId) {
		const project = (await db.select({ name: projects.name }).from(projects).where(eq(projects.id, item.projectId))).at(0);
		if (project) {
			try { await notifyCorrespondenceRecipient({ recipientId: item.recipientId, projectName: project.name, subject: item.title || item.subject || "محتوى معتمد", content: item.details || item.body || item.content || "تم اعتماد محتوى جديد.", pdfUrl: item.pdfUrl, pdfFileName: item.pdfFileName }); } catch (error) { console.error("Client correspondence email failed", error); }
		}
	}
	return NextResponse.json({ message: approved ? "تم اعتماد المحتوى." : "تم رفض المحتوى." });
}