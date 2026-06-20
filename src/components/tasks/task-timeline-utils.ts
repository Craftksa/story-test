import {
	addDays,
	differenceInCalendarDays,
	endOfWeek,
	isValid,
	parse,
	startOfDay,
	startOfWeek,
} from "date-fns";

export type TimelineSourceTask = Record<string, unknown> & {
	taskId?: string;
	taskName?: string;
	taskStatus?: string;
	taskType?: string;
	title?: string;
	name?: string;
	startDate?: string | Date | null;
	endDate?: string | Date | null;
	dueDate?: string | Date | null;
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
	title: string;
	name: string;
	status: string;
	type: string;
	groupKey: string;
	groupLabel: string;
	startDate: Date | null;
	endDate: Date | null;
	dueDate: Date | null;
	placementDate: Date;
	hasStartDate: boolean;
	hasExplicitEndDate: boolean;
	isScheduled: boolean;
	isMilestone: boolean;
	createdAt: Date | null;
	updatedAt: Date | null;
	notes: string | null;
	owner: string | null;
	ownerLabel: string | null;
	progress: number;
	priority: "high" | "medium" | "low";
	isOverdue: boolean;
	durationDays: number;
	originalTask: TimelineSourceTask;
};

export type TimelineRange = {
	start: Date;
	end: Date;
	totalDays: number;
};

const GROUP_ORDER: Record<string, number> = {
	construction: 0,
	foundations: 0,
	architectural: 1,
	finishes: 1,
	mechanical: 2,
	electrical: 3,
	general: 4,
};

function toDate(value: unknown): Date | null {
	if (!value) return null;

	if (value instanceof Date) {
		return isValid(value) ? startOfDay(value) : null;
	}

	const rawValue = String(value).trim();
	if (!rawValue) return null;

	const explicitFormats = [
		"yyyy-MM-dd",
		"yyyy/MM/dd",
		"dd/MM/yyyy",
		"d/M/yyyy",
		"dd-MM-yyyy",
		"d-M-yyyy",
		"dd.MM.yyyy",
		"d.M.yyyy",
		"yyyy-MM-dd'T'HH:mm:ss.SSSX",
		"yyyy-MM-dd'T'HH:mm:ssX",
	];

	for (const formatPattern of explicitFormats) {
		const parsedWithFormat = parse(rawValue, formatPattern, new Date());
		if (isValid(parsedWithFormat)) {
			return startOfDay(parsedWithFormat);
		}
	}

	const parsed = new Date(rawValue);
	return isValid(parsed) ? startOfDay(parsed) : null;
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(maximum, Math.max(minimum, value));
}

function normalizeTaskType(type: unknown) {
	if (typeof type !== "string" || !type.trim()) {
		return {
			key: "general",
			label: "general",
		};
	}

	const value = type.trim();
	const normalized = value.toLowerCase();

	if (
		[
			"foundations",
			"foundation",
			"structural",
			"construction",
			"civil",
			"إنشائي",
			"انشائي",
		].includes(normalized)
	) {
		return {
			key: "construction",
			label: "construction",
		};
	}

	if (
		[
			"finishes",
			"finish",
			"architectural",
			"architecture",
			"معماري",
		].includes(normalized)
	) {
		return {
			key: "architectural",
			label: "architectural",
		};
	}

	if (["mechanical", "ميكانيكي"].includes(normalized)) {
		return {
			key: "mechanical",
			label: "mechanical",
		};
	}

	if (["electrical", "كهربائي"].includes(normalized)) {
		return {
			key: "electrical",
			label: "electrical",
		};
	}

	return {
		key: normalized.replace(/\s+/g, "_"),
		label: value,
	};
}

function normalizeTaskStatus(status: unknown) {
	if (typeof status !== "string" || !status.trim()) {
		return "not_started";
	}

	return status.trim().toLowerCase();
}

function getTaskProgress(status: string, hasStartDate: boolean, startDate: Date | null, endDate: Date | null, referenceDate: Date) {
	if (status === "completed") return 100;
	if (status === "not_started" || status === "pending") return 0;
	if (["on_hold", "paused", "stopped", "blocked"].includes(status)) return 38;
	if (status === "needs_review") return 88;

	if (!hasStartDate || !startDate || !endDate) {
		return 22;
	}

	const totalDays = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
	const elapsedDays = clamp(
		differenceInCalendarDays(referenceDate, startDate) + 1,
		1,
		totalDays
	);

	return Math.round(clamp(elapsedDays / totalDays, 0.15, 0.92) * 100);
}

function getTaskPriority(status: string, isOverdue: boolean): "high" | "medium" | "low" {
	if (isOverdue || ["on_hold", "paused", "stopped", "blocked"].includes(status)) return "high";
	if (["in_progress", "working", "active", "needs_review"].includes(status)) return "medium";
	return "low";
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

function getTaskName(task: TimelineSourceTask, index: number) {
	const candidates = [
		typeof task.taskName === "string" ? task.taskName : null,
		typeof task.title === "string" ? task.title : null,
		typeof task.name === "string" ? task.name : null,
	];

	for (const candidate of candidates) {
		if (candidate?.trim()) return candidate.trim();
	}

	return `Task ${index + 1}`;
}

function getTaskId(task: TimelineSourceTask, index: number) {
	if (typeof task.taskId === "string" && task.taskId.trim()) {
		return task.taskId.trim();
	}

	return `timeline-task-${index + 1}`;
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
		.map<TimelineTask>((task, index) => {
			const createdAt = toDate(task.createdAt);
			const updatedAt = toDate(task.updatedAt);
			const startDate = toDate(task.startDate);
			const explicitEndDate = toDate(task.endDate) ?? toDate(task.dueDate);
			const safeEndDate =
				startDate && explicitEndDate && explicitEndDate.getTime() < startDate.getTime()
					? startDate
					: explicitEndDate;
			const placementDate = startDate ?? safeEndDate ?? updatedAt ?? createdAt ?? referenceDate;
			const status = normalizeTaskStatus(task.taskStatus);
			const typeMeta = normalizeTaskType(task.taskType);
			const isOverdue =
				Boolean(safeEndDate) &&
				status !== "completed" &&
				safeEndDate.getTime() < referenceDate.getTime();
			const isScheduled = Boolean(startDate && safeEndDate);
			const durationDays =
				isScheduled && startDate && safeEndDate
					? Math.max(1, differenceInCalendarDays(safeEndDate, startDate) + 1)
					: 1;
			const isMilestone =
				Boolean(startDate && safeEndDate) &&
				differenceInCalendarDays(safeEndDate, startDate) === 0;
			const ownerLabel = getOwnerLabel(task, projectTeam);

			return {
				id: getTaskId(task, index),
				title: getTaskName(task, index),
				name: getTaskName(task, index),
				status,
				type: typeMeta.label,
				groupKey: typeMeta.key,
				groupLabel: typeMeta.label,
				startDate,
				endDate: safeEndDate,
				dueDate: safeEndDate ?? startDate ?? placementDate,
				placementDate,
				hasStartDate: Boolean(startDate),
				hasExplicitEndDate: Boolean(safeEndDate),
				isScheduled,
				isMilestone,
				createdAt,
				updatedAt,
				notes: typeof task.notes === "string" ? task.notes : null,
				owner: ownerLabel,
				ownerLabel,
				progress: getTaskProgress(status, Boolean(startDate), startDate, safeEndDate, referenceDate),
				priority: getTaskPriority(status, isOverdue),
				isOverdue,
				durationDays,
				originalTask: task,
			};
		})
		.sort((left, right) => {
			if (left.groupKey !== right.groupKey) {
				return left.groupLabel.localeCompare(right.groupLabel);
			}

			return (
				(GROUP_ORDER[left.groupKey] ?? 99) - (GROUP_ORDER[right.groupKey] ?? 99) ||
				left.placementDate.getTime() - right.placementDate.getTime() ||
				left.name.localeCompare(right.name)
			);
		});
}

export function getTimelineRange(tasks: TimelineTask[], referenceDate = new Date()): TimelineRange {
	const safeReferenceDate = startOfDay(referenceDate);
	const startCandidates = tasks
		.map((task) => task.startDate)
		.filter((date): date is Date => Boolean(date));
	const endCandidates = tasks
		.map((task) => task.endDate ?? task.startDate)
		.filter((date): date is Date => Boolean(date));

	if (startCandidates.length === 0 && endCandidates.length === 0) {
		const start = addDays(safeReferenceDate, -7);
		const end = addDays(start, 27);
		return {
			start,
			end,
			totalDays: differenceInCalendarDays(end, start) + 1,
		};
	}

	let start = startCandidates[0] ?? endCandidates[0] ?? safeReferenceDate;
	let end = endCandidates[0] ?? startCandidates[0] ?? start;

	for (const candidate of startCandidates) {
		if (candidate.getTime() < start.getTime()) start = candidate;
	}

	for (const candidate of endCandidates) {
		if (candidate.getTime() > end.getTime()) end = candidate;
	}

	if (end.getTime() < start.getTime()) {
		end = start;
	}

	if (differenceInCalendarDays(end, start) < 13) {
		end = addDays(start, 13);
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
			if (!task.hasStartDate && !task.hasExplicitEndDate) {
				return false;
			}

			const taskStart = task.startDate ?? task.placementDate;
			const taskEnd = task.endDate ?? taskStart;
			const startsThisWeek =
				taskStart.getTime() >= weekStart.getTime() &&
				taskStart.getTime() <= weekEnd.getTime();
			const endsThisWeek =
				taskEnd.getTime() >= weekStart.getTime() &&
				taskEnd.getTime() <= weekEnd.getTime();
			const spansThisWeek =
				taskStart.getTime() <= weekEnd.getTime() &&
				taskEnd.getTime() >= weekStart.getTime();

			return startsThisWeek || endsThisWeek || spansThisWeek;
		})
		.sort(
			(left, right) =>
				(left.dueDate ?? left.placementDate).getTime() - (right.dueDate ?? right.placementDate).getTime() ||
				left.placementDate.getTime() - right.placementDate.getTime()
		);
}
