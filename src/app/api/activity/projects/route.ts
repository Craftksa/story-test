import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { canAccessActivity, getActivityProjectsPayload } from "@/lib/activity";

export async function GET(req: NextRequest) {
	const { user } = await authenticate(req);

	if (!canAccessActivity(user)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const payload = await getActivityProjectsPayload(user ?? {});
		return NextResponse.json(payload);
	} catch (error) {
		console.error("GET /api/activity/projects error:", error);
		return NextResponse.json({ error: "Failed to load activity projects" }, { status: 500 });
	}
}
