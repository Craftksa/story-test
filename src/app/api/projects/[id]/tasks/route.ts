import { tasks, taskImages } from "@/drizzle/schema";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle/db";
import { z } from "zod";
import { authenticate } from "@/lib/authenticate";
import { hasRole, isValidId } from "@/lib/utils";
import { eq, inArray } from "drizzle-orm";

const taskDateString = z.string().datetime({ offset: true }).optional();

const createTaskSchema = z
	.object({
		name: z.string(),
		type: z.enum(["foundations", "finishes"]),
		status: z.enum(["not_started", "in_progress", "completed", "on_hold", "needs_review"]),
		startDate: taskDateString,
		endDate: taskDateString,
		notes: z.string().optional(),
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
	{ params }: { params: { id: string } }
) {
	const projectId = params.id;

	if (!isValidId(projectId)) {
		return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	if (!hasRole(user, ["admin", "moderator"])) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const body = await req.json();
	const parsed = createTaskSchema.safeParse(body);

	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid task data", issues: parsed.error.errors },
			{ status: 400 }
		);
	}

	const { name, type, status, startDate, endDate, notes, images } = parsed.data;

	const task = await db
		.insert(tasks)
		.values({
			name,
			type,
			status,
			startDate: startDate ? new Date(startDate) : null,
			endDate: endDate ? new Date(endDate) : null,
			notes,
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
				uploadedAt: new Date(),
				createdAt: new Date(),
			}))
		);
	}

	return NextResponse.json(task[0]);
}

export async function GET(
	req: NextRequest,
	{ params }: { params: { id: string } }
) {
	await authenticate(req);
	const projectId = params.id;

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
