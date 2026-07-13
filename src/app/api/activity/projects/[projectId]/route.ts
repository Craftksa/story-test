import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { canAccessActivity, getActivityProjectDetails } from "@/lib/activity";
import { isValidId } from "@/lib/utils";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ projectId: string }> }
) {
	const { projectId } = await params;
	const { user } = await authenticate(req);

	if (!canAccessActivity(user)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	if (!isValidId(projectId)) {
		return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
	}

	try {
		const payload = await getActivityProjectDetails(projectId, user ?? {});
		if (!payload) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		return NextResponse.json(payload);
	} catch (error) {
		console.error("GET /api/activity/projects/[projectId] error:", error);
		return NextResponse.json({ error: "Failed to load project activity details" }, { status: 500 });
	}
}
