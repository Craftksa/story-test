import {
	addDays,
	differenceInCalendarDays,
	endOfWeek,
	format,
	isValid,
	parse,
	startOfDay,
	startOfWeek,
} from "date-fns";
import type { Locale } from "date-fns";

export type TimelineSourceTask = Record<string, unknown> & {
	id?: string | number | null;
	taskId?: string;
	taskName?: string;
	taskStatus?: string;
	taskType?: string;
	title?: string;
	name?: string;
	status?: string | null;
	type?: string | null;
	startDate?: string | Date | null;
	endDate?: string | Date | null;
	dueDate?: string | Date | null;
	createdAt?: string | Date | null;
	updatedAt?: string | Date | null;
	notes?: string | null;
	progress?: number | string | null;
	percentComplete?: number | string | null;
	completion?: number | string | null;
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

export type TimelineRowType = "group" | "task" | "milestone";

export type TimelineRow =
	| {
			id: string;
			key: string;
			rowType: "group";
			title: string;
			groupKey: string;
			groupLabel: string;
			count: number;
			level: number;
			parentId?: string;
			hasValidSchedule: false;
	  }
	| {
			id: string;
			key: string;
			rowType: "task" | "milestone";
			title: string;
			groupKey: string;
			groupLabel: string;
			task: TimelineTask;
			startDate: Date | null;
			endDate: Date | null;
			duration: number | null;
			status: string;
			assignee: string | null;
			taskType: string;
			level: number;
			parentId: string;
			hasValidSchedule: boolean;
	  };

export type TimelineRange = {
	start: Date;
	end: Date;
	totalDays: number;
};

export type TimelineRangeOptions = {
	paddingDays?: number;
	minimumSpanDays?: number;
	fallbackSpanDays?: number;
};

export type GroupedTimelineTasks = {
	groupKey: string;
	groupLabel: string;
	tasks: TimelineTask[];
};

export type TaskDurationLabelOptions = {
	dayLabel?: string;
	daysLabel?: string;
	unscheduledLabel?: string;
};

export type TaskStatusColorClasses = {
	badge: string;
	dot: string;
	progress: string;
	card: string;
	bar: string;
};

export type TaskOperationalTone =
	| "overdue"
	| "this_week"
	| "completed"
	| "in_progress"
	| "upcoming";

export type TaskOperationalColorClasses = {
	tone: TaskOperationalTone;
	dot: string;
	progress: string;
	card: string;
	bar: string;
	bucket: string;
	bucketBadge: string;
};

export type TimelineSortKey =
	| "startDate"
	| "endDate"
	| "status"
	| "type"
	| "duration"
	| "urgency"
	| "updatedAt";

export type TimelineSortDirection = "asc" | "desc";

export type TimelineCollectionFilter =
	| "all"
	| "completed"
	| "active"
	| "upcoming"
	| "overdue"
	| "this_week";

export type TimelineSummary = {
	totalTasks: number;
	completedTasks: number;
	inProgressTasks: number;
	overdueTasks: number;
	thisWeekTasks: number;
	upcomingTasks: number;
	projectProgress: number;
};

export type TimelineDependency = {
	id: string;
	fromTaskId: string;
	toTaskId: string;
	type: "finish_to_start";
};

export type SprintBuckets = {
	active: TimelineTask[];
	starting: TimelineTask[];
	ending: TimelineTask[];
	overdue: TimelineTask[];
	completed: TimelineTask[];
	upcoming: TimelineTask[];
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

const ACTIVE_TASK_STATUSES = ["in_progress", "working", "active", "needs_review"];
const ON_HOLD_TASK_STATUSES = ["on_hold", "paused", "stopped", "blocked"];
const UPCOMING_TASK_STATUSES = ["not_started", "pending"];

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
		["finishes", "finish", "architectural", "architecture", "معماري"].includes(normalized)
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

function toProgressValue(value: unknown) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return clamp(Math.round(value), 0, 100);
	}

	if (typeof value === "string" && value.trim()) {
		const normalized = Number.parseFloat(value.replace("%", "").trim());
		if (Number.isFinite(normalized)) {
			return clamp(Math.round(normalized), 0, 100);
		}
	}

	return null;
}

function getTaskProgress(
	task: TimelineSourceTask,
	status: string,
	hasStartDate: boolean,
	startDate: Date | null,
	endDate: Date | null,
	referenceDate: Date
) {
	const explicitProgress =
		toProgressValue(task.progress) ??
		toProgressValue(task.percentComplete) ??
		toProgressValue(task.completion);

	if (explicitProgress !== null) {
		return explicitProgress;
	}

	if (status === "completed") return 100;
	if (UPCOMING_TASK_STATUSES.includes(status)) return 0;
	if (ON_HOLD_TASK_STATUSES.includes(status)) return 35;
	if (status === "needs_review") return 90;

	if (!hasStartDate || !startDate || !endDate) {
		return ACTIVE_TASK_STATUSES.includes(status) ? 45 : 20;
	}

	const totalDays = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
	const elapsedDays = clamp(
		differenceInCalendarDays(referenceDate, startDate) + 1,
		0,
		totalDays
	);

	return Math.round(clamp(elapsedDays / totalDays, 0.12, 0.94) * 100);
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

export function getTaskOwnerLabel(
	task: TimelineSourceTask | TimelineTask,
	projectTeam: TimelineTeamMember[] = []
) {
	if ("originalTask" in task) {
		return task.ownerLabel ?? getOwnerLabel(task.originalTask as TimelineSourceTask, projectTeam);
	}

	return getOwnerLabel(task, projectTeam);
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
	if (typeof task.id === "string" && task.id.trim()) {
		return task.id.trim();
	}

	if (typeof task.id === "number" && Number.isFinite(task.id)) {
		return String(task.id);
	}

	if (typeof task.taskId === "string" && task.taskId.trim()) {
		return task.taskId.trim();
	}

	return `timeline-task-${index + 1}`;
}

function normalizeDependencyTaskId(value: unknown) {
	if (typeof value === "string" && value.trim()) {
		return value.trim();
	}

	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}

	return null;
}

function collectDependencyIds(value: unknown): string[] {
	if (!value) return [];

	if (Array.isArray(value)) {
		return value.flatMap((entry) => collectDependencyIds(entry));
	}

	const normalizedValue = normalizeDependencyTaskId(value);
	if (normalizedValue) {
		return [normalizedValue];
	}

	if (typeof value === "object") {
		const record = value as Record<string, unknown>;
		const directKeys = [
			"taskId",
			"id",
			"dependencyTaskId",
			"dependsOnTaskId",
			"predecessorId",
			"fromTaskId",
			"sourceTaskId",
		];

		for (const key of directKeys) {
			const candidate = normalizeDependencyTaskId(record[key]);
			if (candidate) {
				return [candidate];
			}
		}

		const nestedKeys = ["dependency", "task", "predecessor", "source"];
		for (const key of nestedKeys) {
			if (record[key]) {
				const nestedMatches = collectDependencyIds(record[key]);
				if (nestedMatches.length > 0) {
					return nestedMatches;
				}
			}
		}
	}

	return [];
}

export function getTaskDependencyIds(task: TimelineSourceTask | TimelineTask) {
	const source = ("originalTask" in task ? task.originalTask : task) as Record<string, unknown>;
	const candidates = [
		source.dependencyIds,
		source.dependsOnTaskIds,
		source.predecessorIds,
		source.dependencies,
		source.dependsOn,
		source.predecessors,
		source.predecessorTaskId,
		source.dependsOnTaskId,
		source.dependencyTaskId,
	];

	return Array.from(
		new Set(
			candidates
				.flatMap((candidate) => collectDependencyIds(candidate))
				.filter((dependencyId) => dependencyId !== ("id" in task ? task.id : null))
				.filter((dependencyId) => dependencyId.trim().length > 0)
		)
	);
}

export function getTimelineDependencies(tasks: TimelineTask[]): TimelineDependency[] {
	const tasksById = new Map(tasks.map((task) => [task.id, task]));
	const dependencies = new Map<string, TimelineDependency>();

	for (const task of tasks) {
		if (!task.isScheduled || !task.startDate || !task.endDate) {
			continue;
		}

		for (const predecessorId of getTaskDependencyIds(task)) {
			const predecessorTask = tasksById.get(predecessorId);

			if (
				!predecessorTask ||
				predecessorId === task.id ||
				!predecessorTask.isScheduled ||
				!predecessorTask.startDate ||
				!predecessorTask.endDate
			) {
				continue;
			}

			const key = `${predecessorId}->${task.id}`;
			if (dependencies.has(key)) {
				continue;
			}

			dependencies.set(key, {
				id: key,
				fromTaskId: predecessorId,
				toTaskId: task.id,
				type: "finish_to_start",
			});
		}
	}

	return Array.from(dependencies.values());
}

function getTaskPriority(args: {
	status: string;
	startDate: Date | null;
	endDate: Date | null;
	isOverdue: boolean;
	referenceDate: Date;
}): "high" | "medium" | "low" {
	const { status, startDate, endDate, isOverdue, referenceDate } = args;

	if (status === "completed") return "low";
	if (isOverdue || ON_HOLD_TASK_STATUSES.includes(status)) return "high";

	const relevantDate = endDate ?? startDate;
	if (relevantDate) {
		const daysUntil = differenceInCalendarDays(relevantDate, referenceDate);
		if (daysUntil <= 2) return "high";
		if (daysUntil <= 7) return "medium";
	}

	if (ACTIVE_TASK_STATUSES.includes(status)) return "medium";
	return "low";
}

function getDateSortValue(date: Date | null | undefined, fallback: Date) {
	return (date ?? fallback).getTime();
}

function getStatusSortRank(status: string) {
	if (status === "completed") return 4;
	if (ACTIVE_TASK_STATUSES.includes(status)) return 3;
	if (ON_HOLD_TASK_STATUSES.includes(status)) return 2;
	if (UPCOMING_TASK_STATUSES.includes(status)) return 1;
	return 0;
}

function getUrgencyScore(task: TimelineTask, referenceDate: Date) {
	if (task.status === "completed") return 0;
	if (task.isOverdue) return 100;
	if (ON_HOLD_TASK_STATUSES.includes(task.status)) return 90;
	if (task.endDate) {
		const daysUntil = differenceInCalendarDays(task.endDate, referenceDate);
		if (daysUntil <= 2) return 85;
		if (daysUntil <= 7) return 65;
	}
	if (ACTIVE_TASK_STATUSES.includes(task.status)) return 55;
	if (task.startDate) {
		const daysUntilStart = differenceInCalendarDays(task.startDate, referenceDate);
		if (daysUntilStart <= 7) return 35;
	}
	return 15;
}

export function isTaskCompleted(task: TimelineTask) {
	return task.status === "completed";
}

export function isTaskActive(task: TimelineTask, referenceDate = new Date()) {
	const safeReferenceDate = startOfDay(referenceDate);

	if (ACTIVE_TASK_STATUSES.includes(task.status)) {
		return true;
	}

	if (task.status === "completed" || ON_HOLD_TASK_STATUSES.includes(task.status)) {
		return false;
	}

	if (!task.startDate || !task.endDate) {
		return false;
	}

	return (
		task.startDate.getTime() <= safeReferenceDate.getTime() &&
		task.endDate.getTime() >= safeReferenceDate.getTime()
	);
}

export function isTaskUpcoming(task: TimelineTask, referenceDate = new Date()) {
	const safeReferenceDate = startOfDay(referenceDate);
	if (task.status === "completed" || task.isOverdue) return false;

	if (task.startDate) {
		return task.startDate.getTime() > safeReferenceDate.getTime();
	}

	return UPCOMING_TASK_STATUSES.includes(task.status);
}

export function isTaskOverdue(task: TimelineTask, referenceDate = new Date()) {
	const safeReferenceDate = startOfDay(referenceDate);
	const comparisonDate = task.endDate ?? task.dueDate;
	if (!comparisonDate || task.status === "completed") return false;
	return comparisonDate.getTime() < safeReferenceDate.getTime();
}

export function getCurrentWeekRange(referenceDate = new Date()) {
	const safeReferenceDate = startOfDay(referenceDate);
	const weekStartsOn = 1 as const;

	return {
		start: startOfWeek(safeReferenceDate, { weekStartsOn }),
		end: endOfWeek(safeReferenceDate, { weekStartsOn }),
	};
}

export function isTaskStartingThisWeek(task: TimelineTask, referenceDate = new Date()) {
	if (!task.startDate) return false;
	const range = getCurrentWeekRange(referenceDate);
	return (
		task.startDate.getTime() >= range.start.getTime() &&
		task.startDate.getTime() <= range.end.getTime()
	);
}

export function isTaskEndingThisWeek(task: TimelineTask, referenceDate = new Date()) {
	if (!task.endDate) return false;
	const range = getCurrentWeekRange(referenceDate);
	return (
		task.endDate.getTime() >= range.start.getTime() &&
		task.endDate.getTime() <= range.end.getTime()
	);
}

export function formatTimelineDate(
	date: Date | null | undefined,
	options?: {
		locale?: Locale;
		fallback?: string;
		formatPattern?: string;
	}
) {
	if (!date) return options?.fallback ?? "-";

	return format(date, options?.formatPattern ?? "d MMM yyyy", {
		locale: options?.locale,
	});
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
			const derivedEndDate = startDate && !explicitEndDate ? addDays(startDate, 2) : explicitEndDate;
			const safeEndDate =
				startDate && derivedEndDate && derivedEndDate.getTime() < startDate.getTime()
					? startDate
					: derivedEndDate;
			const placementDate = startDate ?? safeEndDate ?? updatedAt ?? createdAt ?? referenceDate;
			const status = normalizeTaskStatus(task.taskStatus ?? task.status);
			const typeMeta = normalizeTaskType(task.taskType ?? task.type);
			const scheduledStartDate = startDate;
			const scheduledEndDate = safeEndDate;
			const overdue =
				Boolean(scheduledEndDate) &&
				status !== "completed" &&
				(scheduledEndDate ? scheduledEndDate.getTime() < referenceDate.getTime() : false);
			const isScheduled = Boolean(scheduledStartDate && scheduledEndDate);
			const durationDays =
				scheduledStartDate && scheduledEndDate
					? Math.max(1, differenceInCalendarDays(scheduledEndDate, scheduledStartDate) + 1)
					: 1;
			const isMilestone =
				scheduledStartDate && scheduledEndDate
					? differenceInCalendarDays(scheduledEndDate, scheduledStartDate) === 0
					: false;
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
				progress: getTaskProgress(task, status, Boolean(startDate), startDate, safeEndDate, referenceDate),
				priority: getTaskPriority({
					status,
					startDate,
					endDate: safeEndDate,
					isOverdue: overdue,
					referenceDate,
				}),
				isOverdue: overdue,
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

export function buildTimelineRows(tasks: TimelineTask[]): TimelineRow[] {
	const rows: TimelineRow[] = [];
	const groupedTasks = new Map<string, { label: string; tasks: TimelineTask[] }>();

	for (const task of tasks) {
		const existingGroup = groupedTasks.get(task.groupKey);
		if (existingGroup) {
			existingGroup.tasks.push(task);
			continue;
		}

		groupedTasks.set(task.groupKey, {
			label: task.groupLabel,
			tasks: [task],
		});
	}

	for (const [groupKey, group] of groupedTasks.entries()) {
		const groupRowId = `group-${groupKey}`;

		rows.push({
			id: groupRowId,
			key: groupRowId,
			rowType: "group",
			title: group.label,
			groupKey,
			groupLabel: group.label,
			count: group.tasks.length,
			level: 0,
			hasValidSchedule: false,
		});

		for (const task of group.tasks) {
			rows.push({
				id: task.id,
				key: `task-${task.id}`,
				rowType: task.isMilestone ? "milestone" : "task",
				title: task.title,
				groupKey,
				groupLabel: group.label,
				task,
				startDate: task.startDate,
				endDate: task.endDate,
				duration: task.isScheduled ? task.durationDays : null,
				status: task.status,
				assignee: task.ownerLabel,
				taskType: task.groupLabel,
				level: 1,
				parentId: groupRowId,
				hasValidSchedule: Boolean(task.isScheduled && task.startDate && task.endDate),
			});
		}
	}

	return rows;
}

export function createTimelineRows(
	tasks: TimelineSourceTask[],
	projectTeam: TimelineTeamMember[] = [],
	options?: {
		referenceDate?: Date;
	}
) {
	const timelineTasks = createTimelineTasks(tasks, projectTeam, options);
	const timelineRows = buildTimelineRows(timelineTasks);

	return {
		timelineTasks,
		timelineRows,
	};
}

export function getTimelineRange(tasks: TimelineTask[], referenceDate = new Date()): TimelineRange {
	return getTimelineRangeWithOptions(
		tasks
			.filter((task) => Boolean(task.isScheduled && task.startDate && task.endDate))
			.map((task) => ({
				startDate: task.startDate,
				endDate: task.endDate,
			})),
		referenceDate
	);
}

function getTimelineRangeWithOptions(
	items: Array<{ startDate: Date | null; endDate: Date | null }>,
	referenceDate = new Date(),
	options?: TimelineRangeOptions
): TimelineRange {
	const safeReferenceDate = startOfDay(referenceDate);
	const paddingDays = options?.paddingDays ?? 10;
	const minimumSpanDays = options?.minimumSpanDays ?? 20;
	const fallbackSpanDays = options?.fallbackSpanDays ?? 30;
	const startCandidates = items
		.map((item) => item.startDate)
		.filter((date): date is Date => Boolean(date));
	const endCandidates = items
		.map((item) => item.endDate)
		.filter((date): date is Date => Boolean(date));

	if (startCandidates.length === 0 && endCandidates.length === 0) {
		const start = addDays(safeReferenceDate, -7);
		const end = addDays(start, fallbackSpanDays - 1);
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

	start = addDays(start, -paddingDays);
	end = addDays(end, paddingDays);

	if (differenceInCalendarDays(end, start) + 1 < minimumSpanDays) {
		end = addDays(start, minimumSpanDays - 1);
	}

	return {
		start,
		end,
		totalDays: differenceInCalendarDays(end, start) + 1,
	};
}

export function getTimelineRangeFromRows(
	rows: TimelineRow[],
	referenceDate = new Date(),
	options?: TimelineRangeOptions
): TimelineRange {
	const scheduledRows = rows.filter(
		(row): row is Extract<TimelineRow, { rowType: "task" | "milestone" }> =>
			row.rowType !== "group" && row.hasValidSchedule && Boolean(row.startDate && row.endDate)
	);

	return getTimelineRangeWithOptions(
		scheduledRows.map((row) => ({
			startDate: row.startDate,
			endDate: row.endDate,
		})),
		referenceDate,
		options
	);
}

export function getThisWeekTasks(tasks: TimelineTask[], referenceDate = new Date()) {
	const range = getCurrentWeekRange(referenceDate);

	return tasks
		.filter((task) => {
			if (!task.hasStartDate && !task.hasExplicitEndDate) {
				return false;
			}

			const taskStart = task.startDate ?? task.placementDate;
			const taskEnd = task.endDate ?? taskStart;
			const startsThisWeek =
				taskStart.getTime() >= range.start.getTime() &&
				taskStart.getTime() <= range.end.getTime();
			const endsThisWeek =
				taskEnd.getTime() >= range.start.getTime() &&
				taskEnd.getTime() <= range.end.getTime();
			const spansThisWeek =
				taskStart.getTime() <= range.end.getTime() &&
				taskEnd.getTime() >= range.start.getTime();

			return startsThisWeek || endsThisWeek || spansThisWeek;
		})
		.sort(
			(left, right) =>
				(left.dueDate ?? left.placementDate).getTime() - (right.dueDate ?? right.placementDate).getTime() ||
				left.placementDate.getTime() - right.placementDate.getTime()
		);
}

export function isTaskInThisWeek(task: TimelineTask, referenceDate = new Date()) {
	const range = getCurrentWeekRange(referenceDate);

	if (!task.hasStartDate && !task.hasExplicitEndDate) {
		return false;
	}

	const taskStart = task.startDate ?? task.placementDate;
	const taskEnd = task.endDate ?? taskStart;
	const startsThisWeek =
		taskStart.getTime() >= range.start.getTime() &&
		taskStart.getTime() <= range.end.getTime();
	const endsThisWeek =
		taskEnd.getTime() >= range.start.getTime() &&
		taskEnd.getTime() <= range.end.getTime();
	const spansThisWeek =
		taskStart.getTime() <= range.end.getTime() &&
		taskEnd.getTime() >= range.start.getTime();

	return startsThisWeek || endsThisWeek || spansThisWeek;
}

export function getTaskOperationalTone(
	task: TimelineTask,
	referenceDate = new Date()
): TaskOperationalTone {
	if (isTaskOverdue(task, referenceDate)) {
		return "overdue";
	}

	if (isTaskInThisWeek(task, referenceDate)) {
		return "this_week";
	}

	if (isTaskCompleted(task)) {
		return "completed";
	}

	if (ACTIVE_TASK_STATUSES.includes(task.status)) {
		return "in_progress";
	}

	if (isTaskUpcoming(task, referenceDate)) {
		return "upcoming";
	}

	return "upcoming";
}

export function getTaskOperationalColorClasses(
	task: TimelineTask,
	referenceDate = new Date()
): TaskOperationalColorClasses {
	switch (getTaskOperationalTone(task, referenceDate)) {
		case "overdue":
			return {
				tone: "overdue",
				dot: "bg-rose-500 ring-rose-100 dark:ring-rose-500/20",
				progress: "bg-rose-500",
				card: "border-rose-300 bg-rose-50/30 dark:border-rose-500/35 dark:bg-rose-500/6",
				bar: "bg-rose-500/90",
				bucket: "border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/10",
				bucketBadge:
					"border-rose-200 bg-white text-rose-700 dark:border-rose-500/30 dark:bg-stone-950 dark:text-rose-100",
			};
		case "this_week":
			return {
				tone: "this_week",
				dot: "bg-sky-500 ring-sky-100 dark:ring-sky-500/20",
				progress: "bg-sky-500",
				card: "border-sky-300 bg-sky-50/30 dark:border-sky-500/35 dark:bg-sky-500/8",
				bar: "bg-sky-500/90",
				bucket: "border-sky-200 bg-sky-50/75 dark:border-sky-500/30 dark:bg-sky-500/10",
				bucketBadge:
					"border-sky-200 bg-white text-sky-700 dark:border-sky-500/30 dark:bg-stone-950 dark:text-sky-100",
			};
		case "completed":
			return {
				tone: "completed",
				dot: "bg-emerald-500 ring-emerald-100 dark:ring-emerald-500/20",
				progress: "bg-emerald-500",
				card: "border-emerald-300 bg-emerald-50/30 dark:border-emerald-500/35 dark:bg-emerald-500/8",
				bar: "bg-emerald-500/90",
				bucket: "border-emerald-200 bg-emerald-50/75 dark:border-emerald-500/30 dark:bg-emerald-500/10",
				bucketBadge:
					"border-emerald-200 bg-white text-emerald-700 dark:border-emerald-500/30 dark:bg-stone-950 dark:text-emerald-100",
			};
		case "in_progress":
			return {
				tone: "in_progress",
				dot: "bg-amber-500 ring-amber-100 dark:ring-amber-500/20",
				progress: "bg-amber-500",
				card: "border-amber-300 bg-amber-50/30 dark:border-amber-500/35 dark:bg-amber-500/8",
				bar: "bg-amber-500/90",
				bucket: "border-amber-200 bg-amber-50/75 dark:border-amber-500/30 dark:bg-amber-500/10",
				bucketBadge:
					"border-amber-200 bg-white text-amber-700 dark:border-amber-500/30 dark:bg-stone-950 dark:text-amber-100",
			};
		case "upcoming":
		default:
			return {
				tone: "upcoming",
				dot: "bg-slate-400 ring-slate-100 dark:ring-stone-800",
				progress: "bg-slate-400",
				card: "border-slate-300 bg-slate-50/35 dark:border-stone-700 dark:bg-stone-900/55",
				bar: "bg-slate-400/85",
				bucket: "border-slate-200 bg-slate-50/80 dark:border-stone-800 dark:bg-stone-900/40",
				bucketBadge:
					"border-slate-200 bg-white text-slate-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200",
			};
	}
}

export function getTimelineSummary(tasks: TimelineTask[], referenceDate = new Date()): TimelineSummary {
	if (tasks.length === 0) {
		return {
			totalTasks: 0,
			completedTasks: 0,
			inProgressTasks: 0,
			overdueTasks: 0,
			thisWeekTasks: 0,
			upcomingTasks: 0,
			projectProgress: 0,
		};
	}

	const completedTasks = tasks.filter(isTaskCompleted).length;
	const inProgressTasks = tasks.filter((task) => isTaskActive(task, referenceDate)).length;
	const overdueTasks = tasks.filter((task) => isTaskOverdue(task, referenceDate)).length;
	const thisWeekTasks = tasks.filter((task) => isTaskInThisWeek(task, referenceDate)).length;
	const upcomingTasks = tasks.filter((task) => isTaskUpcoming(task, referenceDate)).length;
	const progressSum = tasks.reduce((sum, task) => sum + task.progress, 0);

	return {
		totalTasks: tasks.length,
		completedTasks,
		inProgressTasks,
		overdueTasks,
		thisWeekTasks,
		upcomingTasks,
		projectProgress: Math.round(progressSum / tasks.length),
	};
}

export function getSprintBuckets(tasks: TimelineTask[], referenceDate = new Date()): SprintBuckets {
	const range = getCurrentWeekRange(referenceDate);

	return {
		active: sortTimelineTasks(
			tasks.filter(
				(task) => isTaskActive(task, referenceDate) && isTaskInThisWeek(task, referenceDate)
			),
			"urgency",
			"desc",
			referenceDate
		),
		starting: sortTimelineTasks(
			tasks.filter((task) => !isTaskCompleted(task) && isTaskStartingThisWeek(task, referenceDate)),
			"startDate",
			"asc",
			referenceDate
		),
		ending: sortTimelineTasks(
			tasks.filter((task) => !isTaskCompleted(task) && isTaskEndingThisWeek(task, referenceDate)),
			"endDate",
			"asc",
			referenceDate
		),
		overdue: sortTimelineTasks(
			tasks.filter((task) => isTaskOverdue(task, referenceDate)),
			"urgency",
			"desc",
			referenceDate
		),
		completed: sortTimelineTasks(
			tasks.filter((task) => isTaskCompleted(task)),
			"updatedAt",
			"desc",
			referenceDate
		),
		upcoming: sortTimelineTasks(
			tasks.filter((task) => {
				const taskStart = task.startDate ?? task.placementDate;
				return (
					!isTaskCompleted(task) &&
					taskStart.getTime() > range.end.getTime() &&
					isTaskUpcoming(task, referenceDate)
				);
			}),
			"startDate",
			"asc",
			referenceDate
		),
	};
}

export function matchesTimelineCollectionFilter(
	task: TimelineTask,
	filter: TimelineCollectionFilter,
	referenceDate = new Date()
) {
	switch (filter) {
		case "completed":
			return isTaskCompleted(task);
		case "active":
			return isTaskActive(task, referenceDate);
		case "upcoming":
			return isTaskUpcoming(task, referenceDate);
		case "overdue":
			return isTaskOverdue(task, referenceDate);
		case "this_week":
			return isTaskInThisWeek(task, referenceDate);
		case "all":
		default:
			return true;
	}
}

export function sortTasksByDate(tasks: TimelineTask[]) {
	return [...tasks].sort((left, right) => {
		const leftHasStart = Boolean(left.startDate);
		const rightHasStart = Boolean(right.startDate);

		if (leftHasStart && !rightHasStart) return -1;
		if (!leftHasStart && rightHasStart) return 1;

		const leftStart = left.startDate ?? left.endDate ?? left.placementDate;
		const rightStart = right.startDate ?? right.endDate ?? right.placementDate;
		const startDifference = leftStart.getTime() - rightStart.getTime();
		if (startDifference !== 0) return startDifference;

		const leftEnd = left.endDate ?? leftStart;
		const rightEnd = right.endDate ?? rightStart;
		const endDifference = leftEnd.getTime() - rightEnd.getTime();
		if (endDifference !== 0) return endDifference;

		return left.name.localeCompare(right.name);
	});
}

export function sortTimelineTasks(
	tasks: TimelineTask[],
	sortKey: TimelineSortKey,
	direction: TimelineSortDirection = "asc",
	referenceDate = new Date()
) {
	const safeReferenceDate = startOfDay(referenceDate);
	const factor = direction === "asc" ? 1 : -1;

	return [...tasks].sort((left, right) => {
		let comparison = 0;

		switch (sortKey) {
			case "status":
				comparison = getStatusSortRank(left.status) - getStatusSortRank(right.status);
				break;
			case "type":
				comparison =
					(GROUP_ORDER[left.groupKey] ?? 99) - (GROUP_ORDER[right.groupKey] ?? 99) ||
					left.groupLabel.localeCompare(right.groupLabel);
				break;
			case "duration":
				comparison = left.durationDays - right.durationDays;
				break;
			case "urgency":
				comparison =
					getUrgencyScore(left, safeReferenceDate) - getUrgencyScore(right, safeReferenceDate);
				break;
			case "updatedAt":
				comparison =
					getDateSortValue(left.updatedAt ?? left.createdAt, left.placementDate) -
					getDateSortValue(right.updatedAt ?? right.createdAt, right.placementDate);
				break;
			case "endDate":
				comparison =
					getDateSortValue(left.endDate ?? left.startDate, left.placementDate) -
					getDateSortValue(right.endDate ?? right.startDate, right.placementDate);
				break;
			case "startDate":
			default:
				comparison =
					getDateSortValue(left.startDate ?? left.endDate, left.placementDate) -
					getDateSortValue(right.startDate ?? right.endDate, right.placementDate);
				break;
		}

		if (comparison !== 0) {
			return comparison * factor;
		}

		return left.name.localeCompare(right.name) * factor;
	});
}

export function groupTasksByType(tasks: TimelineTask[]) {
	const grouped = new Map<string, GroupedTimelineTasks>();

	for (const task of sortTasksByDate(tasks)) {
		const groupKey = task.groupKey || "general";
		const existing = grouped.get(groupKey);

		if (existing) {
			existing.tasks.push(task);
			continue;
		}

		grouped.set(groupKey, {
			groupKey,
			groupLabel: task.groupLabel || task.type || "general",
			tasks: [task],
		});
	}

	return Array.from(grouped.values()).sort(
		(left, right) =>
			(GROUP_ORDER[left.groupKey] ?? 99) - (GROUP_ORDER[right.groupKey] ?? 99) ||
			left.groupLabel.localeCompare(right.groupLabel)
	);
}

export function getTaskDurationLabel(task: TimelineTask, options?: TaskDurationLabelOptions) {
	const dayLabel = options?.dayLabel ?? "day";
	const daysLabel = options?.daysLabel ?? "days";
	const unscheduledLabel = options?.unscheduledLabel ?? "-";

	if (!task.startDate && !task.endDate) {
		return unscheduledLabel;
	}

	const safeDuration = Math.max(
		1,
		task.durationDays ||
			(task.startDate && task.endDate
				? differenceInCalendarDays(task.endDate, task.startDate) + 1
				: 1)
	);

	return `${safeDuration} ${safeDuration === 1 ? dayLabel : daysLabel}`;
}

export function getTaskStatusColorClasses(status: string): TaskStatusColorClasses {
	switch (normalizeTaskStatus(status)) {
		case "completed":
			return {
				badge:
					"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
				dot: "bg-emerald-500 ring-emerald-100 dark:ring-emerald-500/20",
				progress: "bg-emerald-500",
				card: "border-emerald-200/70 dark:border-emerald-500/20",
				bar: "bg-emerald-500/85",
			};
		case "in_progress":
		case "needs_review":
		case "working":
		case "active":
			return {
				badge:
					"border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
				dot: "bg-amber-500 ring-amber-100 dark:ring-amber-500/20",
				progress: "bg-amber-500",
				card: "border-amber-200/70 dark:border-amber-500/20",
				bar: "bg-amber-500/85",
			};
		case "on_hold":
		case "paused":
		case "stopped":
		case "blocked":
			return {
				badge:
					"border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100",
				dot: "bg-rose-500 ring-rose-100 dark:ring-rose-500/20",
				progress: "bg-rose-500",
				card: "border-rose-200/70 dark:border-rose-500/20",
				bar: "bg-rose-500/80",
			};
		case "not_started":
		case "pending":
		default:
			return {
				badge:
					"border-slate-200 bg-slate-50 text-slate-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200",
				dot: "bg-slate-400 ring-slate-100 dark:ring-stone-800",
				progress: "bg-slate-400",
				card: "border-slate-200/80 dark:border-stone-800",
				bar: "bg-slate-400/80",
			};
	}
}
