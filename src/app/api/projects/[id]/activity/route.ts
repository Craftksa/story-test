import {taskImages, tasks} from "@/drizzle/schema";
import { eq, sql, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {db} from "@/drizzle/db";
import { authenticate } from "@/lib/authenticate";
import { authorizeProjectAccess } from "@/lib/project-permissions";
import { isValidId } from "@/lib/utils";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: projectId } = await params;

	if (!isValidId(projectId)) {
		return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	const access = await authorizeProjectAccess({ user, projectId, action: "read" });

	if (!access.ok) {
		return NextResponse.json({ error: access.error }, { status: access.status });
	}

	const activities = await db
		.select({
			taskId: tasks.id,
			taskName: tasks.name,
			createdAt: tasks.createdAt,
			updatedAt: tasks.updatedAt,
			latestImageUpload: sql`MAX(${taskImages.uploadedAt})`.as("latestImageUpload"),
		})
		.from(tasks)
		.leftJoin(taskImages, eq(tasks.id, taskImages.taskId))
		.where(eq(tasks.projectId, projectId))
		.groupBy(tasks.id, tasks.name, tasks.createdAt, tasks.updatedAt)
		.orderBy(
			desc(
				sql`
          GREATEST(
            ${tasks.createdAt},
            COALESCE(${tasks.updatedAt}, ${tasks.createdAt}),
            COALESCE(MAX(${taskImages.uploadedAt}), ${tasks.createdAt})
          )
        `
			)
		)
		.limit(5);

	return NextResponse.json(activities);
}
