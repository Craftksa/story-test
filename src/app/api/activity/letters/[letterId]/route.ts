import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/authenticate";
import {
	canAccessActivity,
	canUserModifyLetter,
	getActivityProjectDetails,
	getLetterById,
	serializeJsonList,
} from "@/lib/activity";
import { db } from "@/drizzle/db";
import { projectLetters } from "@/drizzle/schema";
import { isValidId } from "@/lib/utils";

const attachmentSchema = z.object({
	url: z.string().url(),
	name: z.string().optional().nullable(),
	type: z.string().optional().nullable(),
});

const updateLetterSchema = z.object({
	recipientName: z.string().min(2).max(180),
	subject: z.string().min(2).max(200),
	letterDate: z.string().optional().nullable(),
	body: z.string().min(5).max(12000),
	attachments: z.array(attachmentSchema).optional().default([]),
});

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ letterId: string }> }
) {
	const { letterId } = await params;
	const { user } = await authenticate(req);

	if (!canAccessActivity(user) || !isValidId(letterId)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const letter = await getLetterById(letterId, user ?? {});
		if (!letter) {
			return NextResponse.json({ error: "Letter not found" }, { status: 404 });
		}

		return NextResponse.json(letter);
	} catch (error) {
		console.error("GET /api/activity/letters/[letterId] error:", error);
		return NextResponse.json({ error: "Failed to load letter" }, { status: 500 });
	}
}

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ letterId: string }> }
) {
	const { letterId } = await params;
	const { user } = await authenticate(req);

	if (!canAccessActivity(user) || !isValidId(letterId)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const canModify = await canUserModifyLetter(letterId, user ?? {});
		if (!canModify) {
			return NextResponse.json(
				{ error: "You do not have permission to edit this letter." },
				{ status: 403 }
			);
		}

		const existingLetter = await getLetterById(letterId, user ?? {});
		if (!existingLetter) {
			return NextResponse.json({ error: "Letter not found" }, { status: 404 });
		}

		const body = await req.json();
		const parsed = updateLetterSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid letter data", issues: parsed.error.errors },
				{ status: 400 }
			);
		}

		await db
			.update(projectLetters)
			.set({
				recipientName: parsed.data.recipientName.trim(),
				subject: parsed.data.subject.trim(),
				letterDate: parsed.data.letterDate ? new Date(parsed.data.letterDate) : null,
				body: parsed.data.body.trim(),
				attachments: serializeJsonList(parsed.data.attachments),
				status: "ready",
				updatedAt: new Date(),
			})
			.where(eq(projectLetters.id, letterId));

		const details = await getActivityProjectDetails(existingLetter.projectId, user ?? {});
		return NextResponse.json({
			details,
			message: "تم تحديث الخطاب بنجاح.",
		});
	} catch (error) {
		console.error("PATCH /api/activity/letters/[letterId] error:", error);
		return NextResponse.json({ error: "Failed to update letter" }, { status: 500 });
	}
}
