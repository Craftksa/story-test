import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authenticate } from "@/lib/authenticate";
import {
	canAccessActivity,
	canUserModifyLetter,
	getActivityProjectDetails,
	getLetterById,
	getProjectAndClientById,
} from "@/lib/activity";
import { sendProjectLetterEmail } from "@/lib/email";
import {
	generateLetterPdfBuffer,
	getLetterPdfFileName,
	getReportPdfUserMessage,
} from "@/lib/report-pdf";
import { db } from "@/drizzle/db";
import { projectLetters } from "@/drizzle/schema";
import { isValidId } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const hasValidEmailAddress = (value?: string | null) =>
	!!value && z.string().email().safeParse(value.trim()).success;

const sendLetterSchema = z.object({
	recipientEmail: z.string().email(),
});

const getLetterSendUserMessage = (error: unknown) => {
	if (error instanceof Error && error.message === "SMTP is not configured.") {
		return "البريد الإلكتروني غير مهيأ لإرسال الخطاب";
	}

	return "فشل إرسال الخطاب عبر البريد الإلكتروني";
};

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ letterId: string }> }
) {
	const { letterId } = await params;
	const { user } = await authenticate(req);

	if (!canAccessActivity(user) || !isValidId(letterId)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = await req.json().catch(() => null);
		const parsed = sendLetterSchema.safeParse(body);
		if (!parsed.success || !hasValidEmailAddress(parsed.data.recipientEmail)) {
			return NextResponse.json(
				{ error: "البريد الإلكتروني مطلوب لإرسال الخطاب" },
				{ status: 400 }
			);
		}

		const canModify = await canUserModifyLetter(letterId, user ?? {});
		if (!canModify) {
			return NextResponse.json(
				{ error: "You do not have permission to send this letter." },
				{ status: 403 }
			);
		}

		const letter = await getLetterById(letterId, user ?? {});
		if (!letter) {
			return NextResponse.json({ error: "Letter not found" }, { status: 404 });
		}
		if (!(["approved", "sent"] as string[]).includes(letter.status)) {
			return NextResponse.json({ error: "لا يمكن إرسال الخطاب قبل اعتماده." }, { status: 409 });
		}

		const project = await getProjectAndClientById(letter.projectId);
		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		const pdfBuffer = await generateLetterPdfBuffer({
			project,
			letter,
		});

		await sendProjectLetterEmail({
			projectName: project.name,
			recipientEmail: parsed.data.recipientEmail.trim(),
			recipientName: letter.recipientName,
			letterSubject: letter.subject,
			pdfBuffer,
			attachmentFileName: getLetterPdfFileName(letter.id),
		});

		await db
			.update(projectLetters)
			.set({
				status: "sent",
				sentAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(projectLetters.id, letterId));

		const details = await getActivityProjectDetails(letter.projectId, user ?? {});
		return NextResponse.json({
			details,
			message: "تم إرسال الخطاب عبر البريد الإلكتروني بنجاح",
		});
	} catch (error) {
		console.error("POST /api/activity/letters/[letterId]/send error:", error);
		return NextResponse.json(
			{ error: getReportPdfUserMessage(error, getLetterSendUserMessage(error)) },
			{ status: 500 }
		);
	}
}
