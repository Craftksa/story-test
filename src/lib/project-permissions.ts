import { and, eq } from "drizzle-orm";

import { db } from "@/drizzle/db";
import { projectAssignments, projects } from "@/drizzle/schema";
import type { AuthenticatedUser } from "@/lib/authenticate";
import { hasRole } from "@/lib/utils";

export type ProjectPermissionAction = "read" | "update" | "delete" | "upload";

type ProjectAccessProject = {
	id: string;
	clientId: string | null;
};

type ProjectAccessGranted = {
	ok: true;
	project: ProjectAccessProject;
	isGlobalManager: boolean;
	isProjectClient: boolean;
	isProjectMember: boolean;
};

type ProjectAccessDenied = {
	ok: false;
	status: 401 | 403 | 404;
	error: string;
};

export type ProjectAccessResult = ProjectAccessGranted | ProjectAccessDenied;

const GLOBAL_PROJECT_MANAGER_ROLES = ["admin", "moderator"];
const CLIENT_PROJECT_READ_ROLES = ["client"];
const EMPLOYEE_PROJECT_READ_ROLES = ["employee"];

export async function isAssignedToProject(projectId: string, userId: string) {
	const assignment = await db
		.select({ projectId: projectAssignments.projectId })
		.from(projectAssignments)
		.where(
			and(
				eq(projectAssignments.projectId, projectId),
				eq(projectAssignments.userId, userId)
			)
		)
		.limit(1);

	return assignment.length > 0;
}

export async function authorizeProjectAccess({
	user,
	projectId,
	action,
}: {
	user: AuthenticatedUser | null;
	projectId: string;
	action: ProjectPermissionAction;
}): Promise<ProjectAccessResult> {
	if (!user?.id) {
		return { ok: false, status: 401, error: "Unauthorized" };
	}

	const project = await db
		.select({
			id: projects.id,
			clientId: projects.clientId,
		})
		.from(projects)
		.where(eq(projects.id, projectId))
		.limit(1);

	if (!project[0]) {
		return { ok: false, status: 404, error: "Project not found" };
	}

	const isGlobalManager = hasRole(user, GLOBAL_PROJECT_MANAGER_ROLES);
	const isClient = hasRole(user, CLIENT_PROJECT_READ_ROLES);
	const isEmployee = hasRole(user, EMPLOYEE_PROJECT_READ_ROLES);
	const isProjectClient = project[0].clientId === user.id;
	const isProjectMember = await isAssignedToProject(projectId, user.id);

	if (isGlobalManager) {
		return {
			ok: true,
			project: project[0],
			isGlobalManager,
			isProjectClient,
			isProjectMember,
		};
	}

	if (action === "read" && ((isClient && isProjectClient) || (isEmployee && isProjectMember))) {
		return {
			ok: true,
			project: project[0],
			isGlobalManager,
			isProjectClient,
			isProjectMember,
		};
	}

	if (action === "upload" && isEmployee && isProjectMember) {
		return {
			ok: true,
			project: project[0],
			isGlobalManager,
			isProjectClient,
			isProjectMember,
		};
	}

	return { ok: false, status: 403, error: "Forbidden" };
}
