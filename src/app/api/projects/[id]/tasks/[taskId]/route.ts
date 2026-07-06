import { db } from "@/drizzle/db";
import { tasks, taskImages } from "@/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { isValidId, hasRole } from "@/lib/utils";
import {
	deleteFilesFromUploadThing,
	extractFileKey,
} from "@/app/api/uploadthing/delete-files";
import { z } from "zod";
import { authorizeProjectAccess } from "@/lib/project-permissions";

const taskDateString = z.string().datetime({ offset: true }).optional();

function projectAccessDeniedResponse(access: {
	status: 401 | 403 | 404;
	error: string;
}) {
	return NextResponse.json({ error: access.error }, { status: access.status });
}

const updateTaskSchema = z
	.object({
		name: z.string().optional(),
		status: z
			.enum(["not_started", "in_progress", "completed", "on_hold", "needs_review"])
			.optional(),
		type: z.enum(["foundations", "finishes"]).optional(),
		startDate: taskDateString.nullable().optional(),
		endDate: taskDateString.nullable().optional(),
		notes: z.string().nullable().optional(),
		images: z
			.array(
				z.object({
					url: z.string().url(),
					description: z.string().nullable().optional(),
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

export async function GET(
	req: NextRequest,
	{ params }: { params: { id: string; taskId: string } }
) {
	const { id: projectId, taskId } = params;

	if (!isValidId(projectId) || !isValidId(taskId)) {
		return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
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

	try {
		const task = await db
			.select()
			.from(tasks)
			.where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));

		if (!task.length) {
			return NextResponse.json({ error: "Task not found for this project" }, { status: 404 });
		}

		const taskData = task[0];

		const images = await db
			.select({
				id: taskImages.id,
				url: taskImages.url,
				description: taskImages.description,
				uploadedAt: taskImages.uploadedAt,
			})
			.from(taskImages)
			.where(eq(taskImages.taskId, taskId));

		return NextResponse.json({
			...taskData,
			images,
		});
	} catch (error) {
		console.error("GET /projects/[id]/tasks/[taskId] error:", error);
		return NextResponse.json({ error: "Failed to fetch task details" }, { status: 500 });
	}
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: { id: string; taskId: string } }
) {
	const { id: projectId, taskId } = params;

	if (!isValidId(projectId) || !isValidId(taskId)) {
		return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	if (!hasRole(user, ["admin", "moderator", "employee"])) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
	const userId = user?.id;

	const access = await authorizeProjectAccess({
		user,
		projectId,
		action: "read",
	});

	if (!access.ok) {
		return projectAccessDeniedResponse(access);
	}

	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const parsed = updateTaskSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid task data", issues: parsed.error.errors },
				{ status: 400 }
			);
		}

		const { images, ...payload } = parsed.data;
		const updates: Record<string, unknown> = {};

		for (const [field, value] of Object.entries(payload)) {
			if (value === undefined) continue;
			updates[field] =
				field === "startDate" || field === "endDate"
					? value ? new Date(value as string) : null
					: value;
		}

		await db
			.update(tasks)
			.set({
				...updates,
				updatedAt: new Date(),
			})
			.where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));

		if (Array.isArray(images)) {
			const newImages: { url: string; description: string | null }[] = images.map((img) => ({
				url: img.url,
				description: img.description || null,
			}));

			const existingImages = await db
				.select({ id: taskImages.id, url: taskImages.url })
				.from(taskImages)
				.where(eq(taskImages.taskId, taskId));

			const existingUrls = new Set(existingImages.map((img) => img.url));
			const newUrls = new Set(newImages.map((img) => img.url));

			const urlsToDelete = [...existingUrls].filter((url) => !newUrls.has(url));
			if (urlsToDelete.length > 0) {
				await db
					.delete(taskImages)
					.where(and(eq(taskImages.taskId, taskId), inArray(taskImages.url, urlsToDelete)));
			}

			const imagesToInsert = newImages.filter((img) => !existingUrls.has(img.url));
			if (imagesToInsert.length > 0) {
				await db.insert(taskImages).values(
					imagesToInsert.map((img) => ({
						taskId,
						url: img.url,
						description: img.description,
						uploadedBy: userId,
						uploadedAt: new Date(),
					}))
				);
			}
		}

		return NextResponse.json({ message: "Task updated with synced images" });
	} catch (error) {
		console.error("PUT /projects/[id]/tasks/[taskId] error:", error);
		return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
	}
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: { id: string; taskId: string } }
) {
	const { id: projectId, taskId } = params;

	if (!isValidId(projectId) || !isValidId(taskId)) {
		return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	if (!hasRole(user, ["admin", "moderator"])) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const imageUrls = await db
			.select({ url: taskImages.url })
			.from(taskImages)
			.where(eq(taskImages.taskId, taskId));

		const fileKeys = imageUrls
			.map((img) => extractFileKey(img.url))
			.filter((key): key is string => !!key);

		await deleteFilesFromUploadThing(fileKeys);

		const deleted = await db
			.delete(tasks)
			.where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));

		return NextResponse.json({ message: "Task deleted", deleted });
	} catch (error) {
		console.error("DELETE /projects/[id]/tasks/[taskId] error:", error);
		return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
	}
}
