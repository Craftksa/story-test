import { db } from "@/drizzle/db";
import { tasks, taskImages } from "@/drizzle/schema";
import {eq, and, inArray} from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { isValidId, hasRole } from "@/lib/utils";
import {deleteFilesFromUploadThing, extractFileKey} from "@/app/api/uploadthing/delete-files";

// GET: Fetch task details and images
export async function GET(
	req: NextRequest,
	{ params }: { params: { id: string; taskId: string } }
) {
	const { id: projectId, taskId } = params;

	if (!isValidId(projectId) || !isValidId(taskId)) {
		return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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
		console.error("GET /projects/[id]/tasks/[contractId] error:", error);
		return NextResponse.json({ error: "Failed to fetch task details" }, { status: 500 });
	}
}

// PUT: Update task details
// PUT: Update task and efficiently sync images
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

	try {
		const body = await req.json();

		const allowedFields = ["name", "status", "type", "startDate", "endDate", "notes"];
		const updates: Record<string, any> = {};

		for (const field of allowedFields) {
			if (field in body) {
				updates[field] =
					field === "startDate" || field === "endDate"
						? body[field] ? new Date(body[field]) : null
						: body[field];
			}
		}

		// 1. Update task fields
		await db
			.update(tasks)
			.set({
				...updates,
				updatedAt: new Date(), // <-- add this line
			})
			.where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));

		// 2. Efficient image sync
		if (Array.isArray(body.images)) {
			const newImages: { url: string; description: string | null }[] = body.images.map((img: any) => ({
				url: img.url,
				description: img.description || null,
			}));

			const existingImages = await db
				.select({ id: taskImages.id, url: taskImages.url })
				.from(taskImages)
				.where(eq(taskImages.taskId, taskId));

			const existingUrls = new Set(existingImages.map((img) => img.url));
			const newUrls = new Set(newImages.map((img) => img.url));

			// 2a. Images to delete (in DB but not in new input)
			const urlsToDelete = [...existingUrls].filter((url) => !newUrls.has(url));
			if (urlsToDelete.length > 0) {
				await db
					.delete(taskImages)
					.where(and(eq(taskImages.taskId, taskId), inArray(taskImages.url, urlsToDelete)));
			}

			// 2b. Images to insert (in new input but not in DB)
			const imagesToInsert = newImages.filter((img) => !existingUrls.has(img.url));
			if (imagesToInsert.length > 0) {
				await db.insert(taskImages).values(
					imagesToInsert.map((img) => ({
						taskId,
						url: img.url,
						description: img.description,
						uploadedAt: new Date(),
						createdAt: new Date(),
					}))
				);
			}
		}

		return NextResponse.json({ message: "Task updated with synced images" });
	} catch (error) {
		console.error("PUT /projects/[id]/tasks/[contractId] error:", error);
		return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
	}
}

// DELETE: Remove task and cascade images
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
		// 1. Fetch image URLs before deleting the task
		const imageUrls = await db
			.select({ url: taskImages.url })
			.from(taskImages)
			.where(eq(taskImages.taskId, taskId));

		// 2. Extract file keys from URLs
		const fileKeys = imageUrls
			.map((img) => extractFileKey(img.url))
			.filter((key): key is string => !!key);

		// 3. Delete from UploadThing
		await deleteFilesFromUploadThing(fileKeys);

		// 4. Now delete the task (images will cascade in DB)
		const deleted = await db
			.delete(tasks)
			.where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));


		return NextResponse.json({ message: "Task deleted", deleted });
	} catch (error) {
		console.error("DELETE /projects/[id]/tasks/[contractId] error:", error);
		return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
	}
}
