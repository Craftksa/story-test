import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/authenticate";
import {
	canAccessActivity,
	getActivityProjectDetails,
	serializeJsonList,
	userCanAccessProjectActivity,
} from "@/lib/activity";
import { db } from "@/drizzle/db";
import { projectLetters } from "@/drizzle/schema";

const attachmentSchema = z.object({
	url: z.string().url(),
	name: z.string().optional().nullable(),
	type: z.string().optional().nullable(),
});

const createLetterSchema = z.object({
	projectId: z.string().min(1),
	recipientName: z.string().min(2).max(180),
	subject: z.string().min(2).max(200),
	letterDate: z.string().optional().nullable(),
	body: z.string().min(5).max(12000),
	attachments: z.array(attachmentSchema).optional().default([]),
});

export async function POST(req: NextRequest) {
	const { user } = await authenticate(req);

	if (!canAccessActivity(user)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = await req.json();
		const parsed = createLetterSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid letter data", issues: parsed.error.errors },
				{ status: 400 }
			);
		}

		const hasAccess = await userCanAccessProjectActivity(parsed.data.projectId, user ?? {});
		if (!hasAccess) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		await db.insert(projectLetters).values({
			projectId: parsed.data.projectId,
			recipientName: parsed.data.recipientName.trim(),
			subject: parsed.data.subject.trim(),
			letterDate: parsed.data.letterDate ? new Date(parsed.data.letterDate) : null,
			body: parsed.data.body.trim(),
			attachments: serializeJsonList(parsed.data.attachments),
			status: "ready",
			authorId: user?.id ?? null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const details = await getActivityProjectDetails(parsed.data.projectId, user ?? {});
		return NextResponse.json({
			details,
			message: "تم إنشاء الخطاب بنجاح.",
		});
	} catch (error) {
		console.error("POST /api/activity/letters error:", error);
		return NextResponse.json({ error: "Failed to create letter" }, { status: 500 });
	}
}
