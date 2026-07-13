import { tasks, taskImages } from "@/drizzle/schema";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle/db";
import { z } from "zod";
import { authenticate } from "@/lib/authenticate";
import { isValidId } from "@/lib/utils";
import { and, eq, inArray } from "drizzle-orm";
import { authorizeProjectAccess } from "@/lib/project-permissions";

function projectAccessDeniedResponse(access: {
	status: 401 | 403 | 404;
	error: string;
}) {
	return NextResponse.json({ error: access.error }, { status: access.status });
}

const taskDateString = z.string().datetime({ offset: true }).optional();

const createTaskSchema = z
	.object({
		name: z.string(),
		type: z.enum(["foundations", "finishes"]),
		status: z.enum(["not_started", "in_progress", "completed", "on_hold", "needs_review"]),
		startDate: taskDateString,
		endDate: taskDateString,
		notes: z.string().optional(),
		dependsOnTaskId: z.string().nullable().optional(),
		isMilestone: z.boolean().optional(),
		images: z
			.array(
				z.object({
					url: z.string().url(),
					description: z.string().optional(),
				})
			)
			.optional(),
	})
	.superRefine((values, ctx) => {
		if (!values.startDate || !values.endDate) return;

		const startDate = new Date(values.startDate);
		const endDate = new Date(values.endDate);

		if (endDate.getTime() < startDate.getTime()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["endDate"],
				message: "End date must be on or after start date",
			});
		}
	});

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: projectId } = await params;

	if (!isValidId(projectId)) {
		return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	const userId = user?.id;
	const access = await authorizeProjectAccess({
		user,
		projectId,
		action: "update",
	});

	if (!access.ok) {
		return projectAccessDeniedResponse(access);
	}

	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await req.json();
	const parsed = createTaskSchema.safeParse(body);

	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid task data", issues: parsed.error.errors },
			{ status: 400 }
		);
	}

	const { name, type, status, startDate, endDate, notes, dependsOnTaskId, isMilestone, images } = parsed.data;

	if (dependsOnTaskId) {
		const dependencyRows = await db
			.select({ id: tasks.id })
			.from(tasks)
			.where(and(eq(tasks.id, dependsOnTaskId), eq(tasks.projectId, projectId)));

		if (!dependencyRows.length) {
			return NextResponse.json(
				{ error: "dependsOnTaskId must reference a task in the same project" },
				{ status: 400 }
			);
		}
	}

	const task = await db
		.insert(tasks)
		.values({
			name,
			type,
			status,
			startDate: startDate ? new Date(startDate) : null,
			endDate: endDate ? new Date(endDate) : null,
			notes,
			dependsOnTaskId: dependsOnTaskId ?? null,
			isMilestone: isMilestone ?? false,
			projectId,
			updatedAt: new Date(),
			createdAt: new Date(),
		})
		.returning();

	const taskId = task[0].id;

	if (images && images.length > 0) {
		await db.insert(taskImages).values(
			images.map((img) => ({
				taskId,
				url: img.url,
				description: img.description || null,
				uploadedBy: userId,
				uploadedAt: new Date(),
			}))
		);
	}

	return NextResponse.json(task[0]);
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: projectId } = await params;

	if (!isValidId(projectId)) {
		return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	const access = await authorizeProjectAccess({
		user,
		projectId,
		action: "read",
	});

	if (!access.ok) {
		return projectAccessDeniedResponse(access);
	}

	const taskList = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
	const taskIds = taskList.map((task) => task.id);

	let images: { taskId: string; url: string; description: string | null }[] = [];

	if (taskIds.length > 0) {
		images = await db
			.select({
				taskId: taskImages.taskId,
				url: taskImages.url,
				description: taskImages.description,
			})
			.from(taskImages)
			.where(inArray(taskImages.taskId, taskIds));
	}

	const imageMap: Record<string, typeof images> = {};
	for (const image of images) {
		if (!imageMap[image.taskId]) imageMap[image.taskId] = [];
		imageMap[image.taskId].push(image);
	}

	const result = taskList.map((task) => ({
		taskId: task.id,
		taskName: task.name,
		taskStatus: task.status,
		taskType: task.type,
		startDate: task.startDate,
		endDate: task.endDate,
		updatedAt: task.updatedAt,
		createdAt: task.createdAt,
		notes: task.notes,
		images: imageMap[task.id] || [],
	}));

	return NextResponse.json(result);
}
