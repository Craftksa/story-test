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
import { db } from "@/drizzle/db";
import { projectLetters } from "@/drizzle/schema";
import { isValidId } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const hasValidEmailAddress = (value?: string | null) =>
	!!value && z.string().email().safeParse(value.trim()).success;

const getLetterSendUserMessage = (error: unknown) => {
	if (error instanceof Error && error.message === "SMTP is not configured.") {
		return "البريد الإلكتروني غير مهيأ لإرسال الخطاب";
	}

	return "فشل إرسال الخطاب عبر البريد الإلكتروني";
};

export async function POST(
	req: NextRequest,
	{ params }: { params: { letterId: string } }
) {
	const { user } = await authenticate(req);

	if (!canAccessActivity(user) || !isValidId(params.letterId)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const canModify = await canUserModifyLetter(params.letterId, user ?? {});
		if (!canModify) {
			return NextResponse.json(
				{ error: "You do not have permission to send this letter." },
				{ status: 403 }
			);
		}

		const letter = await getLetterById(params.letterId, user ?? {});
		if (!letter) {
			return NextResponse.json({ error: "Letter not found" }, { status: 404 });
		}

		const project = await getProjectAndClientById(letter.projectId);
		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		if (!hasValidEmailAddress(project.clientEmail)) {
			return NextResponse.json(
				{ error: "البريد الإلكتروني مطلوب لإرسال الخطاب" },
				{ status: 400 }
			);
		}

		await sendProjectLetterEmail({
			projectName: project.name,
			recipientEmail: project.clientEmail!,
			recipientName: letter.recipientName,
			letterSubject: letter.subject,
			letterBody: letter.body,
			letterDate: letter.letterDate,
			attachments: letter.attachments,
		});

		await db
			.update(projectLetters)
			.set({
				status: "ready",
				updatedAt: new Date(),
			})
			.where(eq(projectLetters.id, params.letterId));

		const details = await getActivityProjectDetails(letter.projectId, user ?? {});
		return NextResponse.json({
			details,
			message: "تم إرسال الخطاب عبر البريد الإلكتروني بنجاح",
		});
	} catch (error) {
		console.error("POST /api/activity/letters/[letterId]/send error:", error);
		return NextResponse.json(
			{ error: getLetterSendUserMessage(error) },
			{ status: 500 }
		);
	}
}
