export type ProjectVisibilityScope = "all" | "mine";

const normalizeUserRef = (value: unknown) => {
	if (typeof value !== "string") return null;

	const normalized = value.trim().toLowerCase();
	return normalized || null;
};

const collectUserRefs = (value: unknown): string[] => {
	if (!value) return [];

	if (Array.isArray(value)) {
		return value.flatMap((item) => collectUserRefs(item));
	}

	if (typeof value === "object") {
		const item = value as Record<string, unknown>;

		return [
			normalizeUserRef(item.id),
			normalizeUserRef(item.userId),
			normalizeUserRef(item.email),
		].filter((ref): ref is string => !!ref);
	}

	const normalized = normalizeUserRef(value);
	return normalized ? [normalized] : [];
};

type MinimalUser = { id?: string | null; email?: string | null } | null | undefined;

const getCurrentUserRefs = (currentUser: MinimalUser) =>
	[
		normalizeUserRef(currentUser?.id),
		normalizeUserRef(currentUser?.email),
	].filter((ref): ref is string => !!ref);

export const isUserAssignedToProject = (project: Record<string, unknown> | null | undefined, currentUser: MinimalUser) => {
	if (!project || !currentUser) return false;

	const currentUserRefs = getCurrentUserRefs(currentUser);
	if (currentUserRefs.length === 0) return false;

	const projectRefs = [
		project.assignedEngineerId,
		project.engineerId,
		project.ownerId,
		project.responsibleUserId,
		project.assignedTo,
		project.assignedUsers,
		project.employees,
	].flatMap((value) => collectUserRefs(value));

	return currentUserRefs.some((userRef) => projectRefs.includes(userRef));
};

export const filterProjectsByVisibility = <T extends Record<string, unknown>>(
	projects: T[],
	currentUser: MinimalUser,
	scope: ProjectVisibilityScope
) => {
	if (scope === "all") return projects;

	return projects.filter((project) => isUserAssignedToProject(project, currentUser));
};

export const filterProjectItemsByVisibility = <T>(
	items: T[],
	projects: Array<Record<string, unknown>>,
	currentUser: MinimalUser,
	scope: ProjectVisibilityScope,
	getProjectId: (item: T) => string | null | undefined
) => {
	if (scope === "all") return items;

	return items.filter((item) => {
		const projectId = getProjectId(item);
		if (!projectId) return false;

		const project = projects.find((entry) => entry.id === projectId || entry.projectId === projectId);
		return isUserAssignedToProject(project, currentUser);
	});
};
