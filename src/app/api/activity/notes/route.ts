import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticate } from "@/lib/authenticate";
import { canAccessActivity, getActivityProjectDetails, userCanAccessProjectActivity } from "@/lib/activity";
import { db } from "@/drizzle/db";
import { projectNotes } from "@/drizzle/schema";

const createNoteSchema = z.object({
	projectId: z.string().min(1),
	content: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
	const { user } = await authenticate(req);

	if (!canAccessActivity(user)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = await req.json();
		const parsed = createNoteSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json({ error: "Invalid note data", issues: parsed.error.errors }, { status: 400 });
		}

		const hasAccess = await userCanAccessProjectActivity(parsed.data.projectId, user ?? {});
		if (!hasAccess) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		await db.insert(projectNotes).values({
			projectId: parsed.data.projectId,
			authorId: user?.id ?? null,
			content: parsed.data.content.trim(),
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const details = await getActivityProjectDetails(parsed.data.projectId, user ?? {});
		return NextResponse.json(details);
	} catch (error) {
		console.error("POST /api/activity/notes error:", error);
		return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
	}
}
