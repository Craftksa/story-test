import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { projectAssignments, projects, users } from "@/drizzle/schema";
import { hasRole } from "@/lib/utils";
import { sendCorrespondenceEmail } from "@/lib/email";

export type CorrespondenceUser = { id?: string; role?: string | null };
export type CorrespondenceType = "reports" | "letters" | "notes";
export const isReviewer = (user: CorrespondenceUser) => hasRole(user, ["moderator"]);
export const isStaff = (user: CorrespondenceUser) => hasRole(user, ["admin", "moderator", "employee"]);

export const getAccessibleProjectIds = async (user: CorrespondenceUser) => {
	if (!user.id || !user.role) return [];
	if (isReviewer(user)) {
		const rows = await db.select({ id: projects.id }).from(projects);
		return rows.map((row) => row.id);
	}
	if (user.role === "employee") {
		const rows = await db.select({ id: projectAssignments.projectId }).from(projectAssignments).where(eq(projectAssignments.userId, user.id));
		return rows.map((row) => row.id);
	}
	if (user.role === "client") {
		const rows = await db.select({ id: projects.id }).from(projects).where(eq(projects.clientId, user.id));
		return rows.map((row) => row.id);
	}
	return [];
};

export const canAccessProject = async (projectId: string, user: CorrespondenceUser) =>
	(await getAccessibleProjectIds(user)).includes(projectId);

export const resolveRecipientId = async (projectId: string, recipientType: "owner" | "client", recipientId?: string) => {
	if (recipientType === "client") {
		const rows = await db.select({ id: users.id }).from(projects).innerJoin(users, eq(projects.clientId, users.id)).where(eq(projects.id, projectId));
		return !recipientId || rows[0]?.id === recipientId ? rows[0]?.id ?? null : null;
	}
	if (!recipientId) return null;
	const rows = await db.select({ id: users.id }).from(users).where(and(eq(users.id, recipientId), eq(users.role, "moderator")));
	return rows[0]?.id ?? null;
};

const trustedPdfHosts = () => (process.env.UPLOADTHING_TRUSTED_HOSTS || "utfs.io,ufs.sh").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);

export const validateStoredPdfUrl = async (value: string) => {
	const url = new URL(value);
	const hosts = trustedPdfHosts();
	if (url.protocol !== "https:" || !hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new Error("مصدر PDF غير موثوق.");
	const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
	if (!response.ok) throw new Error("تعذر قراءة ملف PDF.");
	const contentLength = Number(response.headers.get("content-length") || 0);
	if (contentLength > 16 * 1024 * 1024) throw new Error("حجم PDF يتجاوز 16MB.");
	const buffer = Buffer.from(await response.arrayBuffer());
	if (buffer.length > 16 * 1024 * 1024 || buffer.subarray(0, 4).toString() !== "%PDF") throw new Error("الملف ليس PDF صالحًا.");
	return buffer;
};

export const notifyCorrespondenceRecipient = async ({
	recipientId,
	projectName,
	subject,
	content,
	pdfUrl,
	pdfFileName,
}: {
	recipientId: string;
	projectName: string;
	subject: string;
	content: string;
	pdfUrl?: string | null;
	pdfFileName?: string | null;
}) => {
	const rows = await db.select({ email: users.email }).from(users).where(eq(users.id, recipientId));
	const email = rows[0]?.email?.trim();
	if (!email) return false;
	let attachment: { filename: string; content: Buffer } | undefined;
	if (pdfUrl) {
		const buffer = await validateStoredPdfUrl(pdfUrl);
		attachment = { filename: pdfFileName || "document.pdf", content: buffer };
	}
	await sendCorrespondenceEmail({ recipientEmail: email, subject, projectName, content, attachment });
	return true;
};

export const assertReviewable = (type: CorrespondenceType, status: string) => {
	if (type === "reports") return status === "pending_admin_approval";
	return status === "pending_admin_approval";
};

export const approvedStatuses = ["approved", "sent"] as const;

