import {db} from "@/drizzle/db";
import {contracts, projectAssignments, projects, taskImages, tasks, users} from "@/drizzle/schema";
import {NextRequest, NextResponse} from "next/server";
import {and, eq, inArray} from "drizzle-orm";
import {alias} from "drizzle-orm/pg-core";
import {hasRole, isValidId} from "@/lib/utils";
import {authenticate} from "@/lib/authenticate";
import {USE_DEV_AUTH_FALLBACK} from "@/lib/auth-config";
import {getMockProjectById} from "@/lib/dev-mock-data";
import {deleteFilesFromUploadThing, extractFileKey} from "../../uploadthing/delete-files";

const client = alias(users, "client");

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
	const { id } = params;

	if (!isValidId(id)) {
		return NextResponse.json({ error: "Invalid project ID format" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
	}

	try {
		if (USE_DEV_AUTH_FALLBACK) {
			const project = getMockProjectById(id);
			if (!project) {
				return NextResponse.json({ error: "Project not found" }, { status: 404 });
			}

			return NextResponse.json(project);
		}

		// Fetch project info with client
		const project = await db
			.select({
				id: projects.id,
				name: projects.name,
				status: projects.status,
				city: projects.city,
				district: projects.district,
				projectType: projects.projectType,
				startDate: projects.startDate,
				endDate: projects.endDate,
				description: projects.description,

				clientId: projects.clientId,
				clientName: client.name,
				clientEmail: client.email,
				clientRole: client.role,
				clientImage: client.image,

				designer: projects.designer,
			})
			.from(projects)
			.leftJoin(client, eq(projects.clientId, client.id))
			.where(eq(projects.id, id));

		if (!project[0]) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		// Fetch all assigned userIds for the project
		const assignments = await db
			.select({ userId: projectAssignments.userId })
			.from(projectAssignments)
			.where(eq(projectAssignments.projectId, id));

		const assignedTo = assignments.map(a => a.userId);

		// Fetch user details for assigned employees
		const assignedUsers = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				role: users.role,
				image: users.image,
			})
			.from(users)
			.where(inArray(users.id, assignedTo));

		// Fetch tasks
		const taskList = await db
			.select({
				taskId: tasks.id,
				taskName: tasks.name,
				taskStatus: tasks.status,
				taskType: tasks.type,
				startDate: tasks.startDate,
				endDate: tasks.endDate,
				updatedAt: tasks.updatedAt,
				createdAt: tasks.createdAt,
				notes: tasks.notes,
			})
			.from(tasks)
			.where(eq(tasks.projectId, id));

		const formattedTasks = taskList.map((task) => ({
			taskId: task.taskId,
			taskName: task.taskName,
			taskStatus: task.taskStatus,
			taskType: task.taskType,
			startDate: task.startDate,
			endDate: task.endDate,
			updatedAt: task.updatedAt,
			createdAt: task.createdAt,
			notes: task.notes,
		}));


		let formattedContracts;
		// ✅ Fetch contracts for this project
		if (hasRole(user, ["admin", "moderator", "client"])) {
			const contractList = await db
				.select({
					id: contracts.id,
					contractorName: contracts.contractorName,
					contractedAmount: contracts.contractedAmount,
					description: contracts.description,
					fileUrl: contracts.fileUrl,
					createdAt: contracts.createdAt,
					updatedAt: contracts.updatedAt,
				})
				.from(contracts)
				.where(eq(contracts.projectId, id));

			formattedContracts = contractList.map(contract => ({
				id: contract.id,
				contractorName: contract.contractorName,
				contractedAmount: contract.contractedAmount,
				description: contract.description,
				fileUrl: contract.fileUrl,
				createdAt: contract.createdAt,
				updatedAt: contract.updatedAt,
			}));
		}



		const proj = project[0];

		const formatted = {
			id: proj.id,
			name: proj.name,
			status: proj.status,
			city: proj.city,
			district: proj.district,
			projectType: proj.projectType,
			startDate: proj.startDate,
			endDate: proj.endDate,
			description: proj.description,
			clientId: proj.clientId,
			designer: proj.designer,
			assignedTo,
			employees: assignedUsers,
			client: {
				id: proj.clientId,
				name: proj.clientName,
				email: proj.clientEmail,
				role: proj.clientRole,
				image: proj.clientImage,
			},
			tasks: formattedTasks,
			contracts: hasRole(user, ["admin", "moderator", "client"]) ? formattedContracts : [],
		};

		return NextResponse.json(formatted);
	} catch (error) {
		console.error("GET /projects/[id] error:", error);
		return NextResponse.json({ error: "Failed to fetch project details" }, { status: 500 });
	}
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
	const { id } = params

	if (!isValidId(id)) {
		return NextResponse.json({ error: 'Invalid project ID format' }, { status: 400 })
	}

	const { user } = await authenticate(req)
	if (!hasRole(user, ["admin", "moderator", "employee"])) {
		return NextResponse.json({ error: "Forbidden 403" }, { status: 403 })
	}

	try {
		const body = await req.json()
		if (!body || typeof body !== "object") {
			return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
		}

		// 1) Update core project fields
		await db.update(projects)
			.set({
				name: body.name,
				status: body.status,
				city: body.city,
				district: body.district,
				projectType: body.projectType,
				startDate: body.startDate ? new Date(body.startDate) : null,
				endDate: body.endDate ? new Date(body.endDate) : null,
				clientId: body.clientId ?? null,
				designer: body.designer ?? null,
				description: body.description ?? null,
				updatedAt: new Date(),
			})
			.where(eq(projects.id, id))

		// 2) Handle assignedTo diff
		const newAssigned: string[] = Array.isArray(body.assignedTo) ? body.assignedTo : []

		// 2a) Validate user IDs exist
		if (newAssigned.length > 0) {
			const valid = await db.query.users.findMany({
				where: (u) => inArray(u.id, newAssigned),
			})
			if (valid.length !== newAssigned.length) {
				return NextResponse.json(
					{ error: "One or more assigned users are invalid" },
					{ status: 400 }
				)
			}
		}

		// 2b) Load existing assignments
		const existing = await db.query.projectAssignments.findMany({
			where: eq(projectAssignments.projectId, id),
		})
		const existingIds = existing.map((a) => a.userId)

		// 2c) Compute additions & removals
		const toAdd = newAssigned.filter((uid) => !existingIds.includes(uid))
		const toRemove = existingIds.filter((uid) => !newAssigned.includes(uid))

		// 2d) Delete removals
		if (toRemove.length > 0) {
			await db.delete(projectAssignments)
				.where(and(
					eq(projectAssignments.projectId, id),
					inArray(projectAssignments.userId, toRemove)
				))
		}

		// 2e) Insert additions
		if (toAdd.length > 0) {
			const rows = toAdd.map((userId) => ({ projectId: id, userId }))
			await db.insert(projectAssignments).values(rows)
		}

		return NextResponse.json({ message: "Project updated" })
	} catch (error) {
		console.error("PUT /projects/[contractId] error:", error)
		return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
	}
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
	const { id: projectId } = params;

	if (!isValidId(projectId)) {
		return NextResponse.json({ error: "Invalid project ID format" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	if (!hasRole(user, ["admin", "moderator"])) {
		return NextResponse.json({ error: "Forbidden 403" }, { status: 403 });
	}

	try {
		// Step 1: Get all task IDs under this project
		const projectTasks = await db
			.select({ id: tasks.id })
			.from(tasks)
			.where(eq(tasks.projectId, projectId));

		const taskIds = projectTasks.map((t) => t.id);
		if (taskIds.length > 0) {
			// Step 2: Get all image URLs from those tasks
			const images = await db
				.select({ url: taskImages.url })
				.from(taskImages)
				.where(inArray(taskImages.taskId, taskIds));

			const fileKeys = images
				.map((img) => extractFileKey(img.url))
				.filter((key): key is string => !!key);

			// Step 3: Delete files from UploadThing
			if (fileKeys.length > 0) {
				await deleteFilesFromUploadThing(fileKeys);
			}
		}

		// Step 4: Delete the project (tasks & taskImages cascade via DB)
		await db.delete(projects).where(eq(projects.id, projectId));

		return NextResponse.json({ message: "Project and all related data deleted" });
	} catch (error) {
		console.error("DELETE /projects/[id] error:", error);
		return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
	}
}
