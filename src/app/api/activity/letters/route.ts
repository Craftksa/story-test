import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
		console.log("[letters] create started");
		const body = await req.json();
		console.log("[letters] payload=", {
			projectId: body?.projectId ?? null,
			recipientName: body?.recipientName ?? null,
			subject: body?.subject ?? null,
			letterDate: body?.letterDate ?? null,
			attachmentsCount: Array.isArray(body?.attachments) ? body.attachments.length : 0,
			bodyLength: typeof body?.body === "string" ? body.body.length : 0,
			userId: user?.id ?? null,
		});
		const parsed = createLetterSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid letter data", issues: parsed.error.errors },
				{ status: 400 }
			);
		}

		const hasAccess = await userCanAccessProjectActivity(parsed.data.projectId, user ?? {});
		console.log(`[letters] project access ok=${hasAccess}`);
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
		const errorCode =
			error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
		const errorMessage =
			error instanceof Error ? error.message : typeof error === "string" ? error : "unknown";

		if (errorCode === "42P01") {
			console.error(
				"[letters] create failed error=project_letter table is missing. Run the letters migration first.",
				{ code: errorCode, message: errorMessage }
			);
		} else {
			console.error("[letters] create failed error=", {
				code: errorCode,
				message: errorMessage,
				error,
			});
		}
		return NextResponse.json({ error: "Failed to create letter" }, { status: 500 });
	}
}
