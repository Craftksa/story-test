import {projectAssignments, projects, users} from "@/drizzle/schema";
import {NextRequest, NextResponse} from "next/server";
import {eq, desc, or, inArray, and} from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { alias } from "drizzle-orm/pg-core";
import {authenticate} from "@/lib/authenticate";
import {hasRole} from "@/lib/utils";

// Schema for project creation
const createProjectSchema = z.object({
	name: z.string(),
	status: z.enum(["not_started", "in_progress", "completed", "on_hold", "needs_review"]).default("not_started").optional(),
	city: z.string(),
	district: z.string(),
	projectType: z.string(),
	startDate: z.string().optional(), // ISO date string
	endDate: z.string().optional(),
	clientId: z.string().optional(),    // userId of client
	designer: z.string(),  // userId of designer
	description: z.string().optional(),
	assignedTo: z.array(z.string()).optional(),
});

const client = alias(users, "client");

const projectSelectFields = {
	projectId: projects.id,
	name: projects.name,
	status: projects.status,
	city: projects.city,
	district: projects.district,
	projectType: projects.projectType,
	startDate: projects.startDate,
	endDate: projects.endDate,
	description: projects.description,
	clientId: projects.clientId,
	designer: projects.designer,
	clientName: client.name,
	clientEmail: client.email,
	clientRole: client.role,
	clientImage: client.image,
};

export async function GET(req: NextRequest) {
	const { user } = await authenticate(req);

	const userRole = user?.role!;
	const userId = user?.id!;

	let filteredProjects;

	if (["admin", "moderator"].includes(userRole)) {
		// ✅ Fetch all projects for admin/moderator
		filteredProjects = await db
			.select({ ...projectSelectFields })
			.from(projects)
			.leftJoin(client, eq(projects.clientId, client.id))
			.orderBy(desc(projects.createdAt));
	} else if (userRole === "client") {
		// ✅ Fetch only projects assigned to this client
		filteredProjects = await db
			.select({ ...projectSelectFields })
			.from(projects)
			.leftJoin(client, eq(projects.clientId, client.id))
			.where(eq(projects.clientId, userId))
			.orderBy(desc(projects.createdAt));

		if (!filteredProjects.length) {
			return NextResponse.json([]);
		}
	} else if (userRole === "employee") {
		// Employees can still view all projects; personal filtering is handled in the UI.
		filteredProjects = await db
			.select({ ...projectSelectFields })
			.from(projects)
			.leftJoin(client, eq(projects.clientId, client.id))
			.orderBy(desc(projects.createdAt));
	} else {
		return NextResponse.json({ error: "Unauthorized role" }, { status: 403 });
	}

	// ✅ Get all project assignments
	const allProjectIds = filteredProjects.map(p => p.projectId);
	const allAssignments = allProjectIds.length > 0
		? await db
			.select({
				projectId: projectAssignments.projectId,
				userId: projectAssignments.userId,
			})
			.from(projectAssignments)
			.where(inArray(projectAssignments.projectId, allProjectIds))
		: [];

	// ✅ Group assigned user IDs by projectId
	const assignedMap: Record<string, string[]> = {};
	for (const { projectId, userId } of allAssignments) {
		if (!assignedMap[projectId]) assignedMap[projectId] = [];
		assignedMap[projectId].push(userId);
	}

	// ✅ Get unique userIds for employees
	const uniqueUserIds = [...new Set(allAssignments.map(a => a.userId))];

	// ✅ Fetch user details for all assigned users
	const assignedUsers = uniqueUserIds.length > 0
		? await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				role: users.role,
				image: users.image,
			})
			.from(users)
			.where(inArray(users.id, uniqueUserIds))
		: [];

	// ✅ Group employees by projectId
	const employeeMap: Record<string, typeof assignedUsers> = {};
	for (const { projectId, userId } of allAssignments) {
		const user = assignedUsers.find(u => u.id === userId);
		if (!user) continue;
		if (!employeeMap[projectId]) employeeMap[projectId] = [];
		employeeMap[projectId].push(user);
	}

	// ✅ Format response
	const formatted = filteredProjects.map((r) => ({
		id: r.projectId,
		name: r.name,
		status: r.status,
		city: r.city,
		district: r.district,
		projectType: r.projectType,
		startDate: r.startDate,
		endDate: r.endDate,
		description: r.description,
		designer: r.designer,
		assignedTo: assignedMap[r.projectId] || [],
		employees: employeeMap[r.projectId] || [],
		client: {
			id: r.clientId,
			name: r.clientName,
			email: r.clientEmail,
			role: r.clientRole,
			image: r.clientImage,
		},
	}));

	return NextResponse.json(formatted);
}

export async function POST(req: NextRequest) {
	const { user } = await authenticate(req);

	if (!hasRole(user, ["admin", "moderator"])) {
		return NextResponse.json({ error: "Forbidden 403" }, { status: 403 });
	}

	const body = await req.json();
	const parsed = createProjectSchema.safeParse(body);

	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid data", issues: parsed.error.errors },
			{ status: 400 }
		);
	}

	const {
		name,
		status = "not_started",
		city,
		district,
		projectType,
		startDate,
		endDate,
		clientId,
		designer,
		description,
		assignedTo = [],
	} = parsed.data;

	// Validate clientId exists
	if (clientId) {
		const clientExists = await db.query.users.findFirst({
			where: and(eq(users.id, clientId), eq(users.role, "client")),
		});
		if (!clientExists) {
			return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
		}
	}

	// Validate assignedTo users exist
	if (assignedTo.length > 0) {
		const validUsers = await db.query.users.findMany({
			where: (user) => inArray(user.id, assignedTo),
		});
		if (validUsers.length !== assignedTo.length) {
			return NextResponse.json({ error: "One or more assigned users are invalid" }, { status: 400 });
		}
	}

	// Insert project
	const newProject = await db.insert(projects).values({
		name,
		status,
		city,
		district,
		projectType,
		startDate: startDate ? new Date(startDate) : null,
		endDate: endDate ? new Date(endDate) : null,
		clientId: clientId ?? null,
		designer: designer ?? null,
		description,
		updatedAt: new Date(),
		createdAt: new Date(),
	}).returning();

	const projectId = newProject[0].id;

	// Insert into project_assignment table
	if (assignedTo.length > 0) {
		const assignments = assignedTo.map((userId) => ({
			projectId,
			userId,
		}));

		await db.insert(projectAssignments).values(assignments);
	}

	return NextResponse.json(newProject[0]);
}
