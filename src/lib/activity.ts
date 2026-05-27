import { db } from "@/drizzle/db";
import {
	projectAssignments,
	projectLetters,
	projectNotes,
	projectReportPermissions,
	projectReports,
	projects,
	tasks,
	users,
} from "@/drizzle/schema";
import { hasRole } from "@/lib/utils";
import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

type NullableDate = Date | string | null | undefined;

export type ActivityUser = {
	id: string;
	name: string | null;
	email: string | null;
	role: string | null;
};

export type ActivityNote = {
	id: string;
	projectId: string;
	content: string;
	authorId: string | null;
	authorName: string;
	createdAt: string | null;
	updatedAt: string | null;
};

export type ActivityReportRecipient = {
	name: string;
	email?: string | null;
	phone?: string | null;
	channel?: "email" | "whatsapp" | "both" | "none";
};

export type ActivityReportAttachment = {
	url: string;
	name?: string | null;
	type?: string | null;
};

export type ActivityReportPermission = {
	userId: string;
	userName: string;
	userEmail: string | null;
	accessLevel: "view" | "edit";
};

export type ActivityLetter = {
	id: string;
	projectId: string;
	recipientName: string;
	subject: string;
	body: string;
	letterDate: string | null;
	attachments: ActivityReportAttachment[];
	status: "draft" | "ready";
	authorId: string | null;
	authorName: string;
	createdAt: string | null;
	updatedAt: string | null;
	canEdit: boolean;
};

export type ActivityReport = {
	id: string;
	projectId: string;
	reportType: "client" | "internal" | "shared";
	title: string;
	summary: string | null;
	details: string;
	workDetails: string | null;
	attachments: ActivityReportAttachment[];
	recipients: ActivityReportRecipient[];
	status: "draft" | "pending_admin_approval" | "approved" | "rejected" | "sent";
	authorId: string | null;
	authorName: string;
	approvedBy: string | null;
	approvedByName: string | null;
	approvedAt: string | null;
	rejectionReason: string | null;
	adminDecisionNote: string | null;
	pdfStatus: "not_generated" | "generated" | "failed";
	emailStatus: "not_applicable" | "pending" | "sent" | "failed" | "not_configured";
	whatsappStatus: "not_applicable" | "pending" | "sent" | "failed" | "not_configured";
	lastDeliveryError: string | null;
	sentAt: string | null;
	createdAt: string | null;
	updatedAt: string | null;
	permissions: ActivityReportPermission[];
	canEdit: boolean;
	canApprove: boolean;
	canSendToClient: boolean;
};

export type ActivityProjectSummary = {
	id: string;
	name: string;
	status: string;
	city: string | null;
	district: string | null;
	clientName: string | null;
	clientEmail: string | null;
	lastActivityAt: string | null;
	lastUpdatedAt: string | null;
	noteCount: number;
	lastNote: ActivityNote | null;
	reportCount: number;
	pendingApprovalCount: number;
	overdueTaskCount: number;
	clientActionTaskCount: number;
	totalTaskCount: number;
	teamCount: number;
};

export type ActivityProjectDetails = {
	project: ActivityProjectSummary & {
		description: string | null;
		clientId: string | null;
		teamMembers: ActivityUser[];
	};
	notes: ActivityNote[];
	reports: ActivityReport[];
	letters: ActivityLetter[];
	activities: Array<{
		id: string;
		type: "task" | "note" | "report";
		title: string;
		description: string;
		occurredAt: string | null;
		priority: "high" | "medium" | "low";
	}>;
};

type AuthLikeUser = {
	id?: string | null;
	role?: string | null;
	name?: string | null;
	email?: string | null;
};

type BaseProjectRow = {
	id: string;
	name: string;
	status: string;
	city: string;
	district: string;
	description: string | null;
	clientId: string | null;
	clientName: string | null;
	clientEmail: string | null;
	updatedAt: Date | null;
};

type ProjectTaskRow = {
	id: string;
	projectId: string;
	name: string;
	status: string;
	startDate: Date | null;
	endDate: Date | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

type RawReportPermissionRow = {
	reportId: string;
	userId: string;
	accessLevel: "view" | "edit";
	userName: string | null;
	userEmail: string | null;
};

type RawReportRow = {
	id: string;
	projectId: string;
	reportType: "client" | "internal" | "shared";
	title: string;
	summary: string | null;
	details: string;
	workDetails: string | null;
	attachments: string | null;
	recipients: string | null;
	status: "draft" | "pending_admin_approval" | "approved" | "rejected" | "sent";
	authorId: string | null;
	authorName: string | null;
	approvedBy: string | null;
	approvedByName: string | null;
	approvedAt: Date | null;
	rejectionReason: string | null;
	adminDecisionNote: string | null;
	pdfStatus: "not_generated" | "generated" | "failed";
	emailStatus: "not_applicable" | "pending" | "sent" | "failed" | "not_configured";
	whatsappStatus: "not_applicable" | "pending" | "sent" | "failed" | "not_configured";
	lastDeliveryError: string | null;
	sentAt: Date | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

type RawLetterRow = {
	id: string;
	projectId: string;
	recipientName: string;
	subject: string;
	body: string;
	letterDate: Date | null;
	attachments: string | null;
	status: "draft" | "ready";
	authorId: string | null;
	authorName: string | null;
	authorEmail: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

const ACTIVITY_ALLOWED_ROLES = ["admin", "moderator", "employee"];

const noteAuthor = alias(users, "note_author");
const letterAuthor = alias(users, "letter_author");
const reportAuthor = alias(users, "report_author");
const reportApprover = alias(users, "report_approver");
const reportPermissionUser = alias(users, "report_permission_user");
const projectClient = alias(users, "project_client");

const toIsoString = (value: NullableDate) => {
	if (!value) return null;
	const normalized = value instanceof Date ? value : new Date(value);
	return Number.isNaN(normalized.getTime()) ? null : normalized.toISOString();
};

const parseJsonList = <T>(value: string | null | undefined): T[] => {
	if (!value?.trim()) return [];

	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? (parsed as T[]) : [];
	} catch {
		return [];
	}
};

export const serializeJsonList = (value: unknown) => JSON.stringify(value ?? []);

const getDisplayName = (name?: string | null, email?: string | null) =>
	name?.trim() || email?.trim() || "غير معروف";

export const canAccessActivity = (user: AuthLikeUser | null | undefined) =>
	hasRole(user, ACTIVITY_ALLOWED_ROLES);

const canManageAllReports = (user: AuthLikeUser | null | undefined) =>
	hasRole(user, ["admin", "moderator"]);

const isTaskOverdue = (task: ProjectTaskRow) => {
	if (!task.endDate) return false;
	if (task.status === "completed") return false;
	return task.endDate.getTime() < Date.now();
};

const needsClientAction = (task: ProjectTaskRow) =>
	task.status === "needs_review" || task.status === "on_hold";

const getLastActivityDate = ({
	project,
	projectTasks,
	projectNotesList,
	projectReportsList,
	projectLettersList,
}: {
	project: BaseProjectRow;
	projectTasks: ProjectTaskRow[];
	projectNotesList: ActivityNote[];
	projectReportsList: ActivityReport[];
	projectLettersList: ActivityLetter[];
}) => {
	const dates = [
		project.updatedAt,
		...projectTasks.flatMap((task) => [task.updatedAt, task.createdAt, task.endDate]),
		...projectNotesList.flatMap((note) => [note.updatedAt, note.createdAt].map((value) => (value ? new Date(value) : null))),
		...projectReportsList.flatMap((report) =>
			[report.updatedAt, report.createdAt, report.sentAt, report.approvedAt].map((value) =>
				value ? new Date(value) : null
			)
		),
		...projectLettersList.flatMap((letter) =>
			[letter.updatedAt, letter.createdAt, letter.letterDate].map((value) =>
				value ? new Date(value) : null
			)
		),
	].filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));

	if (dates.length === 0) return null;

	return new Date(Math.max(...dates.map((value) => value.getTime())));
};

const canUserAccessReport = (
	report: RawReportRow,
	user: AuthLikeUser,
	permissionsByReportId: Map<string, RawReportPermissionRow[]>
) => {
	if (canManageAllReports(user)) return true;
	if (!user.id) return false;
	if (report.authorId === user.id) return true;

	const reportPermissions = permissionsByReportId.get(report.id) ?? [];
	return reportPermissions.some((permission) => permission.userId === user.id);
};

const canUserEditReport = (
	report: RawReportRow,
	user: AuthLikeUser,
	permissionsByReportId: Map<string, RawReportPermissionRow[]>
) => {
	if (canManageAllReports(user)) return true;
	if (!user.id) return false;
	if (report.authorId === user.id) return true;

	const reportPermissions = permissionsByReportId.get(report.id) ?? [];
	return reportPermissions.some(
		(permission) => permission.userId === user.id && permission.accessLevel === "edit"
	);
};

const canUserApproveReport = (report: RawReportRow, user: AuthLikeUser) =>
	canManageAllReports(user) && report.status === "pending_admin_approval";

const canUserSendReportToClient = (report: RawReportRow, user: AuthLikeUser) =>
	canManageAllReports(user) &&
	report.reportType === "client" &&
	(report.status === "approved" || report.status === "sent");

const canUserEditLetter = (letter: RawLetterRow, user: AuthLikeUser) => {
	if (canManageAllReports(user)) return true;
	if (!user.id) return false;
	return letter.authorId === user.id;
};

const getAccessibleReports = (
	rawReports: RawReportRow[],
	user: AuthLikeUser,
	permissionsByReportId: Map<string, RawReportPermissionRow[]>
) =>
	rawReports.filter((report) => canUserAccessReport(report, user, permissionsByReportId));

const mapPermissions = (permissions: RawReportPermissionRow[]): ActivityReportPermission[] =>
	permissions.map((permission) => ({
		userId: permission.userId,
		userName: getDisplayName(permission.userName, permission.userEmail),
		userEmail: permission.userEmail,
		accessLevel: permission.accessLevel,
	}));

const mapLetter = (letter: RawLetterRow, user: AuthLikeUser): ActivityLetter => ({
	id: letter.id,
	projectId: letter.projectId,
	recipientName: letter.recipientName,
	subject: letter.subject,
	body: letter.body,
	letterDate: toIsoString(letter.letterDate),
	attachments: parseJsonList<ActivityReportAttachment>(letter.attachments),
	status: letter.status,
	authorId: letter.authorId,
	authorName: getDisplayName(letter.authorName, letter.authorEmail),
	createdAt: toIsoString(letter.createdAt),
	updatedAt: toIsoString(letter.updatedAt),
	canEdit: canUserEditLetter(letter, user),
});

const mapReport = (
	report: RawReportRow,
	user: AuthLikeUser,
	permissionsByReportId: Map<string, RawReportPermissionRow[]>
): ActivityReport => {
	const permissions = permissionsByReportId.get(report.id) ?? [];

	return {
		id: report.id,
		projectId: report.projectId,
		reportType: report.reportType,
		title: report.title,
		summary: report.summary,
		details: report.details,
		workDetails: report.workDetails,
		attachments: parseJsonList<ActivityReportAttachment>(report.attachments),
		recipients: parseJsonList<ActivityReportRecipient>(report.recipients),
		status: report.status,
		authorId: report.authorId,
		authorName: getDisplayName(report.authorName, null),
		approvedBy: report.approvedBy,
		approvedByName: report.approvedByName,
		approvedAt: toIsoString(report.approvedAt),
		rejectionReason: report.rejectionReason,
		adminDecisionNote: report.adminDecisionNote,
		pdfStatus: report.pdfStatus,
		emailStatus: report.emailStatus,
		whatsappStatus: report.whatsappStatus,
		lastDeliveryError: report.lastDeliveryError,
		sentAt: toIsoString(report.sentAt),
		createdAt: toIsoString(report.createdAt),
		updatedAt: toIsoString(report.updatedAt),
		permissions: mapPermissions(permissions),
		canEdit: canUserEditReport(report, user, permissionsByReportId),
		canApprove: canUserApproveReport(report, user),
		canSendToClient: canUserSendReportToClient(report, user),
	};
};

const loadBaseProjects = async (user: AuthLikeUser) => {
	if (canManageAllReports(user)) {
		return db
			.select({
				id: projects.id,
				name: projects.name,
				status: projects.status,
				city: projects.city,
				district: projects.district,
				description: projects.description,
				clientId: projects.clientId,
				clientName: projectClient.name,
				clientEmail: projectClient.email,
				updatedAt: projects.updatedAt,
			})
			.from(projects)
			.leftJoin(projectClient, eq(projects.clientId, projectClient.id))
			.orderBy(desc(projects.updatedAt));
	}

	if (user.role === "employee" && user.id) {
		return db
			.select({
				id: projects.id,
				name: projects.name,
				status: projects.status,
				city: projects.city,
				district: projects.district,
				description: projects.description,
				clientId: projects.clientId,
				clientName: projectClient.name,
				clientEmail: projectClient.email,
				updatedAt: projects.updatedAt,
			})
			.from(projectAssignments)
			.innerJoin(projects, eq(projectAssignments.projectId, projects.id))
			.leftJoin(projectClient, eq(projects.clientId, projectClient.id))
			.where(eq(projectAssignments.userId, user.id))
			.orderBy(desc(projects.updatedAt));
	}

	return [];
};

const loadProjectTasks = async (projectIds: string[]) => {
	if (projectIds.length === 0) return [];

	return db
		.select({
			id: tasks.id,
			projectId: tasks.projectId,
			name: tasks.name,
			status: tasks.status,
			startDate: tasks.startDate,
			endDate: tasks.endDate,
			createdAt: tasks.createdAt,
			updatedAt: tasks.updatedAt,
		})
		.from(tasks)
		.where(inArray(tasks.projectId, projectIds));
};

const loadProjectNotes = async (projectIds: string[]) => {
	if (projectIds.length === 0) return [];

	return db
		.select({
			id: projectNotes.id,
			projectId: projectNotes.projectId,
			content: projectNotes.content,
			authorId: projectNotes.authorId,
			authorName: noteAuthor.name,
			authorEmail: noteAuthor.email,
			createdAt: projectNotes.createdAt,
			updatedAt: projectNotes.updatedAt,
		})
		.from(projectNotes)
		.leftJoin(noteAuthor, eq(projectNotes.authorId, noteAuthor.id))
		.where(inArray(projectNotes.projectId, projectIds))
		.orderBy(desc(projectNotes.createdAt));
};

const loadRawReports = async (projectIds: string[]) => {
	if (projectIds.length === 0) return [];

	return db
		.select({
			id: projectReports.id,
			projectId: projectReports.projectId,
			reportType: projectReports.reportType,
			title: projectReports.title,
			summary: projectReports.summary,
			details: projectReports.details,
			workDetails: projectReports.workDetails,
			attachments: projectReports.attachments,
			recipients: projectReports.recipients,
			status: projectReports.status,
			authorId: projectReports.authorId,
			authorName: reportAuthor.name,
			approvedBy: projectReports.approvedBy,
			approvedByName: reportApprover.name,
			approvedAt: projectReports.approvedAt,
			rejectionReason: projectReports.rejectionReason,
			adminDecisionNote: projectReports.adminDecisionNote,
			pdfStatus: projectReports.pdfStatus,
			emailStatus: projectReports.emailStatus,
			whatsappStatus: projectReports.whatsappStatus,
			lastDeliveryError: projectReports.lastDeliveryError,
			sentAt: projectReports.sentAt,
			createdAt: projectReports.createdAt,
			updatedAt: projectReports.updatedAt,
		})
		.from(projectReports)
		.leftJoin(reportAuthor, eq(projectReports.authorId, reportAuthor.id))
		.leftJoin(reportApprover, eq(projectReports.approvedBy, reportApprover.id))
		.where(inArray(projectReports.projectId, projectIds))
		.orderBy(desc(projectReports.createdAt));
};

const loadRawLetters = async (projectIds: string[]) => {
	if (projectIds.length === 0) return [];

	return db
		.select({
			id: projectLetters.id,
			projectId: projectLetters.projectId,
			recipientName: projectLetters.recipientName,
			subject: projectLetters.subject,
			body: projectLetters.body,
			letterDate: projectLetters.letterDate,
			attachments: projectLetters.attachments,
			status: projectLetters.status,
			authorId: projectLetters.authorId,
			authorName: letterAuthor.name,
			authorEmail: letterAuthor.email,
			createdAt: projectLetters.createdAt,
			updatedAt: projectLetters.updatedAt,
		})
		.from(projectLetters)
		.leftJoin(letterAuthor, eq(projectLetters.authorId, letterAuthor.id))
		.where(inArray(projectLetters.projectId, projectIds))
		.orderBy(desc(projectLetters.createdAt));
};

const loadReportPermissions = async (reportIds: string[]) => {
	if (reportIds.length === 0) return [];

	return db
		.select({
			reportId: projectReportPermissions.reportId,
			userId: projectReportPermissions.userId,
			accessLevel: projectReportPermissions.accessLevel,
			userName: reportPermissionUser.name,
			userEmail: reportPermissionUser.email,
		})
		.from(projectReportPermissions)
		.leftJoin(reportPermissionUser, eq(projectReportPermissions.userId, reportPermissionUser.id))
		.where(inArray(projectReportPermissions.reportId, reportIds));
};

const loadProjectTeamMembers = async (projectIds: string[]) => {
	if (projectIds.length === 0) return [];

	return db
		.select({
			projectId: projectAssignments.projectId,
			id: users.id,
			name: users.name,
			email: users.email,
			role: users.role,
		})
		.from(projectAssignments)
		.innerJoin(users, eq(projectAssignments.userId, users.id))
		.where(inArray(projectAssignments.projectId, projectIds));
};

export const getInternalActivityUsers = async (): Promise<ActivityUser[]> => {
	const internalUsers = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			role: users.role,
		})
		.from(users)
		.where(inArray(users.role, ["admin", "moderator", "employee"]));

	return internalUsers;
};

export const getActivityProjectsPayload = async (user: AuthLikeUser) => {
	const baseProjects = (await loadBaseProjects(user)) as BaseProjectRow[];
	const projectIds = baseProjects.map((project) => project.id);
	const [projectTasks, rawNotes, rawReports, rawLetters, teamRows, internalUsers] = await Promise.all([
		loadProjectTasks(projectIds),
		loadProjectNotes(projectIds),
		loadRawReports(projectIds),
		loadRawLetters(projectIds),
		loadProjectTeamMembers(projectIds),
		getInternalActivityUsers(),
	]);

	const permissions = await loadReportPermissions(rawReports.map((report) => report.id));

	const permissionsByReportId = new Map<string, RawReportPermissionRow[]>();
	permissions.forEach((permission) => {
		const current = permissionsByReportId.get(permission.reportId) ?? [];
		current.push(permission);
		permissionsByReportId.set(permission.reportId, current);
	});

	const accessibleReports = getAccessibleReports(rawReports, user, permissionsByReportId).map((report) =>
		mapReport(report, user, permissionsByReportId)
	);
	const reportsByProjectId = new Map<string, ActivityReport[]>();
	accessibleReports.forEach((report) => {
		const current = reportsByProjectId.get(report.projectId) ?? [];
		current.push(report);
		reportsByProjectId.set(report.projectId, current);
	});
	const lettersByProjectId = new Map<string, ActivityLetter[]>();
	rawLetters.map((letter) => mapLetter(letter, user)).forEach((letter) => {
		const current = lettersByProjectId.get(letter.projectId) ?? [];
		current.push(letter);
		lettersByProjectId.set(letter.projectId, current);
	});

	const notes: ActivityNote[] = rawNotes.map((note) => ({
		id: note.id,
		projectId: note.projectId,
		content: note.content,
		authorId: note.authorId,
		authorName: getDisplayName(note.authorName, note.authorEmail),
		createdAt: toIsoString(note.createdAt),
		updatedAt: toIsoString(note.updatedAt),
	}));
	const notesByProjectId = new Map<string, ActivityNote[]>();
	notes.forEach((note) => {
		const current = notesByProjectId.get(note.projectId) ?? [];
		current.push(note);
		notesByProjectId.set(note.projectId, current);
	});

	const tasksByProjectId = new Map<string, ProjectTaskRow[]>();
	projectTasks.forEach((task) => {
		const current = tasksByProjectId.get(task.projectId) ?? [];
		current.push(task);
		tasksByProjectId.set(task.projectId, current);
	});

	const teamByProjectId = new Map<string, ActivityUser[]>();
	teamRows.forEach((member) => {
		const current = teamByProjectId.get(member.projectId) ?? [];
		current.push({
			id: member.id,
			name: member.name,
			email: member.email,
			role: member.role,
		});
		teamByProjectId.set(member.projectId, current);
	});

	const summaries: ActivityProjectSummary[] = baseProjects.map((project) => {
		const projectTaskList = tasksByProjectId.get(project.id) ?? [];
		const projectNotesList = notesByProjectId.get(project.id) ?? [];
		const projectReportsList = reportsByProjectId.get(project.id) ?? [];
		const projectLettersList = lettersByProjectId.get(project.id) ?? [];
		const lastActivityDate = getLastActivityDate({
			project,
			projectTasks: projectTaskList,
			projectNotesList,
			projectReportsList,
			projectLettersList,
		});

		return {
			id: project.id,
			name: project.name,
			status: project.status,
			city: project.city,
			district: project.district,
			clientName: project.clientName,
			clientEmail: project.clientEmail,
			lastActivityAt: toIsoString(lastActivityDate),
			lastUpdatedAt: toIsoString(project.updatedAt),
			noteCount: projectNotesList.length,
			lastNote: projectNotesList[0] ?? null,
			reportCount: projectReportsList.length,
			pendingApprovalCount: projectReportsList.filter(
				(report) => report.status === "pending_admin_approval"
			).length,
			overdueTaskCount: projectTaskList.filter(isTaskOverdue).length,
			clientActionTaskCount: projectTaskList.filter(needsClientAction).length,
			totalTaskCount: projectTaskList.length,
			teamCount: (teamByProjectId.get(project.id) ?? []).length,
		};
	});

	return {
		projects: summaries,
		internalUsers,
	};
};

export const getActivityProjectDetails = async (
	projectId: string,
	user: AuthLikeUser
): Promise<ActivityProjectDetails | null> => {
	const baseProjects = await loadBaseProjects(user);
	const baseProject = (baseProjects as BaseProjectRow[]).find((project) => project.id === projectId);

	if (!baseProject) {
		return null;
	}

	const [projectTasks, rawNotes, rawReports, rawLetters, teamRows] = await Promise.all([
		loadProjectTasks([projectId]),
		loadProjectNotes([projectId]),
		loadRawReports([projectId]),
		loadRawLetters([projectId]),
		loadProjectTeamMembers([projectId]),
	]);

	const permissions = await loadReportPermissions(rawReports.map((report) => report.id));
	const permissionsByReportId = new Map<string, RawReportPermissionRow[]>();
	permissions.forEach((permission) => {
		const current = permissionsByReportId.get(permission.reportId) ?? [];
		current.push(permission);
		permissionsByReportId.set(permission.reportId, current);
	});

	const accessibleReports = getAccessibleReports(rawReports, user, permissionsByReportId).map((report) =>
		mapReport(report, user, permissionsByReportId)
	);
	const notes: ActivityNote[] = rawNotes.map((note) => ({
		id: note.id,
		projectId: note.projectId,
		content: note.content,
		authorId: note.authorId,
		authorName: getDisplayName(note.authorName, note.authorEmail),
		createdAt: toIsoString(note.createdAt),
		updatedAt: toIsoString(note.updatedAt),
	}));
	const teamMembers: ActivityUser[] = teamRows.map((member) => ({
		id: member.id,
		name: member.name,
		email: member.email,
		role: member.role,
	}));
	const letters = rawLetters.map((letter) => mapLetter(letter, user));

	const summary: ActivityProjectSummary = {
		id: baseProject.id,
		name: baseProject.name,
		status: baseProject.status,
		city: baseProject.city,
		district: baseProject.district,
		clientName: baseProject.clientName,
		clientEmail: baseProject.clientEmail,
		lastActivityAt: toIsoString(
			getLastActivityDate({
				project: baseProject,
				projectTasks,
				projectNotesList: notes,
				projectReportsList: accessibleReports,
				projectLettersList: letters,
			})
		),
		lastUpdatedAt: toIsoString(baseProject.updatedAt),
		noteCount: notes.length,
		lastNote: notes[0] ?? null,
		reportCount: accessibleReports.length,
		pendingApprovalCount: accessibleReports.filter(
			(report) => report.status === "pending_admin_approval"
		).length,
		overdueTaskCount: projectTasks.filter(isTaskOverdue).length,
		clientActionTaskCount: projectTasks.filter(needsClientAction).length,
		totalTaskCount: projectTasks.length,
		teamCount: teamMembers.length,
	};

	const activities = [
		...projectTasks.flatMap((task) => {
			const items: ActivityProjectDetails["activities"] = [];

			if (task.updatedAt || task.createdAt) {
				items.push({
					id: `task-update-${task.id}`,
					type: "task",
					title: "تحديث مهمة",
					description: `${task.name} • ${task.status}`,
					occurredAt: toIsoString(task.updatedAt ?? task.createdAt),
					priority: "low",
				});
			}

			if (isTaskOverdue(task)) {
				items.push({
					id: `task-overdue-${task.id}`,
					type: "task",
					title: "مهمة متأخرة",
					description: `${task.name} تجاوزت تاريخ الاستحقاق`,
					occurredAt: toIsoString(task.endDate),
					priority: "high",
				});
			}

			if (needsClientAction(task)) {
				items.push({
					id: `task-client-action-${task.id}`,
					type: "task",
					title: "بانتظار إجراء العميل",
					description: `${task.name} تحتاج اعتمادًا أو ملاحظات من العميل`,
					occurredAt: toIsoString(task.updatedAt ?? task.createdAt),
					priority: "medium",
				});
			}

			return items;
		}),
		...notes.map((note) => ({
			id: `note-${note.id}`,
			type: "note" as const,
			title: "ملاحظة جديدة",
			description: `${note.authorName}: ${note.content}`,
			occurredAt: note.createdAt,
			priority: "low" as const,
		})),
		...accessibleReports.map((report) => ({
			id: `report-${report.id}`,
			type: "report" as const,
			title:
				report.status === "pending_admin_approval"
					? "تقرير بانتظار موافقة الأدمن"
					: report.status === "rejected"
						? "تم رفض تقرير"
						: report.status === "sent"
							? "تم إرسال تقرير للعميل"
							: "تقرير جديد",
			description: `${report.title} • ${report.authorName}`,
			occurredAt: report.sentAt || report.updatedAt || report.createdAt,
			priority:
				report.status === "pending_admin_approval"
					? "medium"
					: report.status === "rejected"
						? "high"
						: "low",
		})),
	].sort((left, right) => {
		const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
		const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
		return rightTime - leftTime;
	});

	return {
		project: {
			...summary,
			description: baseProject.description,
			clientId: baseProject.clientId,
			teamMembers,
		},
		notes,
		reports: accessibleReports,
		letters,
		activities: activities.slice(0, 20),
	};
};

export const getReportById = async (reportId: string, user: AuthLikeUser) => {
	const rawReports = await db
		.select({
			id: projectReports.id,
			projectId: projectReports.projectId,
			reportType: projectReports.reportType,
			title: projectReports.title,
			summary: projectReports.summary,
			details: projectReports.details,
			workDetails: projectReports.workDetails,
			attachments: projectReports.attachments,
			recipients: projectReports.recipients,
			status: projectReports.status,
			authorId: projectReports.authorId,
			authorName: reportAuthor.name,
			approvedBy: projectReports.approvedBy,
			approvedByName: reportApprover.name,
			approvedAt: projectReports.approvedAt,
			rejectionReason: projectReports.rejectionReason,
			adminDecisionNote: projectReports.adminDecisionNote,
			pdfStatus: projectReports.pdfStatus,
			emailStatus: projectReports.emailStatus,
			whatsappStatus: projectReports.whatsappStatus,
			lastDeliveryError: projectReports.lastDeliveryError,
			sentAt: projectReports.sentAt,
			createdAt: projectReports.createdAt,
			updatedAt: projectReports.updatedAt,
		})
		.from(projectReports)
		.leftJoin(reportAuthor, eq(projectReports.authorId, reportAuthor.id))
		.leftJoin(reportApprover, eq(projectReports.approvedBy, reportApprover.id))
		.where(eq(projectReports.id, reportId));

	const rawReport = rawReports[0];
	if (!rawReport) return null;

	const permissions = await loadReportPermissions([reportId]);
	const permissionsByReportId = new Map<string, RawReportPermissionRow[]>([[reportId, permissions]]);
	if (!canUserAccessReport(rawReport, user, permissionsByReportId)) {
		return null;
	}

	return mapReport(rawReport, user, permissionsByReportId);
};

export const canUserModifyReport = async (reportId: string, user: AuthLikeUser) => {
	const rawReports = await db
		.select({
			id: projectReports.id,
			projectId: projectReports.projectId,
			reportType: projectReports.reportType,
			title: projectReports.title,
			summary: projectReports.summary,
			details: projectReports.details,
			workDetails: projectReports.workDetails,
			attachments: projectReports.attachments,
			recipients: projectReports.recipients,
			status: projectReports.status,
			authorId: projectReports.authorId,
			authorName: reportAuthor.name,
			approvedBy: projectReports.approvedBy,
			approvedByName: reportApprover.name,
			approvedAt: projectReports.approvedAt,
			rejectionReason: projectReports.rejectionReason,
			adminDecisionNote: projectReports.adminDecisionNote,
			pdfStatus: projectReports.pdfStatus,
			emailStatus: projectReports.emailStatus,
			whatsappStatus: projectReports.whatsappStatus,
			lastDeliveryError: projectReports.lastDeliveryError,
			sentAt: projectReports.sentAt,
			createdAt: projectReports.createdAt,
			updatedAt: projectReports.updatedAt,
		})
		.from(projectReports)
		.leftJoin(reportAuthor, eq(projectReports.authorId, reportAuthor.id))
		.leftJoin(reportApprover, eq(projectReports.approvedBy, reportApprover.id))
		.where(eq(projectReports.id, reportId));

	const rawReport = rawReports[0];
	if (!rawReport) return false;

	const permissions = await loadReportPermissions([reportId]);
	const permissionsByReportId = new Map<string, RawReportPermissionRow[]>([[reportId, permissions]]);
	return canUserEditReport(rawReport, user, permissionsByReportId);
};

export const getLetterById = async (letterId: string, user: AuthLikeUser) => {
	const rawLetters = await db
		.select({
			id: projectLetters.id,
			projectId: projectLetters.projectId,
			recipientName: projectLetters.recipientName,
			subject: projectLetters.subject,
			body: projectLetters.body,
			letterDate: projectLetters.letterDate,
			attachments: projectLetters.attachments,
			status: projectLetters.status,
			authorId: projectLetters.authorId,
			authorName: letterAuthor.name,
			authorEmail: letterAuthor.email,
			createdAt: projectLetters.createdAt,
			updatedAt: projectLetters.updatedAt,
		})
		.from(projectLetters)
		.leftJoin(letterAuthor, eq(projectLetters.authorId, letterAuthor.id))
		.where(eq(projectLetters.id, letterId));

	const rawLetter = rawLetters[0];
	if (!rawLetter) return null;

	const hasAccess = await userCanAccessProjectActivity(rawLetter.projectId, user);
	if (!hasAccess) {
		return null;
	}

	return mapLetter(rawLetter, user);
};

export const canUserModifyLetter = async (letterId: string, user: AuthLikeUser) => {
	const rawLetters = await db
		.select({
			id: projectLetters.id,
			projectId: projectLetters.projectId,
			recipientName: projectLetters.recipientName,
			subject: projectLetters.subject,
			body: projectLetters.body,
			letterDate: projectLetters.letterDate,
			attachments: projectLetters.attachments,
			status: projectLetters.status,
			authorId: projectLetters.authorId,
			authorName: letterAuthor.name,
			authorEmail: letterAuthor.email,
			createdAt: projectLetters.createdAt,
			updatedAt: projectLetters.updatedAt,
		})
		.from(projectLetters)
		.leftJoin(letterAuthor, eq(projectLetters.authorId, letterAuthor.id))
		.where(eq(projectLetters.id, letterId));

	const rawLetter = rawLetters[0];
	if (!rawLetter) return false;

	const hasAccess = await userCanAccessProjectActivity(rawLetter.projectId, user);
	if (!hasAccess) return false;

	return canUserEditLetter(rawLetter, user);
};

export const getProjectAndClientById = async (projectId: string) => {
	const rows = await db
		.select({
			id: projects.id,
			name: projects.name,
			status: projects.status,
			description: projects.description,
			clientId: projects.clientId,
			clientName: projectClient.name,
			clientEmail: projectClient.email,
			city: projects.city,
			district: projects.district,
		})
		.from(projects)
		.leftJoin(projectClient, eq(projects.clientId, projectClient.id))
		.where(eq(projects.id, projectId));

	return rows[0] ?? null;
};

export const userCanAccessProjectActivity = async (projectId: string, user: AuthLikeUser) => {
	if (!canAccessActivity(user)) return false;
	const baseProjects = await loadBaseProjects(user);
	return (baseProjects as BaseProjectRow[]).some((project) => project.id === projectId);
};

export const getProjectReportPermissionRows = async (reportId: string) =>
	loadReportPermissions([reportId]);
