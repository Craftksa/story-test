"use client";

import { useEffect, useMemo, useState } from "react";
import { ar, enUS } from "date-fns/locale";
import {
	differenceInCalendarDays,
	eachDayOfInterval,
	eachMonthOfInterval,
	eachWeekOfInterval,
	eachYearOfInterval,
	endOfMonth,
	endOfWeek,
	endOfYear,
	startOfDay,
} from "date-fns";
import {
	ArrowDownWideNarrow,
	ArrowUpWideNarrow,
	CalendarDays,
	ChevronDown,
	ChevronRight,
	Filter,
	Plus,
	Search,
	Target,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "use-intl";

import TaskSprintBoard from "@/components/tasks/TaskSprintBoard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCheckedLocale } from "@/lib/client-utils";
import { cn, formatStatus } from "@/lib/utils";

import {
	createTimelineTasks,
	formatTimelineDate,
	getCurrentWeekRange,
	getTaskDependencyIds,
	getTaskOperationalColorClasses,
	getSprintBuckets,
	getTaskDurationLabel,
	getTaskStatusColorClasses,
	getThisWeekTasks,
	getTimelineRange,
	getTimelineSummary,
	groupTasksByType,
	matchesTimelineCollectionFilter,
	sortTimelineTasks,
	type TimelineCollectionFilter,
	type TimelineRow,
	type TimelineSortDirection,
	type TimelineSortKey,
	type TimelineSourceTask,
	type TimelineTask,
	type TimelineTeamMember,
} from "./task-timeline-utils";

type TaskTimelineViewProps = {
	projectId?: string;
	tasks: TimelineSourceTask[];
	timelineRows?: TimelineRow[];
	projectTeam?: TimelineTeamMember[];
	getTaskHref?: (taskId: string) => string | null;
	showWeeklyTable?: boolean;
	compact?: boolean;
	title?: string;
	isLoading?: boolean;
	mode?: "timeline" | "sprint";
	canCreateTask?: boolean;
};

type SummaryCardProps = {
	accent: string;
	label: string;
	value: number | string;
	description: string;
};

type TimelineFilterState = {
	collection: TimelineCollectionFilter;
	status: string;
	type: string;
	sortKey: TimelineSortKey;
	sortDirection: TimelineSortDirection;
};

type GanttZoomLevel = "day" | "week" | "month";

type GanttScaleCell = {
	key: string;
	label: string;
	width: number;
};

type GanttBandCell = {
	key: string;
	label: string;
	width: number;
};

type GanttSection = {
	groupKey: string;
	groupLabel: string;
	tasks: TimelineTask[];
	unscheduledTasks: TimelineTask[];
};

type GanttVisualRow =
	| {
			key: string;
			kind: "group";
			groupKey: string;
			groupLabel: string;
			taskCount: number;
			overdueCount: number;
			y: number;
			height: number;
	  }
	| {
			key: string;
			kind: "task";
			groupKey: string;
			task: TimelineTask;
			y: number;
			height: number;
	  };

function extractProjectName(title: string | undefined, fallbackLabel: string) {
	if (!title?.trim()) {
		return fallbackLabel;
	}

	const trimmed = title.trim();
	const parts = trimmed.split(/[:：]/);

	if (parts.length > 1) {
		const candidate = parts.slice(1).join(":").trim();
		return candidate || trimmed;
	}

	return trimmed;
}

function getTranslatedTaskStatusLabel(
	status: string,
	t: ReturnType<typeof useTranslations>
) {
	switch (status) {
		case "completed":
		case "in_progress":
		case "not_started":
		case "on_hold":
		case "needs_review":
		case "pending":
		case "paused":
		case "blocked":
		case "working":
		case "active":
			return t(status);
		default:
			return formatStatus(status);
	}
}

function getTranslatedTaskTypeLabel(
	task: TimelineTask,
	t: ReturnType<typeof useTranslations>
) {
	switch (task.groupKey) {
		case "foundations":
		case "finishes":
		case "general":
		case "construction":
		case "architectural":
		case "mechanical":
		case "electrical":
			return t(task.groupKey);
		default:
			return task.groupLabel || formatStatus(task.type);
	}
}

function getOwnerInitials(owner: string | null | undefined) {
	if (!owner?.trim()) return "-";

	return owner
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((token) => token.charAt(0).toUpperCase())
		.join("");
}

function getPriorityLabel(
	priority: TimelineTask["priority"],
	labels: {
		high: string;
		medium: string;
		low: string;
	}
) {
	switch (priority) {
		case "high":
			return labels.high;
		case "medium":
			return labels.medium;
		case "low":
		default:
			return labels.low;
	}
}

function getPriorityTone(priority: TimelineTask["priority"]) {
	switch (priority) {
		case "high":
			return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100";
		case "medium":
			return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100";
		case "low":
		default:
			return "border-slate-200 bg-slate-50 text-slate-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200";
	}
}

function SummaryCard({ accent, description, label, value }: SummaryCardProps) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-950">
			<div className={cn("mb-3 h-1.5 w-16 rounded-full", accent)} />
			<p className="text-sm font-medium text-slate-500 dark:text-stone-400">{label}</p>
			<p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-stone-50">
				{value}
			</p>
			<p className="mt-2 text-xs text-slate-500 dark:text-stone-400">{description}</p>
		</div>
	);
}

const GANTT_LEFT_COLUMN_WIDTH = 320;
const GANTT_HEADER_HEIGHT = 109;
const GANTT_GROUP_ROW_HEIGHT = 52;
const GANTT_TASK_ROW_HEIGHT = 84;

function getGanttPixelsPerDay(zoomLevel: GanttZoomLevel) {
	switch (zoomLevel) {
		case "day":
			return 34;
		case "week":
			return 14;
		case "month":
		default:
			return 6;
	}
}

function buildGanttYearBands(
	start: Date,
	end: Date,
	pixelsPerDay: number,
	locale: typeof ar | typeof enUS
) {
	return eachYearOfInterval({ start, end }).map((yearStart) => {
		const bandStart = yearStart < start ? start : yearStart;
		const bandEnd = endOfYear(yearStart) > end ? end : endOfYear(yearStart);

		return {
			key: `year-${yearStart.toISOString()}`,
			label: formatTimelineDate(yearStart, { locale, formatPattern: "yyyy" }),
			width:
				(differenceInCalendarDays(bandEnd, bandStart) + 1) * pixelsPerDay,
		} satisfies GanttBandCell;
	});
}

function buildGanttMonthBands(
	start: Date,
	end: Date,
	pixelsPerDay: number,
	locale: typeof ar | typeof enUS
) {
	return eachMonthOfInterval({ start, end }).map((monthStart) => {
		const bandStart = monthStart < start ? start : monthStart;
		const bandEnd = endOfMonth(monthStart) > end ? end : endOfMonth(monthStart);

		return {
			key: `month-${monthStart.toISOString()}`,
			label: formatTimelineDate(monthStart, { locale, formatPattern: "MMM" }),
			width:
				(differenceInCalendarDays(bandEnd, bandStart) + 1) * pixelsPerDay,
		} satisfies GanttBandCell;
	});
}

function buildGanttScaleCells(
	start: Date,
	end: Date,
	zoomLevel: GanttZoomLevel,
	pixelsPerDay: number,
	locale: typeof ar | typeof enUS
) {
	if (zoomLevel === "day") {
		return eachDayOfInterval({ start, end }).map((day) => ({
			key: `day-${day.toISOString()}`,
			label: formatTimelineDate(day, { locale, formatPattern: "d" }),
			width: pixelsPerDay,
		})) satisfies GanttScaleCell[];
	}

	if (zoomLevel === "week") {
		return eachWeekOfInterval(
			{ start, end },
			{ weekStartsOn: 1 }
		).map((weekStart) => {
			const rangeStart = weekStart < start ? start : weekStart;
			const rangeEnd = endOfWeek(weekStart, { weekStartsOn: 1 }) > end ? end : endOfWeek(weekStart, { weekStartsOn: 1 });
			return {
				key: `week-${weekStart.toISOString()}`,
				label: `${formatTimelineDate(rangeStart, {
					locale,
					formatPattern: "d MMM",
				})} - ${formatTimelineDate(rangeEnd, {
					locale,
					formatPattern: "d MMM",
				})}`,
				width:
					(differenceInCalendarDays(rangeEnd, rangeStart) + 1) *
					pixelsPerDay,
			};
		}) satisfies GanttScaleCell[];
	}

	return eachMonthOfInterval({ start, end }).map((monthStart) => {
		const rangeStart = monthStart < start ? start : monthStart;
		const rangeEnd = endOfMonth(monthStart) > end ? end : endOfMonth(monthStart);
		return {
			key: `scale-month-${monthStart.toISOString()}`,
			label: formatTimelineDate(monthStart, { locale, formatPattern: "MMM yyyy" }),
			width:
				(differenceInCalendarDays(rangeEnd, rangeStart) + 1) * pixelsPerDay,
		};
	}) satisfies GanttScaleCell[];
}

export default function TaskTimelineView({
	projectId,
	tasks,
	timelineRows: providedTimelineRows,
	projectTeam = [],
	getTaskHref,
	showWeeklyTable = true,
	title,
	isLoading = false,
	mode = "timeline",
	canCreateTask,
}: TaskTimelineViewProps) {
	const t = useTranslations();
	const router = useRouter();
	const { lang, isRTL } = useCheckedLocale();
	const locale = lang === "ar" ? ar : enUS;
	const today = startOfDay(new Date());
	const currentWeekRange = useMemo(() => getCurrentWeekRange(today), [today]);
	const [searchValue, setSearchValue] = useState("");
	const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
	const [zoomLevel, setZoomLevel] = useState<GanttZoomLevel>("week");
	const [selectedTask, setSelectedTask] = useState<TimelineTask | null>(null);
	const [filters, setFilters] = useState<TimelineFilterState>({
		collection: "all",
		status: "all",
		type: "all",
		sortKey: "startDate",
		sortDirection: "asc",
	});

	const labels = useMemo(
		() => ({
			timelineAndSprints: t("Timeline / Sprints"),
			description: t("Operational task plan grouped by phase, urgency, and weekly execution"),
			project: t("Project"),
			currentProject: t("Current Project"),
			search: t("Search tasks, owners, notes, or statuses"),
			addTask: t("Add New Task"),
			allStatuses: t("All statuses"),
			allPhases: t("All phases"),
			allTaskWindows: t("All task windows"),
			sortBy: t("Sort by"),
			allTasks: t("All tasks"),
			active: t("Active"),
			completed: t("Completed"),
			upcoming: t("Upcoming"),
			overdue: t("Overdue"),
			thisWeek: t("This Week"),
			startDate: t("Start Date"),
			endDate: t("End Date"),
			status: t("Status"),
			type: t("Type"),
			duration: t("Duration"),
			urgency: t("Urgency"),
			updated: t("Updated"),
			ascending: t("Asc"),
			descending: t("Desc"),
			startFirst: t("Start first"),
			latestEnd: t("Latest end"),
			statusOrder: t("Status order"),
			phaseOrder: t("Phase order"),
			longestDuration: t("Longest duration"),
			highestUrgency: t("Highest urgency"),
			recentlyUpdated: t("Recently updated"),
			totalTasks: t("Total Tasks"),
			completedTasks: t("Completed Tasks"),
			inProgressTasks: t("In Progress Tasks"),
			overdueTasks: t("Overdue Tasks"),
			thisWeekTasks: t("This Week Tasks"),
			projectProgress: t("Project Progress"),
			noTasks: t("No tasks are available for this timeline."),
			noResults: t("No tasks match the current filters."),
			loading: t("Loading tasks"),
			phase: t("Phase"),
			owner: t("Owner"),
			progress: t("Progress"),
			note: t("Notes"),
			withoutDate: t("Unscheduled"),
			noOwner: t("Not set"),
			noFixedEndDate: t("No fixed end date"),
			day: t("day"),
			days: t("days"),
			range: t("Timeline range"),
			today: t("Today"),
			currentWeek: t("Current week"),
			starts: t("Starts"),
			ends: t("Ends"),
			lastUpdate: t("Last Updated"),
			attention: t("Needs attention"),
			weeklySnapshot: t("Weekly Snapshot"),
			weeklySnapshotDescription: t("A compact list of tasks touching the current week"),
			noWeekTasks: t("No scheduled tasks for this week"),
			activeDescription: t("Tasks active this week"),
			startingDescription: t("Tasks starting this week"),
			endingDescription: t("Tasks ending this week"),
			overdueDescription: t("Tasks delayed beyond plan"),
			completedDescription: t("Completed tasks visible in this project"),
			upcomingDescription: t("Upcoming tasks after this week"),
			noActiveTasks: t("No active tasks this week"),
			noStartingTasks: t("No tasks start this week"),
			noEndingTasks: t("No tasks end this week"),
			noOverdueTasks: t("No overdue tasks right now"),
			noCompletedTasks: t("No completed tasks yet"),
			noUpcomingTasks: t("No upcoming tasks after this week"),
			high: t("High"),
			medium: t("Medium"),
			low: t("Low"),
			taskDetails: t("Task Details"),
			detailsDescription: t("Task details and progress"),
			openTask: t("Open Task"),
			zoom: t("Zoom"),
			dayScale: t("Day"),
			weekScale: t("Week"),
			monthScale: t("Month"),
			timelineGrid: t("Timeline Grid"),
			scheduleOverview: t("Schedule Overview"),
			scheduledTasks: t("Scheduled Tasks"),
			dependencies: t("Dependencies"),
			noDependencies: t("No linked dependencies"),
			ganttHint: t("Click any bar to inspect task details"),
		}),
		[t]
	);

	const projectName = extractProjectName(title, labels.currentProject);

	const baseTimelineTasks = useMemo(() => {
		if (providedTimelineRows) {
			return providedTimelineRows
				.filter(
					(row): row is Extract<TimelineRow, { rowType: "task" | "milestone" }> =>
						row.rowType !== "group"
				)
				.map((row) => row.task);
		}

		return createTimelineTasks(tasks, projectTeam, { referenceDate: today });
	}, [projectTeam, providedTimelineRows, tasks, today]);

	const summary = useMemo(
		() => getTimelineSummary(baseTimelineTasks, today),
		[baseTimelineTasks, today]
	);

	const translatedTasks = useMemo(
		() =>
			baseTimelineTasks.map((task) => ({
				...task,
				groupLabel: getTranslatedTaskTypeLabel(task, t),
			})),
		[baseTimelineTasks, t]
	);

	const typeOptions = useMemo(
		() =>
			Array.from(
				new Map(
					translatedTasks.map((task) => [task.groupKey, task.groupLabel || task.groupKey])
				).entries()
			),
		[translatedTasks]
	);

	const filteredTasks = useMemo(() => {
		const query = searchValue.trim().toLowerCase();

		return translatedTasks.filter((task) => {
			if (!matchesTimelineCollectionFilter(task, filters.collection, today)) {
				return false;
			}

			if (filters.status !== "all" && task.status !== filters.status) {
				return false;
			}

			if (filters.type !== "all" && task.groupKey !== filters.type) {
				return false;
			}

			if (!query) return true;

			const searchableText = [
				task.name,
				task.ownerLabel,
				task.groupLabel,
				task.notes,
				getTranslatedTaskStatusLabel(task.status, t),
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();

			return searchableText.includes(query);
		});
	}, [filters.collection, filters.status, filters.type, searchValue, t, today, translatedTasks]);

	const sortedTasks = useMemo(
		() => sortTimelineTasks(filteredTasks, filters.sortKey, filters.sortDirection, today),
		[filteredTasks, filters.sortDirection, filters.sortKey, today]
	);

	const groupedSections = useMemo(() => groupTasksByType(sortedTasks), [sortedTasks]);

	useEffect(() => {
		setCollapsedSections((current) => {
			let changed = false;
			const next = { ...current };

			for (const section of groupedSections) {
				if (!(section.groupKey in next)) {
					next[section.groupKey] = false;
					changed = true;
				}
			}

			return changed ? next : current;
		});
	}, [groupedSections]);

	const timelineRange = useMemo(
		() => getTimelineRange(sortedTasks, today),
		[sortedTasks, today]
	);

	const thisWeekTasks = useMemo(
		() => getThisWeekTasks(sortedTasks, today),
		[sortedTasks, today]
	);
	const thisWeekTaskIds = useMemo(
		() => new Set(thisWeekTasks.map((task) => task.id)),
		[thisWeekTasks]
	);

	const sprintBuckets = useMemo(
		() => getSprintBuckets(sortedTasks, today),
		[sortedTasks, today]
	);

	const ganttSections = useMemo<GanttSection[]>(
		() =>
			groupedSections
				.map((section) => ({
					groupKey: section.groupKey,
					groupLabel: section.groupLabel,
					tasks: section.tasks.filter((task) => task.isScheduled && task.startDate && task.endDate),
					unscheduledTasks: section.tasks.filter((task) => !task.isScheduled || !task.startDate || !task.endDate),
				}))
				.filter((section) => section.tasks.length > 0 || section.unscheduledTasks.length > 0),
		[groupedSections]
	);

	const unscheduledTasks = useMemo(
		() => ganttSections.flatMap((section) => section.unscheduledTasks),
		[ganttSections]
	);

	const pixelsPerDay = useMemo(() => getGanttPixelsPerDay(zoomLevel), [zoomLevel]);
	const ganttTimelineWidth = useMemo(
		() => Math.max(960, timelineRange.totalDays * pixelsPerDay),
		[pixelsPerDay, timelineRange.totalDays]
	);
	const ganttYearBands = useMemo(
		() => buildGanttYearBands(timelineRange.start, timelineRange.end, pixelsPerDay, locale),
		[locale, pixelsPerDay, timelineRange.end, timelineRange.start]
	);
	const ganttMonthBands = useMemo(
		() => buildGanttMonthBands(timelineRange.start, timelineRange.end, pixelsPerDay, locale),
		[locale, pixelsPerDay, timelineRange.end, timelineRange.start]
	);
	const ganttScaleCells = useMemo(
		() => buildGanttScaleCells(timelineRange.start, timelineRange.end, zoomLevel, pixelsPerDay, locale),
		[locale, pixelsPerDay, timelineRange.end, timelineRange.start, zoomLevel]
	);

	const ganttRows = useMemo(() => {
		let cursorY = 0;
		const rows: GanttVisualRow[] = [];

		for (const section of ganttSections) {
			const isCollapsed = collapsedSections[section.groupKey];

			rows.push({
				key: `group-${section.groupKey}`,
				kind: "group",
				groupKey: section.groupKey,
				groupLabel: section.groupLabel,
				taskCount: section.tasks.length,
				overdueCount: section.tasks.filter((task) => task.isOverdue).length,
				y: cursorY,
				height: GANTT_GROUP_ROW_HEIGHT,
			});
			cursorY += GANTT_GROUP_ROW_HEIGHT;

			if (!isCollapsed) {
				for (const task of section.tasks) {
					rows.push({
						key: task.id,
						kind: "task",
						groupKey: section.groupKey,
						task,
						y: cursorY,
						height: GANTT_TASK_ROW_HEIGHT,
					});
					cursorY += GANTT_TASK_ROW_HEIGHT;
				}
			}
		}

		return {
			rows,
			totalHeight: Math.max(cursorY, GANTT_GROUP_ROW_HEIGHT),
		};
	}, [collapsedSections, ganttSections]);

	const ganttTaskMetrics = useMemo(() => {
		const metrics = new Map<
			string,
			{
				rowTop: number;
				rowHeight: number;
				barStart: number;
				barWidth: number;
				barCenterY: number;
			}
		>();

		for (const row of ganttRows.rows) {
			if (row.kind !== "task" || !row.task.startDate || !row.task.endDate) {
				continue;
			}

			const startDays = differenceInCalendarDays(row.task.startDate, timelineRange.start);
			const durationDays = Math.max(
				1,
				differenceInCalendarDays(row.task.endDate, row.task.startDate) + 1
			);
			const barStart = startDays * pixelsPerDay;
			const barWidth = Math.max(durationDays * pixelsPerDay, Math.max(22, pixelsPerDay));

			metrics.set(row.task.id, {
				rowTop: row.y,
				rowHeight: row.height,
				barStart,
				barWidth,
				barCenterY: row.y + row.height / 2,
			});
		}

		return metrics;
	}, [ganttRows.rows, pixelsPerDay, timelineRange.start]);

	const resolveTaskHref = (taskId: string) =>
		getTaskHref?.(taskId) ?? (projectId ? `/projects/${projectId}/tasks/${taskId}` : null);

	const openTask = (taskId: string) => {
		const href = resolveTaskHref(taskId);
		if (!href) return;
		router.push(href);
	};

	const openCreateTask = () => {
		if (projectId) {
			router.push(`/projects/${projectId}/tasks/new`);
		}
	};

	const openTaskDetails = (task: TimelineTask) => {
		setSelectedTask(task);
	};

	const todayPositionPx = Math.max(
		0,
		differenceInCalendarDays(today, timelineRange.start) * pixelsPerDay
	);
	const currentWeekStartPx = Math.max(
		0,
		differenceInCalendarDays(currentWeekRange.start, timelineRange.start) * pixelsPerDay
	);
	const currentWeekWidthPx = Math.max(
		pixelsPerDay,
		(differenceInCalendarDays(currentWeekRange.end, currentWeekRange.start) + 1) *
			pixelsPerDay
	);

	const hasAnyTasks = translatedTasks.length > 0;
	const showEmptyState = isLoading || !hasAnyTasks || groupedSections.length === 0;
	const emptyStateLabel = isLoading
		? labels.loading
		: hasAnyTasks
			? labels.noResults
			: labels.noTasks;

	const sortOptions: Array<{ value: TimelineSortKey; label: string }> = [
		{ value: "startDate", label: labels.startFirst },
		{ value: "endDate", label: labels.latestEnd },
		{ value: "status", label: labels.statusOrder },
		{ value: "type", label: labels.phaseOrder },
		{ value: "duration", label: labels.longestDuration },
		{ value: "urgency", label: labels.highestUrgency },
		{ value: "updatedAt", label: labels.recentlyUpdated },
	];

	const canShowCreate = canCreateTask ?? Boolean(projectId);

	return (
		<div
			className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 shadow-sm dark:border-stone-800 dark:bg-stone-950 dark:text-stone-100"
			dir={isRTL ? "rtl" : "ltr"}
		>
			<div className="border-b border-slate-200 px-4 py-5 sm:px-5 dark:border-stone-800">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
							<Target className="size-3.5" />
							{labels.timelineAndSprints}
						</div>
						<h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-stone-50">
							{projectName}
						</h2>
						<p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-stone-300">
							{labels.description}
						</p>
					</div>

					<div className="flex items-center gap-2 self-start">
						{canShowCreate ? (
							<Button
								type="button"
								size="sm"
								disabled={!projectId}
								onClick={openCreateTask}
								className="h-9 rounded-full bg-slate-900 px-4 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-stone-200 dark:text-stone-950 dark:hover:bg-stone-100"
							>
								<Plus className="me-2 h-4 w-4" />
								{labels.addTask}
							</Button>
						) : null}
					</div>
				</div>
			</div>

			<div className="grid gap-3 border-b border-slate-200 px-4 py-5 sm:grid-cols-2 xl:grid-cols-6 sm:px-5 dark:border-stone-800">
				<SummaryCard
					accent="bg-slate-900 dark:bg-stone-100"
					label={labels.totalTasks}
					value={summary.totalTasks}
					description={labels.project}
				/>
				<SummaryCard
					accent="bg-emerald-500"
					label={labels.completedTasks}
					value={summary.completedTasks}
					description={labels.completed}
				/>
				<SummaryCard
					accent="bg-amber-500"
					label={labels.inProgressTasks}
					value={summary.inProgressTasks}
					description={labels.active}
				/>
				<SummaryCard
					accent="bg-rose-500"
					label={labels.overdueTasks}
					value={summary.overdueTasks}
					description={labels.attention}
				/>
				<SummaryCard
					accent="bg-sky-500"
					label={labels.thisWeekTasks}
					value={summary.thisWeekTasks}
					description={labels.currentWeek}
				/>
				<SummaryCard
					accent="bg-violet-500"
					label={labels.projectProgress}
					value={`${summary.projectProgress}%`}
					description={labels.progress}
				/>
			</div>

			<div className="border-b border-slate-200 px-4 py-5 sm:px-5 dark:border-stone-800">
				<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="relative w-full xl:max-w-sm">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
						<Input
							value={searchValue}
							onChange={(event) => setSearchValue(event.target.value)}
							placeholder={labels.search}
							className={cn(
								"h-10 rounded-full border-slate-200 bg-white ps-9 text-sm shadow-none dark:border-stone-800 dark:bg-stone-950",
								isRTL && "text-right"
							)}
						/>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-stone-400">
							<Filter className="size-4" />
							<span>{labels.allTaskWindows}</span>
						</div>
						<Select
							value={filters.collection}
							onValueChange={(value: TimelineCollectionFilter) =>
								setFilters((current) => ({ ...current, collection: value }))
							}
						>
							<SelectTrigger className="h-9 min-w-[150px] rounded-full border-slate-200 bg-white dark:border-stone-800 dark:bg-stone-950">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{labels.allTasks}</SelectItem>
								<SelectItem value="active">{labels.active}</SelectItem>
								<SelectItem value="completed">{labels.completed}</SelectItem>
								<SelectItem value="upcoming">{labels.upcoming}</SelectItem>
								<SelectItem value="overdue">{labels.overdue}</SelectItem>
								<SelectItem value="this_week">{labels.thisWeek}</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={filters.status}
							onValueChange={(value) =>
								setFilters((current) => ({ ...current, status: value }))
							}
						>
							<SelectTrigger className="h-9 min-w-[150px] rounded-full border-slate-200 bg-white dark:border-stone-800 dark:bg-stone-950">
								<SelectValue placeholder={labels.allStatuses} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{labels.allStatuses}</SelectItem>
								<SelectItem value="not_started">{t("not_started")}</SelectItem>
								<SelectItem value="in_progress">{t("in_progress")}</SelectItem>
								<SelectItem value="needs_review">{t("needs_review")}</SelectItem>
								<SelectItem value="on_hold">{t("on_hold")}</SelectItem>
								<SelectItem value="completed">{t("completed")}</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={filters.type}
							onValueChange={(value) =>
								setFilters((current) => ({ ...current, type: value }))
							}
						>
							<SelectTrigger className="h-9 min-w-[150px] rounded-full border-slate-200 bg-white dark:border-stone-800 dark:bg-stone-950">
								<SelectValue placeholder={labels.allPhases} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{labels.allPhases}</SelectItem>
								{typeOptions.map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select
							value={filters.sortKey}
							onValueChange={(value: TimelineSortKey) =>
								setFilters((current) => ({ ...current, sortKey: value }))
							}
						>
							<SelectTrigger className="h-9 min-w-[160px] rounded-full border-slate-200 bg-white dark:border-stone-800 dark:bg-stone-950">
								<SelectValue placeholder={labels.sortBy} />
							</SelectTrigger>
							<SelectContent>
								{sortOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9 rounded-full border-slate-200 bg-white px-3 dark:border-stone-800 dark:bg-stone-950"
							onClick={() =>
								setFilters((current) => ({
									...current,
									sortDirection: current.sortDirection === "asc" ? "desc" : "asc",
								}))
							}
						>
							{filters.sortDirection === "asc" ? (
								<ArrowUpWideNarrow className="me-2 h-4 w-4" />
							) : (
								<ArrowDownWideNarrow className="me-2 h-4 w-4" />
							)}
							{filters.sortDirection === "asc" ? labels.ascending : labels.descending}
						</Button>
					</div>
				</div>
			</div>

			<div className="px-4 py-5 sm:px-5">
				{showEmptyState ? (
					<div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400">
						{emptyStateLabel}
					</div>
				) : mode === "sprint" ? (
					<TaskSprintBoard
						buckets={sprintBuckets}
						getTaskHref={resolveTaskHref}
						isRTL={isRTL}
						labels={{
							active: labels.active,
							activeDescription: labels.activeDescription,
							noActive: labels.noActiveTasks,
							starting: labels.starts,
							startingDescription: labels.startingDescription,
							noStarting: labels.noStartingTasks,
							ending: labels.ends,
							endingDescription: labels.endingDescription,
							noEnding: labels.noEndingTasks,
							overdue: labels.overdue,
							overdueDescription: labels.overdueDescription,
							noOverdue: labels.noOverdueTasks,
							completed: labels.completed,
							completedDescription: labels.completedDescription,
							noCompleted: labels.noCompletedTasks,
							upcoming: labels.upcoming,
							upcomingDescription: labels.upcomingDescription,
							noUpcoming: labels.noUpcomingTasks,
							owner: labels.owner,
							start: labels.startDate,
							finish: labels.endDate,
							duration: labels.duration,
							noOwner: labels.noOwner,
							day: labels.day,
							days: labels.days,
							high: labels.high,
							medium: labels.medium,
							low: labels.low,
							phase: labels.phase,
							overdueBadge: labels.overdue,
						}}
						locale={locale}
						onOpenTask={openTask}
						translateStatus={(status) => getTranslatedTaskStatusLabel(status, t)}
						translateType={(task) => getTranslatedTaskTypeLabel(task, t)}
					/>
				) : (
					<div className="space-y-4">
						<div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
							<div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
								<div className="space-y-2">
									<p className="text-sm font-medium text-slate-500 dark:text-stone-400">
										{labels.range}
									</p>
									<p className="text-base font-semibold text-slate-950 dark:text-stone-50">
										{formatTimelineDate(timelineRange.start, { locale })} -{" "}
										{formatTimelineDate(timelineRange.end, { locale })}
									</p>
									<p className="text-sm text-slate-500 dark:text-stone-400">
										{labels.ganttHint}
									</p>
								</div>

								<div className="flex flex-col gap-3 xl:items-end">
									<div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-stone-400">
										<div className="inline-flex items-center gap-2">
											<span className="h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-stone-100" />
											{labels.today}
										</div>
										<div className="inline-flex items-center gap-2">
											<span className="h-2.5 w-8 rounded-full bg-sky-100 dark:bg-sky-500/15" />
											{labels.currentWeek}
										</div>
									</div>

									<div className="flex flex-wrap items-center gap-2">
										<span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-400">
											{labels.zoom}
										</span>
										<div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-stone-800 dark:bg-stone-900">
											{([
												{ value: "day", label: labels.dayScale },
												{ value: "week", label: labels.weekScale },
												{ value: "month", label: labels.monthScale },
											] as const).map((option) => (
												<Button
													key={option.value}
													type="button"
													size="sm"
													variant={zoomLevel === option.value ? "default" : "ghost"}
													className="rounded-full px-4"
													onClick={() => setZoomLevel(option.value)}
												>
													{option.label}
												</Button>
											))}
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-stone-800 dark:bg-stone-950">
							<div className="border-b border-slate-200 px-4 py-4 dark:border-stone-800">
								<div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
									<div>
										<p className="text-sm font-semibold text-slate-950 dark:text-stone-50">
											{labels.scheduleOverview}
										</p>
										<p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
											{labels.timelineGrid}
										</p>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<Badge
											variant="outline"
											className="border-slate-200 bg-slate-50 text-slate-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
										>
											{ganttRows.rows.filter((row) => row.kind === "task").length}{" "}
											{labels.scheduledTasks}
										</Badge>
									</div>
								</div>
							</div>

							<div className="max-h-[680px] overflow-auto" dir="ltr">
								<div
									className="relative min-w-max"
									style={{
										width: GANTT_LEFT_COLUMN_WIDTH + ganttTimelineWidth,
									}}
								>
									<div className="sticky top-0 z-30">
										<div
											className="grid"
											style={{
												gridTemplateColumns: `${GANTT_LEFT_COLUMN_WIDTH}px ${ganttTimelineWidth}px`,
											}}
										>
											<div className="sticky left-0 z-40 border-b border-r border-slate-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
												<p
													className={cn(
														"text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500",
														isRTL && "text-right"
													)}
												>
													{labels.phase}
												</p>
												<p
													className={cn(
														"mt-2 text-sm text-slate-600 dark:text-stone-300",
														isRTL && "text-right"
													)}
												>
													{labels.ganttHint}
												</p>
											</div>

											<div className="border-b border-slate-200 bg-white dark:border-stone-800 dark:bg-stone-950">
												<div className="flex border-b border-slate-200 dark:border-stone-800">
													{ganttYearBands.map((band) => (
														<div
															key={band.key}
															className="whitespace-nowrap border-r border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 last:border-r-0 dark:border-stone-800 dark:text-stone-500"
															style={{ width: band.width }}
														>
															{band.label}
														</div>
													))}
												</div>
												<div className="flex border-b border-slate-200 dark:border-stone-800">
													{ganttMonthBands.map((band) => (
														<div
															key={band.key}
															className="whitespace-nowrap border-r border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 last:border-r-0 dark:border-stone-800 dark:text-stone-300"
															style={{ width: band.width }}
														>
															{band.label}
														</div>
													))}
												</div>
												<div className="flex bg-slate-50/80 dark:bg-stone-900/60">
													{ganttScaleCells.map((cell) => (
														<div
															key={cell.key}
															className="truncate whitespace-nowrap border-r border-slate-200 px-2 py-2 text-[11px] text-slate-500 last:border-r-0 dark:border-stone-800 dark:text-stone-400"
															style={{ width: cell.width }}
															title={cell.label}
														>
															{cell.label}
														</div>
													))}
												</div>
											</div>
										</div>
									</div>

									<div
										className="pointer-events-none absolute"
										style={{
											top: GANTT_HEADER_HEIGHT,
											left: GANTT_LEFT_COLUMN_WIDTH,
											width: ganttTimelineWidth,
											height: ganttRows.totalHeight,
										}}
									>
										<div
											className="absolute inset-y-0 bg-sky-100/60 dark:bg-sky-500/10"
											style={{
												left: currentWeekStartPx,
												width: currentWeekWidthPx,
											}}
										/>
										<div
											className="absolute inset-y-0 w-px bg-slate-900 dark:bg-stone-100"
											style={{ left: todayPositionPx }}
										/>
									</div>

									<div className="relative">
										{ganttRows.rows.map((row) => {
											if (row.kind === "group") {
												const isCollapsed = collapsedSections[row.groupKey];
												return (
													<div
														key={row.key}
														className="grid border-b border-slate-200 dark:border-stone-800"
														style={{
															gridTemplateColumns: `${GANTT_LEFT_COLUMN_WIDTH}px ${ganttTimelineWidth}px`,
														}}
													>
														<div className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
															<div className="flex items-center justify-between gap-3">
																<button
																	type="button"
																	onClick={() =>
																		setCollapsedSections((current) => ({
																			...current,
																			[row.groupKey]: !current[row.groupKey],
																		}))
																	}
																	className={cn(
																		"flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900 dark:text-stone-100",
																		isRTL && "text-right"
																	)}
																>
																	{isCollapsed ? (
																		<ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-stone-500" />
																	) : (
																		<ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-stone-500" />
																	)}
																	<span className="truncate">{row.groupLabel}</span>
																</button>
																<div className="flex shrink-0 items-center gap-2">
																	<Badge
																		variant="outline"
																		className="border-slate-200 bg-white text-slate-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200"
																	>
																		{row.taskCount}
																	</Badge>
																	{row.overdueCount > 0 ? (
																		<Badge className="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
																			{row.overdueCount} {labels.overdue}
																		</Badge>
																	) : null}
																</div>
															</div>
														</div>
														<div className="h-[52px] bg-slate-50/80 dark:bg-stone-900/40" />
													</div>
												);
											}

											const statusClasses = getTaskStatusColorClasses(row.task.status);
											const operationalClasses = getTaskOperationalColorClasses(row.task, today);
											const taskStatusLabel = getTranslatedTaskStatusLabel(row.task.status, t);
											const rowMetrics = ganttTaskMetrics.get(row.task.id);

											if (!rowMetrics) {
												return null;
											}

											return (
												<div
													key={row.key}
													className="grid border-b border-slate-200 last:border-b-0 dark:border-stone-800"
													style={{
														gridTemplateColumns: `${GANTT_LEFT_COLUMN_WIDTH}px ${ganttTimelineWidth}px`,
													}}
												>
													<div className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-950">
														<div className="flex items-start justify-between gap-3">
															<div className="min-w-0">
																<Button
																	type="button"
																	variant="link"
																	onClick={() => openTaskDetails(row.task)}
																	title={row.task.name}
																	className={cn(
																		"h-auto max-w-full p-0 text-sm font-semibold text-slate-950 hover:text-sky-600 dark:text-stone-50",
																		isRTL ? "text-right" : "text-left"
																	)}
																>
																	<span className="truncate">{row.task.name}</span>
																</Button>
																<div className="mt-2 flex flex-wrap items-center gap-2">
																	<Badge className={cn("border", statusClasses.badge)}>
																		{taskStatusLabel}
																	</Badge>
																	<Badge
																		variant="outline"
																		className="border-slate-200 bg-slate-50 text-slate-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
																	>
																		{row.task.groupLabel}
																	</Badge>
																	{row.task.isOverdue ? (
																		<Badge className="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
																			{labels.overdue}
																		</Badge>
																	) : null}
																	{thisWeekTaskIds.has(row.task.id) ? (
																		<Badge className="border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
																			{labels.thisWeek}
																		</Badge>
																	) : null}
																</div>
															</div>

															<div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100">
																{getOwnerInitials(row.task.ownerLabel || labels.noOwner)}
															</div>
														</div>

														<div
															className={cn(
																"mt-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-stone-400",
																isRTL && "text-right"
															)}
														>
															<span className="truncate">
																{row.task.ownerLabel || labels.noOwner}
															</span>
															<span className="shrink-0">
																{formatTimelineDate(row.task.startDate, {
																	locale,
																	formatPattern: "d MMM",
																})}{" "}
																-{" "}
																{formatTimelineDate(row.task.endDate, {
																	locale,
																	formatPattern: "d MMM",
																})}
															</span>
														</div>
													</div>

													<div className="relative h-[84px] bg-white dark:bg-stone-950">
														<div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200 dark:bg-stone-800" />
														<button
															type="button"
															onClick={() => openTaskDetails(row.task)}
															title={`${row.task.name} • ${formatTimelineDate(row.task.startDate, {
																locale,
																formatPattern: "d MMM",
															})} - ${formatTimelineDate(row.task.endDate, {
																locale,
																formatPattern: "d MMM",
															})}`}
															className={cn(
																"absolute top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-full shadow-sm transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-sky-300/60",
																operationalClasses.bar,
																row.task.isOverdue && "ring-2 ring-rose-300/60 dark:ring-rose-500/40"
															)}
															style={{
																left: rowMetrics.barStart,
																width: rowMetrics.barWidth,
															}}
														>
															<span
																className="absolute inset-y-0 left-0 rounded-full bg-black/15"
																style={{
																	width: `${Math.max(0, Math.min(100, row.task.progress))}%`,
																}}
															/>
														</button>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							</div>
						</div>

						{unscheduledTasks.length > 0 ? (
							<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-stone-700 dark:bg-stone-900/40">
								<div className="mb-3 flex items-center gap-2">
									<CalendarDays className="h-4 w-4 text-slate-400 dark:text-stone-500" />
									<p className="text-sm font-semibold text-slate-700 dark:text-stone-200">
										{labels.withoutDate}
									</p>
								</div>
								<div className="grid gap-3 md:grid-cols-2">
									{unscheduledTasks.map((task) => {
										const statusClasses = getTaskStatusColorClasses(task.status);
										const operationalClasses = getTaskOperationalColorClasses(task, today);
										return (
											<div
												key={task.id}
												className={cn(
													"rounded-xl border bg-white p-4 dark:bg-stone-950",
													operationalClasses.card
												)}
											>
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0">
														<Button
															type="button"
															variant="link"
															onClick={() => openTaskDetails(task)}
															title={task.name}
															className="h-auto max-w-full p-0 text-start text-sm font-semibold text-slate-950 hover:text-sky-600 dark:text-stone-50"
														>
															<span className="truncate">{task.name}</span>
														</Button>
														<p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
															{task.ownerLabel || labels.noOwner}
														</p>
													</div>
													<Badge className={cn("border", statusClasses.badge)}>
														{getTranslatedTaskStatusLabel(task.status, t)}
													</Badge>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						) : null}
					</div>
				)}
			</div>

			{mode === "timeline" && showWeeklyTable ? (
				<div className="border-t border-slate-200 bg-white px-4 py-5 sm:px-5 dark:border-stone-800 dark:bg-stone-950">
					<div className="mb-4 flex flex-col gap-1">
						<h3 className="text-base font-semibold">{labels.weeklySnapshot}</h3>
						<p className="text-sm text-slate-500 dark:text-stone-400">
							{labels.weeklySnapshotDescription}
						</p>
					</div>

					<div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-stone-800">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-slate-200 dark:divide-stone-800">
								<thead className="bg-slate-50 dark:bg-stone-900">
									<tr className="text-right">
										{[
											t("Task Name"),
											labels.phase,
											labels.status,
											labels.startDate,
											labels.endDate,
											labels.owner,
										].map((label) => (
											<th
												key={label}
												className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500"
											>
												{label}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100 dark:divide-stone-900">
									{thisWeekTasks.length === 0 ? (
										<tr>
											<td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-stone-400">
												{labels.noWeekTasks}
											</td>
										</tr>
									) : (
										thisWeekTasks.map((task) => {
											const statusClasses = getTaskStatusColorClasses(task.status);
											return (
												<tr key={task.id} className="bg-white dark:bg-stone-950">
													<td className="px-4 py-4">
														<Button
															type="button"
															variant="link"
															onClick={() => openTask(task.id)}
															disabled={!resolveTaskHref(task.id)}
															className="h-auto max-w-[220px] truncate p-0 text-start text-sm font-medium text-slate-950 hover:text-sky-600 disabled:no-underline dark:text-stone-50"
														>
															{task.name}
														</Button>
													</td>
													<td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-stone-300">
														{task.groupLabel}
													</td>
													<td className="px-4 py-4">
														<span
															className={cn(
																"inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
																statusClasses.badge
															)}
														>
															{getTranslatedTaskStatusLabel(task.status, t)}
														</span>
													</td>
													<td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-stone-300">
														{formatTimelineDate(task.startDate, { locale })}
													</td>
													<td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-stone-300">
														{formatTimelineDate(task.endDate, { locale })}
													</td>
													<td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-stone-300">
														{task.ownerLabel || labels.noOwner}
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			) : null}

			<Sheet open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(null)}>
				<SheetContent side={isRTL ? "left" : "right"} className="w-full sm:max-w-lg">
					{selectedTask ? (
						<>
							<SheetHeader>
								<SheetTitle>{labels.taskDetails}</SheetTitle>
								<SheetDescription>{labels.detailsDescription}</SheetDescription>
							</SheetHeader>

							<div className="mt-6 space-y-5">
								<div>
									<h3 className="text-xl font-semibold text-slate-950 dark:text-stone-50">
										{selectedTask.name}
									</h3>
									<div className="mt-3 flex flex-wrap items-center gap-2">
										<Badge
											className={cn(
												"border",
												getTaskStatusColorClasses(selectedTask.status).badge
											)}
										>
											{getTranslatedTaskStatusLabel(selectedTask.status, t)}
										</Badge>
										<Badge
											variant="outline"
											className="border-slate-200 bg-slate-50 text-slate-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
										>
											{selectedTask.groupLabel}
										</Badge>
										<Badge className={cn("border", getPriorityTone(selectedTask.priority))}>
											{getPriorityLabel(selectedTask.priority, labels)}
										</Badge>
									</div>
								</div>

								<div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-stone-800 dark:bg-stone-900/50">
									<div className="flex items-center justify-between gap-3">
										<span className="text-slate-500 dark:text-stone-400">{labels.owner}</span>
										<span className="font-medium text-slate-900 dark:text-stone-100">
											{selectedTask.ownerLabel || labels.noOwner}
										</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span className="text-slate-500 dark:text-stone-400">{labels.startDate}</span>
										<span className="font-medium text-slate-900 dark:text-stone-100">
											{formatTimelineDate(selectedTask.startDate, { locale })}
										</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span className="text-slate-500 dark:text-stone-400">{labels.endDate}</span>
										<span className="font-medium text-slate-900 dark:text-stone-100">
											{formatTimelineDate(selectedTask.endDate, {
												locale,
												fallback: labels.noFixedEndDate,
											})}
										</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span className="text-slate-500 dark:text-stone-400">{labels.duration}</span>
										<span className="font-medium text-slate-900 dark:text-stone-100">
											{getTaskDurationLabel(selectedTask, {
												dayLabel: labels.day,
												daysLabel: labels.days,
												unscheduledLabel: "-",
											})}
										</span>
									</div>
								</div>

								<div>
									<div className="mb-2 flex items-center justify-between gap-3 text-sm">
										<span className="text-slate-500 dark:text-stone-400">{labels.progress}</span>
										<span className="font-medium text-slate-900 dark:text-stone-100">
											{selectedTask.progress}%
										</span>
									</div>
									<Progress
										value={selectedTask.progress}
										showValueLabel={false}
										className="h-2 bg-slate-200 dark:bg-stone-800"
										indicatorClassName={getTaskOperationalColorClasses(selectedTask, today).progress}
									/>
								</div>

								<div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
									<div className="mb-3 flex items-center justify-between gap-3">
										<h4 className="text-sm font-semibold text-slate-950 dark:text-stone-50">
											{labels.dependencies}
										</h4>
										<Badge
											variant="outline"
											className="border-slate-200 bg-slate-50 text-slate-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
										>
											{getTaskDependencyIds(selectedTask).length}
										</Badge>
									</div>
									{getTaskDependencyIds(selectedTask).length === 0 ? (
										<p className="text-sm text-slate-500 dark:text-stone-400">
											{labels.noDependencies}
										</p>
									) : (
										<div className="flex flex-wrap gap-2">
											{getTaskDependencyIds(selectedTask).map((dependencyId) => (
												<Badge
													key={dependencyId}
													variant="outline"
													className="border-slate-200 bg-slate-50 text-slate-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
												>
													{dependencyId}
												</Badge>
											))}
										</div>
									)}
								</div>

								{selectedTask.notes?.trim() ? (
									<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-stone-800 dark:bg-stone-900/50">
										<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
											{labels.note}
										</p>
										<p className="mt-2 text-sm leading-6 text-slate-700 dark:text-stone-200">
											{selectedTask.notes}
										</p>
									</div>
								) : null}

								{resolveTaskHref(selectedTask.id) ? (
									<Button
										type="button"
										onClick={() => {
											openTask(selectedTask.id);
											setSelectedTask(null);
										}}
										className="w-full"
									>
										{labels.openTask}
									</Button>
								) : null}
							</div>
						</>
					) : null}
				</SheetContent>
			</Sheet>
		</div>
	);
}
