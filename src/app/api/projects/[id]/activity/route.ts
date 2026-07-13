import {taskImages, tasks} from "@/drizzle/schema";
import { eq, sql, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import {db} from "@/drizzle/db";

export async function GET(
	req: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: projectId } = await params;

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
