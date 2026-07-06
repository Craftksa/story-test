"use client";

import { useEffect, useMemo, useState } from "react";
import { ar, enUS } from "date-fns/locale";
import { differenceInCalendarDays, startOfDay } from "date-fns";
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
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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

function clampPercentage(value: number) {
	return Math.min(100, Math.max(0, value));
}

function getRangePositionStyle(
	startPercent: number,
	widthPercent: number,
	isRTL: boolean
) {
	return isRTL
		? { right: `${startPercent}%`, width: `${widthPercent}%` }
		: { left: `${startPercent}%`, width: `${widthPercent}%` };
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

	const sprintBuckets = useMemo(
		() => getSprintBuckets(sortedTasks, today),
		[sortedTasks, today]
	);

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

	const todayOffset = clampPercentage(
		(differenceInCalendarDays(today, timelineRange.start) / Math.max(1, timelineRange.totalDays)) * 100
	);
	const weekStartOffset = clampPercentage(
		(differenceInCalendarDays(currentWeekRange.start, timelineRange.start) /
			Math.max(1, timelineRange.totalDays)) *
			100
	);
	const weekWidth = clampPercentage(
		((differenceInCalendarDays(currentWeekRange.end, currentWeekRange.start) + 1) /
			Math.max(1, timelineRange.totalDays)) *
			100
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
							<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
								<div>
									<p className="text-sm font-medium text-slate-500 dark:text-stone-400">
										{labels.range}
									</p>
									<p className="mt-1 text-base font-semibold text-slate-950 dark:text-stone-50">
										{formatTimelineDate(timelineRange.start, { locale })} -{" "}
										{formatTimelineDate(timelineRange.end, { locale })}
									</p>
								</div>
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
							</div>

							<div className="mt-4">
								<div className="relative h-6 rounded-full bg-slate-100 dark:bg-stone-900">
									<div
										className="absolute inset-y-0 rounded-full bg-sky-100 dark:bg-sky-500/15"
										style={getRangePositionStyle(weekStartOffset, weekWidth, isRTL)}
									/>
									<div
										className="absolute inset-y-0 w-px bg-slate-900 dark:bg-stone-100"
										style={isRTL ? { right: `${todayOffset}%` } : { left: `${todayOffset}%` }}
									/>
								</div>
								<div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-stone-400">
									<span>{formatTimelineDate(timelineRange.start, { locale, formatPattern: "d MMM" })}</span>
									<span>{formatTimelineDate(timelineRange.end, { locale, formatPattern: "d MMM" })}</span>
								</div>
							</div>
						</div>

						{groupedSections.map((section) => {
							const isCollapsed = collapsedSections[section.groupKey];
							const scheduledTasks = section.tasks.filter((task) => task.startDate || task.endDate);
							const unscheduledTasks = section.tasks.filter((task) => !task.startDate && !task.endDate);
							const overdueCount = section.tasks.filter((task) => task.isOverdue).length;

							return (
								<Collapsible
									key={section.groupKey}
									open={!isCollapsed}
									onOpenChange={(open) =>
										setCollapsedSections((current) => ({
											...current,
											[section.groupKey]: !open,
										}))
									}
									className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-stone-800 dark:bg-stone-950"
								>
									<CollapsibleTrigger asChild>
										<button
											type="button"
											className="flex w-full items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 text-right dark:border-stone-800"
										>
											<div className="min-w-0">
												<h3 className="truncate text-lg font-semibold text-slate-950 dark:text-stone-50">
													{section.groupLabel}
												</h3>
												<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-stone-400">
													<Badge
														variant="outline"
														className="border-slate-200 bg-slate-50 dark:border-stone-700 dark:bg-stone-900"
													>
														{section.tasks.length} {labels.totalTasks}
													</Badge>
													{overdueCount > 0 ? (
														<Badge className="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
															{overdueCount} {labels.overdue}
														</Badge>
													) : null}
												</div>
											</div>
											{isCollapsed ? (
												<ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-stone-500" />
											) : (
												<ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-stone-500" />
											)}
										</button>
									</CollapsibleTrigger>

									<CollapsibleContent>
										<div className="space-y-4 p-4">
											{scheduledTasks.map((task) => {
												const statusClasses = getTaskStatusColorClasses(task.status);
												const taskHref = resolveTaskHref(task.id);
												const taskStatusLabel = getTranslatedTaskStatusLabel(task.status, t);
												const note = task.notes?.trim();
												const taskStart = task.startDate ?? task.endDate ?? timelineRange.start;
												const taskEnd = task.endDate ?? task.startDate ?? taskStart;
												const taskStartOffset = clampPercentage(
													(differenceInCalendarDays(taskStart, timelineRange.start) /
														Math.max(1, timelineRange.totalDays)) *
														100
												);
												const taskWidth = clampPercentage(
													((differenceInCalendarDays(taskEnd, taskStart) + 1) /
														Math.max(1, timelineRange.totalDays)) *
														100
												);

												return (
													<article
														key={task.id}
														className={cn(
															"rounded-2xl border p-4 shadow-sm dark:bg-stone-950",
															statusClasses.card
														)}
													>
														<div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,1fr)] xl:items-start">
															<div className="min-w-0">
																<div className="flex items-start justify-between gap-3">
																	<div className="min-w-0">
																		<Button
																			type="button"
																			variant="link"
																			onClick={() => openTask(task.id)}
																			disabled={!taskHref}
																			title={task.name}
																			className="h-auto max-w-full p-0 text-start text-base font-semibold text-slate-950 hover:text-sky-600 disabled:no-underline dark:text-stone-50"
																		>
																			<span className="truncate">{task.name}</span>
																		</Button>
																		<div className="mt-2 flex flex-wrap items-center gap-2">
																			<Badge className={cn("border", statusClasses.badge)}>
																				{taskStatusLabel}
																			</Badge>
																			<Badge
																				variant="outline"
																				className="border-slate-200 bg-slate-50 text-slate-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
																			>
																				{task.groupLabel}
																			</Badge>
																			<Badge className={cn("border", getPriorityTone(task.priority))}>
																				{getPriorityLabel(task.priority, labels)}
																			</Badge>
																			{task.isOverdue ? (
																				<Badge className="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
																					{labels.overdue}
																				</Badge>
																			) : null}
																			{thisWeekTasks.some((item) => item.id === task.id) ? (
																				<Badge className="border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
																					{labels.thisWeek}
																				</Badge>
																			) : null}
																		</div>
																	</div>

																	<div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100">
																		{getOwnerInitials(task.ownerLabel || labels.noOwner)}
																	</div>
																</div>

																<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
																	<div className="min-w-0">
																		<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
																			{labels.owner}
																		</p>
																		<p className="mt-1 truncate text-sm text-slate-700 dark:text-stone-200">
																			{task.ownerLabel || labels.noOwner}
																		</p>
																	</div>
																	<div className="min-w-0">
																		<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
																			{labels.startDate}
																		</p>
																		<p className="mt-1 truncate text-sm text-slate-700 dark:text-stone-200">
																			{formatTimelineDate(task.startDate, { locale })}
																		</p>
																	</div>
																	<div className="min-w-0">
																		<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
																			{labels.endDate}
																		</p>
																		<p className="mt-1 truncate text-sm text-slate-700 dark:text-stone-200">
																			{task.endDate
																				? formatTimelineDate(task.endDate, { locale })
																				: labels.noFixedEndDate}
																		</p>
																	</div>
																	<div className="min-w-0">
																		<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
																			{labels.duration}
																		</p>
																		<p className="mt-1 truncate text-sm text-slate-700 dark:text-stone-200">
																			{getTaskDurationLabel(task, {
																				dayLabel: labels.day,
																				daysLabel: labels.days,
																				unscheduledLabel: "-",
																			})}
																		</p>
																	</div>
																</div>

																<div className="mt-4">
																	<div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
																		<span>{labels.progress}</span>
																		<span>{task.progress}%</span>
																	</div>
																	<Progress
																		value={task.progress}
																		showValueLabel={false}
																		className="h-2 bg-slate-200 dark:bg-stone-800"
																		indicatorClassName={statusClasses.progress}
																	/>
																</div>

																{note ? (
																	<div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-stone-900 dark:text-stone-300">
																		<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
																			{labels.note}
																		</p>
																		<p className="mt-1 line-clamp-2">{note}</p>
																	</div>
																) : null}
															</div>

															<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-stone-800 dark:bg-stone-900/60">
																<div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-stone-400">
																	<span>{labels.range}</span>
																	<span>
																		{formatTimelineDate(taskStart, {
																			locale,
																			formatPattern: "d MMM",
																		})}{" "}
																		-{" "}
																		{formatTimelineDate(taskEnd, {
																			locale,
																			formatPattern: "d MMM",
																		})}
																	</span>
																</div>
																<div className="relative h-14 rounded-2xl bg-white dark:bg-stone-950">
																	<div
																		className="absolute inset-y-1 rounded-xl bg-sky-100 dark:bg-sky-500/12"
																		style={getRangePositionStyle(weekStartOffset, weekWidth, isRTL)}
																	/>
																	<div
																		className="absolute inset-y-0 w-px bg-slate-900 dark:bg-stone-100"
																		style={isRTL ? { right: `${todayOffset}%` } : { left: `${todayOffset}%` }}
																	/>
																	<div
																		className={cn(
																			"absolute top-1/2 h-7 -translate-y-1/2 rounded-xl shadow-sm",
																			statusClasses.bar,
																			task.isOverdue && "ring-2 ring-rose-300/60 dark:ring-rose-500/40"
																		)}
																		style={getRangePositionStyle(taskStartOffset, Math.max(taskWidth, 2.2), isRTL)}
																	/>
																</div>
																<div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-stone-400">
																	<span>{formatTimelineDate(timelineRange.start, { locale, formatPattern: "d MMM" })}</span>
																	<span>{formatTimelineDate(timelineRange.end, { locale, formatPattern: "d MMM" })}</span>
																</div>
															</div>
														</div>
													</article>
												);
											})}

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
															const taskHref = resolveTaskHref(task.id);
															return (
																<div
																	key={task.id}
																	className={cn(
																		"rounded-xl border bg-white p-4 dark:bg-stone-950",
																		statusClasses.card
																	)}
																>
																	<div className="flex items-start justify-between gap-3">
																		<div className="min-w-0">
																			<Button
																				type="button"
																				variant="link"
																				onClick={() => openTask(task.id)}
																				disabled={!taskHref}
																				title={task.name}
																				className="h-auto max-w-full p-0 text-start text-sm font-semibold text-slate-950 hover:text-sky-600 disabled:no-underline dark:text-stone-50"
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
									</CollapsibleContent>
								</Collapsible>
							);
						})}
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
		</div>
	);
}
