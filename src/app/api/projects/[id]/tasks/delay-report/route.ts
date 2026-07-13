import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { getProjectDelayReport } from "@/lib/activity";
import { hasRole, isValidId } from "@/lib/utils";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: projectId } = await params;

	if (!isValidId(projectId)) {
		return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
	}

	const { user } = await authenticate(req);

	if (!hasRole(user, ["admin", "moderator"])) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const report = await getProjectDelayReport(projectId, user ?? {});
		if (!report) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		return NextResponse.json(report);
	} catch (error) {
		console.error("GET /api/projects/[id]/tasks/delay-report error:", error);
		return NextResponse.json({ error: "Failed to load project delay report" }, { status: 500 });
	}
}
