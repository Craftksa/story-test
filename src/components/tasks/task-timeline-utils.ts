import {
	addDays,
	differenceInCalendarDays,
	endOfWeek,
	isValid,
	startOfDay,
	startOfWeek,
} from "date-fns";

export type TimelineSourceTask = Record<string, unknown> & {
	taskId?: string;
	taskName?: string;
	taskStatus?: string;
	taskType?: string;
	startDate?: string | Date | null;
	endDate?: string | Date | null;
	createdAt?: string | Date | null;
	updatedAt?: string | Date | null;
	notes?: string | null;
};

export type TimelineTeamMember = {
	id?: string | null;
	name?: string | null;
	email?: string | null;
};

export type TimelineTask = {
	id: string;
	name: string;
	status: string;
	type: string;
	startDate: Date;
	endDate: Date;
	dueDate: Date;
	createdAt: Date | null;
	updatedAt: Date | null;
	notes: string | null;
	ownerLabel: string | null;
	progress: number;
	priority: "high" | "medium" | "low";
	dependencies: string[];
	visualDependencies: string[];
	isMilestone: boolean;
	milestoneDate: Date | null;
	isOverdue: boolean;
	durationDays: number;
};

export type TimelineRange = {
	start: Date;
	end: Date;
	totalDays: number;
};

const MILESTONE_KEYWORDS = [
	"approval",
	"handover",
	"review",
	"inspection",
	"sign off",
	"sign-off",
	"closeout",
];

function toDate(value: unknown): Date | null {
	if (!value) return null;

	if (value instanceof Date) {
		return isValid(value) ? startOfDay(value) : null;
	}

	const parsed = new Date(String(value));
	return isValid(parsed) ? startOfDay(parsed) : null;
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(maximum, Math.max(minimum, value));
}

function getTaskProgress(status: string, startDate: Date, endDate: Date, referenceDate: Date) {
	if (status === "completed") return 100;
	if (status === "not_started") return 0;
	if (status === "on_hold") return 38;
	if (status === "needs_review") return 88;

	const totalDays = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
	const elapsedDays = clamp(
		differenceInCalendarDays(referenceDate, startDate) + 1,
		1,
		totalDays
	);

	return Math.round(clamp(elapsedDays / totalDays, 0.15, 0.92) * 100);
}

function getTaskPriority(status: string, isOverdue: boolean): "high" | "medium" | "low" {
	if (isOverdue || status === "on_hold") return "high";
	if (status === "in_progress" || status === "needs_review") return "medium";
	return "low";
}

function getExplicitDependencies(task: TimelineSourceTask) {
	const dependencySources = [
		task.dependencies,
		task.dependencyIds,
		task.dependsOn,
		task.dependsOnTaskIds,
		task.predecessors,
	];

	for (const source of dependencySources) {
		if (!Array.isArray(source)) continue;
		const ids = source
			.map((item) => {
				if (typeof item === "string") return item.trim();
				if (!item || typeof item !== "object") return "";
				if ("id" in item && typeof item.id === "string") return item.id.trim();
				if ("taskId" in item && typeof item.taskId === "string") return item.taskId.trim();
				return "";
			})
			.filter(Boolean);
		if (ids.length > 0) return ids;
	}

	return [];
}

function getOwnerLabel(task: TimelineSourceTask, projectTeam: TimelineTeamMember[]) {
	const ownerCandidates = [
		typeof task.ownerName === "string" ? task.ownerName : null,
		typeof task.owner === "string" ? task.owner : null,
		typeof task.assigneeName === "string" ? task.assigneeName : null,
		typeof task.assignedToName === "string" ? task.assignedToName : null,
		typeof task.responsibleUserName === "string" ? task.responsibleUserName : null,
	];

	for (const ownerCandidate of ownerCandidates) {
		if (ownerCandidate?.trim()) return ownerCandidate.trim();
	}

	const ownerObjects = [task.owner, task.assignee, task.responsibleUser];
	for (const ownerObject of ownerObjects) {
		if (
			ownerObject &&
			typeof ownerObject === "object" &&
			"name" in ownerObject &&
			typeof ownerObject.name === "string" &&
			ownerObject.name.trim()
		) {
			return ownerObject.name.trim();
		}
	}

	const teamMembers = projectTeam
		.map((member) => member.name?.trim() || member.email?.trim() || "")
		.filter(Boolean);

	return teamMembers.length > 0 ? teamMembers.join(", ") : null;
}

function hasMilestoneSignal(task: TimelineTask) {
	const normalizedName = task.name.toLowerCase();
	return MILESTONE_KEYWORDS.some((keyword) => normalizedName.includes(keyword));
}

export function createTimelineTasks(
	tasks: TimelineSourceTask[],
	projectTeam: TimelineTeamMember[] = [],
	options?: {
		referenceDate?: Date;
	}
) {
	const referenceDate = startOfDay(options?.referenceDate ?? new Date());

	return tasks
		.flatMap<TimelineTask>((task) => {
			const id =
				typeof task.taskId === "string" && task.taskId.trim() ? task.taskId.trim() : null;
			const name =
				typeof task.taskName === "string" && task.taskName.trim()
					? task.taskName.trim()
					: null;

			if (!id || !name) {
				return [];
			}

			const createdAt = toDate(task.createdAt);
			const updatedAt = toDate(task.updatedAt);
			const startDate = toDate(task.startDate) ?? createdAt ?? referenceDate;
			const endDateCandidate =
				toDate(task.endDate) ?? toDate(task.dueDate) ?? startDate ?? createdAt ?? referenceDate;
			const endDate =
				endDateCandidate.getTime() < startDate.getTime() ? startDate : endDateCandidate;
			const status =
				typeof task.taskStatus === "string" && task.taskStatus.trim()
					? task.taskStatus
					: "not_started";
			const isOverdue =
				status !== "completed" && endDate.getTime() < referenceDate.getTime();
			const dependencies = getExplicitDependencies(task);
			const isMilestone = hasMilestoneSignal({
				id,
				name,
				status,
				type: "",
				startDate,
				endDate,
				dueDate: endDate,
				createdAt,
				updatedAt,
				notes: typeof task.notes === "string" ? task.notes : null,
				ownerLabel: null,
				progress: 0,
				priority: "low",
				dependencies: [],
				visualDependencies: [],
				isMilestone: false,
				milestoneDate: null,
				isOverdue,
				durationDays: 1,
			});

			return [
				{
					id,
					name,
					status,
					type:
						(typeof task.taskType === "string" && task.taskType.trim()) || "general",
					startDate,
					endDate,
					dueDate: endDate,
					createdAt,
					updatedAt,
					notes: typeof task.notes === "string" ? task.notes : null,
					ownerLabel: getOwnerLabel(task, projectTeam),
					progress: getTaskProgress(status, startDate, endDate, referenceDate),
					priority: getTaskPriority(status, isOverdue),
					dependencies,
					visualDependencies: dependencies,
					isMilestone,
					milestoneDate: isMilestone ? endDate : null,
					isOverdue,
					durationDays: Math.max(1, differenceInCalendarDays(endDate, startDate) + 1),
				},
			];
		})
		.sort(
			(left, right) =>
				left.startDate.getTime() - right.startDate.getTime() ||
				left.endDate.getTime() - right.endDate.getTime()
		);
}

export function getTimelineRange(tasks: TimelineTask[], referenceDate = new Date()): TimelineRange {
	const safeReferenceDate = startOfDay(referenceDate);

	if (tasks.length === 0) {
		const start = safeReferenceDate;
		const end = addDays(start, 13);
		return {
			start,
			end,
			totalDays: differenceInCalendarDays(end, start) + 1,
		};
	}

	let start = tasks[0].startDate;
	let end = tasks[0].endDate;

	for (const task of tasks) {
		if (task.startDate.getTime() < start.getTime()) start = task.startDate;
		if (task.endDate.getTime() > end.getTime()) end = task.endDate;
	}

	start = addDays(start, -2);
	end = addDays(end, 2);

	if (safeReferenceDate.getTime() < start.getTime()) {
		start = addDays(safeReferenceDate, -2);
	}

	if (safeReferenceDate.getTime() > end.getTime()) {
		end = addDays(safeReferenceDate, 2);
	}

	if (differenceInCalendarDays(end, start) < 10) {
		end = addDays(start, 10);
	}

	return {
		start,
		end,
		totalDays: differenceInCalendarDays(end, start) + 1,
	};
}

export function getThisWeekTasks(tasks: TimelineTask[], referenceDate = new Date()) {
	const weekStartsOn = 1 as const;
	const weekStart = startOfWeek(referenceDate, { weekStartsOn });
	const weekEnd = endOfWeek(referenceDate, { weekStartsOn });

	return tasks
		.filter((task) => {
			const startsThisWeek =
				task.startDate.getTime() >= weekStart.getTime() &&
				task.startDate.getTime() <= weekEnd.getTime();
			const endsThisWeek =
				task.endDate.getTime() >= weekStart.getTime() &&
				task.endDate.getTime() <= weekEnd.getTime();
			const spansThisWeek =
				task.startDate.getTime() <= weekEnd.getTime() &&
				task.endDate.getTime() >= weekStart.getTime();

			return startsThisWeek || endsThisWeek || spansThisWeek;
		})
		.sort(
			(left, right) =>
				left.endDate.getTime() - right.endDate.getTime() ||
				left.startDate.getTime() - right.startDate.getTime()
		);
}
