"use client";

import { useEffect, useMemo, useRef } from "react";
import {
	addDays,
	differenceInCalendarDays,
	endOfMonth,
	endOfWeek,
	format,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { CalendarDays, Filter, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCheckedLocale } from "@/lib/client-utils";
import { cn, formatStatus } from "@/lib/utils";

import {
	createTimelineRows,
	getThisWeekTasks,
	getTimelineRangeFromRows,
	type TimelineSourceTask,
	type TimelineRow,
	type TimelineTask,
	type TimelineTeamMember,
} from "./task-timeline-utils";

type TimelineLayoutMetrics = {
	leftColumnWidth: number;
	dayColumnWidth: number;
	headerHeight: number;
	groupRowHeight: number;
	taskRowHeight: number;
	barHeight: number;
	maxBodyHeight: string;
};

const DEFAULT_LAYOUT: TimelineLayoutMetrics = {
	leftColumnWidth: 420,
	dayColumnWidth: 24,
	headerHeight: 118,
	groupRowHeight: 52,
	taskRowHeight: 96,
	barHeight: 24,
	maxBodyHeight: "none",
};

const COMPACT_LAYOUT: TimelineLayoutMetrics = {
	leftColumnWidth: 392,
	dayColumnWidth: 20,
	headerHeight: 116,
	groupRowHeight: 50,
	taskRowHeight: 94,
	barHeight: 24,
	maxBodyHeight: "none",
};

type TimelineTaskLayout = {
	rowTop: number;
	rowHeight: number;
	barLeft: number | null;
	barWidth: number | null;
	barRight: number | null;
	markerCenter: number | null;
	durationDays: number;
	isRenderable: boolean;
	isMilestone: boolean;
};

type PositionedTimelineRow =
	| (Extract<TimelineRow, { rowType: "group" }> & {
			top: number;
			height: number;
	  })
	| (Extract<TimelineRow, { rowType: "task" | "milestone" }> & {
			top: number;
			height: number;
	  });

type TimelineHeaderSegment = {
	key: string;
	label: string;
	subLabel?: string;
	startOffsetDays: number;
	days: number;
};

function getResolvedLayout(totalDays: number, compact: boolean): TimelineLayoutMetrics {
	const base = compact ? COMPACT_LAYOUT : DEFAULT_LAYOUT;
	let dayColumnWidth = base.dayColumnWidth;

	if (totalDays > 365) {
		dayColumnWidth = compact ? 8 : 10;
	} else if (totalDays > 240) {
		dayColumnWidth = compact ? 10 : 12;
	} else if (totalDays > 180) {
		dayColumnWidth = compact ? 12 : 14;
	} else if (totalDays > 120) {
		dayColumnWidth = compact ? 14 : 16;
	} else if (totalDays > 90) {
		dayColumnWidth = compact ? 16 : 18;
	} else if (totalDays > 60) {
		dayColumnWidth = compact ? 18 : 20;
	}

	return {
		...base,
		dayColumnWidth,
	};
}

function buildMonthSegments(start: Date, end: Date, locale: typeof enUS): TimelineHeaderSegment[] {
	const segments: TimelineHeaderSegment[] = [];
	let cursor = startOfMonth(start);

	while (cursor.getTime() <= end.getTime()) {
		const segmentStart = cursor.getTime() < start.getTime() ? start : cursor;
		const rawSegmentEnd = endOfMonth(segmentStart);
		const segmentEnd = rawSegmentEnd.getTime() > end.getTime() ? end : rawSegmentEnd;

		segments.push({
			key: `${segmentStart.toISOString()}-${segmentEnd.toISOString()}`,
			label: format(segmentStart, "MMMM yyyy", { locale }),
			startOffsetDays: differenceInCalendarDays(segmentStart, start),
			days: differenceInCalendarDays(segmentEnd, segmentStart) + 1,
		});

		cursor = addDays(segmentEnd, 1);
	}

	return segments;
}

function buildWeekSegments(start: Date, end: Date, locale: typeof enUS): TimelineHeaderSegment[] {
	const segments: TimelineHeaderSegment[] = [];
	let cursor = startOfWeek(start, { weekStartsOn: 1 });

	while (cursor.getTime() <= end.getTime()) {
		const segmentStart = cursor.getTime() < start.getTime() ? start : cursor;
		const rawSegmentEnd = endOfWeek(segmentStart, { weekStartsOn: 1 });
		const segmentEnd = rawSegmentEnd.getTime() > end.getTime() ? end : rawSegmentEnd;
		const startLabel = format(segmentStart, "d MMM", { locale });
		const endLabel =
			segmentStart.getMonth() === segmentEnd.getMonth()
				? format(segmentEnd, "d", { locale })
				: format(segmentEnd, "d MMM", { locale });

		segments.push({
			key: `${segmentStart.toISOString()}-${segmentEnd.toISOString()}`,
			label: startLabel,
			subLabel: endLabel,
			startOffsetDays: differenceInCalendarDays(segmentStart, start),
			days: differenceInCalendarDays(segmentEnd, segmentStart) + 1,
		});

		cursor = addDays(segmentEnd, 1);
	}

	return segments;
}

function getTaskVisualState(status: string) {
	const normalizedStatus = status.trim().toLowerCase();

	if (["completed", "done", "complete"].includes(normalizedStatus)) {
		return "completed";
	}

	if (["on_hold", "paused", "stopped", "blocked"].includes(normalizedStatus)) {
		return "blocked";
	}

	if (["not_started", "pending"].includes(normalizedStatus)) {
		return "not_started";
	}

	return "in_progress";
}

function getTaskBarClasses(task: TimelineTask) {
	if (task.isOverdue && task.status !== "completed") {
		return "border-rose-300 bg-rose-100/95 text-rose-900 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-100";
	}

	switch (getTaskVisualState(task.status)) {
		case "completed":
			return "border-emerald-300 bg-emerald-100/95 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-100";
		case "blocked":
			return "border-rose-300 bg-rose-100/95 text-rose-900 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-100";
		case "not_started":
			return "border-slate-300 bg-slate-100/95 text-slate-800 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-100";
		case "in_progress":
		default:
			return "border-amber-300 bg-amber-100/95 text-amber-900 dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-100";
	}
}

function getPriorityClasses(priority: TimelineTask["priority"]) {
	switch (priority) {
		case "high":
			return "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-400/30 dark:bg-rose-950/35 dark:text-rose-200";
		case "medium":
			return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/35 dark:text-amber-200";
		case "low":
		default:
			return "border-border/70 bg-muted/50 text-foreground dark:bg-muted/35 dark:text-muted-foreground";
	}
}

function getProgressIndicatorClasses(task: TimelineTask) {
	switch (getTaskVisualState(task.status)) {
		case "completed":
			return "bg-emerald-500 dark:bg-emerald-400";
		case "blocked":
			return "bg-rose-500 dark:bg-rose-400";
		case "not_started":
			return "bg-slate-400 dark:bg-slate-500";
		case "in_progress":
		default:
			return "bg-amber-500 dark:bg-amber-400";
	}
}

function getDurationLabel(task: TimelineTask, locale: typeof enUS) {
	const startDate = task.startDate;
	const endDate = task.endDate ?? startDate;

	if (!startDate || !endDate) {
		return locale === ar ? "غير مجدولة" : "Unscheduled";
	}

	return `${format(startDate, "d MMM", { locale })} - ${format(endDate, "d MMM", {
		locale,
	})}`;
}

function formatTimelineCellDate(date: Date | null | undefined, locale: typeof enUS) {
	if (!date) return "—";
	return format(date, "d MMM", { locale });
}

function getOwnerInitials(owner: string | null | undefined) {
	if (!owner?.trim()) return "—";

	const tokens = owner
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2);

	return tokens.map((token) => token.charAt(0).toUpperCase()).join("");
}

function getTaskStatusBadgeClasses(task: TimelineTask) {
	if (task.isOverdue && task.status !== "completed") {
		return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
	}

	switch (getTaskVisualState(task.status)) {
		case "completed":
			return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
		case "blocked":
			return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
		case "not_started":
			return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/45 dark:text-slate-200";
		case "in_progress":
		default:
			return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
	}
}

function getTranslatedTaskStatusLabel(task: TimelineTask, t: ReturnType<typeof useTranslations>) {
	switch (task.status) {
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
			return t(task.status);
		default:
			return formatStatus(task.status);
	}
}

function getTranslatedTaskTypeLabel(task: TimelineTask, t: ReturnType<typeof useTranslations>) {
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

function getGroupAccentClasses(groupKey: string) {
	switch (groupKey) {
		case "foundations":
		case "construction":
			return "bg-amber-400 dark:bg-amber-300";
		case "finishes":
		case "architectural":
			return "bg-stone-400 dark:bg-stone-300";
		case "mechanical":
			return "bg-slate-400 dark:bg-slate-300";
		case "electrical":
			return "bg-zinc-400 dark:bg-zinc-300";
		default:
			return "bg-amber-400 dark:bg-amber-300";
	}
}

function getTaskLayouts(
	timelineStart: Date,
	layout: TimelineLayoutMetrics,
	timelineRows: TimelineRow[]
) {
	const taskLayouts = new Map<string, TimelineTaskLayout>();
	const rows: PositionedTimelineRow[] = [];

	let currentTop = 0;

	for (const row of timelineRows) {
		if (row.rowType === "group") {
			rows.push({
				...row,
				top: currentTop,
				height: layout.groupRowHeight,
			});
			currentTop += layout.groupRowHeight;
			continue;
		}

		const task = row.task;
		const isRenderable = row.hasValidSchedule && Boolean(row.startDate && row.endDate);
		const durationDays =
			row.startDate && row.endDate
				? Math.max(1, differenceInCalendarDays(row.endDate, row.startDate) + 1)
				: 1;
		let barLeft: number | null = null;
		let barWidth: number | null = null;
		let markerCenter: number | null = null;

		if (isRenderable && row.startDate) {
			const startOffset = Math.max(0, differenceInCalendarDays(row.startDate, timelineStart));

			if (row.rowType === "milestone") {
				markerCenter = startOffset * layout.dayColumnWidth + layout.dayColumnWidth / 2;
				barWidth = Math.max(layout.barHeight - 2, 14);
				barLeft = markerCenter - barWidth / 2;
			} else {
				barLeft = startOffset * layout.dayColumnWidth + 3;
				barWidth = Math.max(12, durationDays * layout.dayColumnWidth - 6);
			}
		}

		taskLayouts.set(task.id, {
			rowTop: currentTop,
			rowHeight: layout.taskRowHeight,
			barWidth,
			barLeft,
			barRight: barLeft !== null && barWidth !== null ? barLeft + barWidth : null,
			markerCenter,
			durationDays,
			isRenderable,
			isMilestone: row.rowType === "milestone",
		});

		rows.push({
			...row,
			top: currentTop,
			height: layout.taskRowHeight,
		});

		currentTop += layout.taskRowHeight;
	}

	return {
		rows,
		taskLayouts,
		bodyHeight: Math.max(currentTop, layout.taskRowHeight),
	};
}

type TaskTimelineViewProps = {
	projectId?: string;
	tasks: TimelineSourceTask[];
	timelineRows?: TimelineRow[];
	projectTeam?: TimelineTeamMember[];
	getTaskHref?: (taskId: string) => string | null;
	showWeeklyTable?: boolean;
	compact?: boolean;
	title?: string;
};

export default function TaskTimelineView({
	projectId,
	tasks,
	timelineRows: providedTimelineRows,
	projectTeam = [],
	getTaskHref,
	showWeeklyTable = true,
	compact = false,
	title,
}: TaskTimelineViewProps) {
	const t = useTranslations();
	const router = useRouter();
	const { lang, isRTL } = useCheckedLocale();
	const locale = lang === "ar" ? ar : enUS;
	const today = new Date();
	const ganttScrollRef = useRef<HTMLDivElement | null>(null);
	const timelineTitle = title ?? t("Construction Roadmap");
	const visibleTaskRows = 6;
	const untranslatedLabels = useMemo(
		() => ({
			activity: lang === "ar" ? "الأنشطة" : "Activities",
			duration: lang === "ar" ? "المدة" : "Duration",
			window: lang === "ar" ? "الفترة" : "Window",
			milestone: lang === "ar" ? "نقطة إنجاز" : "Milestone",
			unscheduled: lang === "ar" ? "غير مجدولة" : "Unscheduled",
		}),
		[lang]
	);
	const timelineDisplayLabels = useMemo(
		() => ({
			activity: lang === "ar" ? "الأنشطة" : "Activities",
			start: lang === "ar" ? "البداية" : "Start",
			finish: lang === "ar" ? "النهاية" : "Finish",
			status: lang === "ar" ? "الحالة" : "Status",
			owner: lang === "ar" ? "المسؤول" : "Owner",
			filter: lang === "ar" ? "تصفية" : "Filter",
			options: lang === "ar" ? "خيارات" : "Options",
			today: lang === "ar" ? "اليوم" : "Today",
			zoom: "100%",
			timeline: lang === "ar" ? "الجدول الزمني" : "Timeline",
			milestone: lang === "ar" ? "نقطة إنجاز" : "Milestone",
			unscheduled: lang === "ar" ? "غير مجدولة" : "Unscheduled",
			day: lang === "ar" ? "يوم" : "day",
			days: lang === "ar" ? "أيام" : "days",
		}),
		[lang]
	);

	const resolveTaskHref = (taskId: string) =>
		getTaskHref?.(taskId) ?? (projectId ? `/projects/${projectId}/tasks/${taskId}` : null);

	const openTask = (taskId: string) => {
		const href = resolveTaskHref(taskId);
		if (!href) return;
		router.push(href);
	};

	const { timelineTasks: generatedTimelineTasks, timelineRows: generatedTimelineRows } = createTimelineRows(tasks, projectTeam, {
		referenceDate: today,
	});
	const timelineTasks = useMemo(
		() =>
			providedTimelineRows
				? providedTimelineRows
						.filter((row): row is Extract<TimelineRow, { rowType: "task" | "milestone" }> => row.rowType !== "group")
						.map((row) => row.task)
				: generatedTimelineTasks,
		[generatedTimelineTasks, providedTimelineRows]
	);
	const timelineRows = providedTimelineRows ?? generatedTimelineRows;
	const translatedTimelineRows = useMemo(
		() =>
			timelineRows.map((row) =>
				row.rowType === "group"
					? {
							...row,
							title: row.groupKey ? t(row.groupKey) : row.title,
					  }
					: {
							...row,
							groupLabel: getTranslatedTaskTypeLabel(row.task, t),
					  }
			),
		[t, timelineRows]
	);
	const totalRenderedRows = translatedTimelineRows.filter((row) => row.rowType !== "group").length;
	const groupedTaskCounts = translatedTimelineRows
		.filter((row): row is Extract<TimelineRow, { rowType: "group" }> => row.rowType === "group")
		.map((row) => ({
			taskType: row.groupKey,
			count: row.count,
		}));
	const receivedTaskDiagnostics = tasks.map((task, index) => ({
		index,
		name:
			(typeof task.taskName === "string" && task.taskName.trim()) ||
			(typeof task.title === "string" && task.title.trim()) ||
			(typeof task.name === "string" && task.name.trim()) ||
			`Task ${index + 1}`,
		taskType:
			(typeof task.taskType === "string" && task.taskType.trim()) || "general",
		taskStatus:
			(typeof task.taskStatus === "string" && task.taskStatus.trim()) || "not_started",
	}));

	const timelineRange = getTimelineRangeFromRows(translatedTimelineRows, today);
	const layout = useMemo(
		() => getResolvedLayout(timelineRange.totalDays, compact),
		[compact, timelineRange.totalDays]
	);
	const thisWeekTasks = getThisWeekTasks(timelineTasks, today);
	const monthSegments = useMemo(
		() => buildMonthSegments(timelineRange.start, timelineRange.end, locale),
		[locale, timelineRange.end, timelineRange.start]
	);
	const weekSegments = useMemo(
		() => buildWeekSegments(timelineRange.start, timelineRange.end, locale),
		[locale, timelineRange.end, timelineRange.start]
	);
	const timelineWidth = timelineRange.totalDays * layout.dayColumnWidth;
	const ganttWidth = layout.leftColumnWidth + timelineWidth;
	const roadmapViewportHeight = layout.taskRowHeight * visibleTaskRows + 24;
	const todayOffset = differenceInCalendarDays(today, timelineRange.start);
	const todayLeft = todayOffset * layout.dayColumnWidth + layout.dayColumnWidth / 2;
	const { rows: positionedTimelineRows, taskLayouts, bodyHeight } = getTaskLayouts(
		timelineRange.start,
		layout,
		translatedTimelineRows
	);
	const roadmapBodyHeight = Math.min(bodyHeight, roadmapViewportHeight);
	const groupSummaryLayouts = useMemo(() => {
		const summaries = new Map<string, { left: number; width: number }>();
		let activeGroupKey: string | null = null;
		let minLeft = Number.POSITIVE_INFINITY;
		let maxRight = Number.NEGATIVE_INFINITY;

		const commitGroup = () => {
			if (!activeGroupKey || !Number.isFinite(minLeft) || !Number.isFinite(maxRight)) return;
			summaries.set(activeGroupKey, {
				left: minLeft,
				width: Math.max(18, maxRight - minLeft),
			});
		};

		for (const row of positionedTimelineRows) {
			if (row.rowType === "group") {
				commitGroup();
				activeGroupKey = row.key;
				minLeft = Number.POSITIVE_INFINITY;
				maxRight = Number.NEGATIVE_INFINITY;
				continue;
			}

			const layoutForTask = taskLayouts.get(row.task.id);
			if (!layoutForTask || !layoutForTask.isRenderable) continue;

			if (layoutForTask.isMilestone && layoutForTask.markerCenter !== null) {
				const markerHalfWidth = Math.max((layoutForTask.barWidth ?? layout.barHeight) / 2, 8);
				minLeft = Math.min(minLeft, layoutForTask.markerCenter - markerHalfWidth);
				maxRight = Math.max(maxRight, layoutForTask.markerCenter + markerHalfWidth);
			} else if (layoutForTask.barLeft !== null && layoutForTask.barRight !== null) {
				minLeft = Math.min(minLeft, layoutForTask.barLeft);
				maxRight = Math.max(maxRight, layoutForTask.barRight);
			}
		}

		commitGroup();
		return summaries;
	}, [layout.barHeight, positionedTimelineRows, taskLayouts]);

	const handleScrollToToday = () => {
		if (!ganttScrollRef.current) return;
		ganttScrollRef.current.scrollTo({
			left: Math.max(0, todayLeft - 320),
			behavior: "smooth",
		});
	};

	useEffect(() => {
		if (process.env.NODE_ENV !== "development") return;

		console.debug("[timeline-roadmap]", {
			projectName: timelineTitle,
			totalTasksReceived: tasks.length,
			taskNamesReceived: receivedTaskDiagnostics.map((task) => task.name),
			receivedTasks: receivedTaskDiagnostics,
			mappedTimelineItemsCount: timelineTasks.length,
			groupedTasksCount: groupedTaskCounts,
			totalRenderedRows,
			bodyHeight,
			roadmapViewportHeight,
		});

		timelineTasks.forEach((task) => {
			const taskLayout = taskLayouts.get(task.id);
			if (!taskLayout) return;

			console.debug("[timeline-task]", {
				title: task.title,
				mappedStartDate: task.startDate?.toISOString() ?? null,
				mappedEndDate: task.endDate?.toISOString() ?? null,
				durationDays: taskLayout.durationDays,
				width: taskLayout.barWidth,
			});
		});
	}, [
		bodyHeight,
		groupedTaskCounts,
		receivedTaskDiagnostics,
		roadmapViewportHeight,
		taskLayouts,
		tasks.length,
		timelineTitle,
		timelineTasks,
		totalRenderedRows,
	]);

	const timelineHeaderSurface = "bg-zinc-50/95 dark:bg-[#18130f]/96 backdrop-blur-sm";
	const timelinePinnedSurface = "bg-background/95 dark:bg-[#15110d]/95 backdrop-blur-sm";

	return (
		<Card className="w-full min-w-0 max-w-full overflow-visible rounded-[24px] border border-zinc-200/80 bg-white shadow-[0_16px_38px_-28px_rgba(15,23,42,0.26)] dark:border-[#7f6c47]/26 dark:bg-[#14100c] dark:shadow-black/30">
			<CardHeader className="space-y-4 px-6 pb-4 pt-6 sm:px-7">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className={cn("space-y-1", isRTL ? "text-right" : "text-left")}>
						<CardTitle className="text-xl text-foreground">
							{timelineTitle}
						</CardTitle>
						<p className="text-sm text-muted-foreground">
							{t("Task timeline grouped by task type and status")}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
							<span className="size-2 rounded-full bg-amber-400 dark:bg-amber-300" />
							{t("In Progress")}
						</span>
						<span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
							<span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
							{t("Completed")}
						</span>
						<span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
							<span className="size-2 rounded-full bg-rose-500 dark:bg-rose-400" />
							{t("On Hold")}
						</span>
						<span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
							<span className="size-2 rounded-full bg-slate-400 dark:bg-slate-500" />
							{t("Not Started")}
						</span>
					</div>
				</div>
			</CardHeader>
			<CardContent className={cn("min-w-0 max-w-full overflow-visible px-6 pb-6 sm:px-7", showWeeklyTable ? "space-y-6" : "space-y-0")}>
				<div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_12px_30px_-26px_rgba(15,23,42,0.22)] dark:border-[#7f6c47]/24 dark:bg-[#17120e] dark:shadow-black/20">
					{timelineTasks.length === 0 ? (
						<div className="px-6 py-14 text-center text-sm text-muted-foreground">
							{t("There are no tasks at this stage")}
						</div>
					) : (
						<div className="min-w-0 max-w-full overflow-visible bg-white dark:bg-[#17120e]">
							<div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/75 px-5 py-3 dark:border-[#7f6c47]/18 sm:px-6">
								<div className="flex flex-wrap items-center gap-2">
									<span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-[#7f6c47]/20 dark:bg-[#201914] dark:text-stone-200">
										<CalendarDays className="h-3.5 w-3.5" />
										{timelineDisplayLabels.timeline}
									</span>
									<span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500 dark:border-[#7f6c47]/18 dark:bg-[#17120e] dark:text-stone-400">
										{timelineTasks.length} {lang === "ar" ? "عنصر" : "items"}
									</span>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<button
										type="button"
										className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-[#7f6c47]/18 dark:bg-[#17120e] dark:text-stone-300 dark:hover:bg-[#201914]"
									>
										<Filter className="h-3.5 w-3.5" />
										{timelineDisplayLabels.filter}
									</button>
									<span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-[#7f6c47]/18 dark:bg-[#201914] dark:text-stone-200">
										<SlidersHorizontal className="h-3.5 w-3.5" />
										{timelineDisplayLabels.zoom}
									</span>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleScrollToToday}
										className="h-auto rounded-full border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/50"
									>
										{timelineDisplayLabels.today}
									</Button>
									<button
										type="button"
										className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-[#7f6c47]/18 dark:bg-[#17120e] dark:text-stone-300 dark:hover:bg-[#201914]"
									>
										<MoreHorizontal className="h-3.5 w-3.5" />
										{timelineDisplayLabels.options}
									</button>
								</div>
							</div>
							<div
								ref={ganttScrollRef}
								dir="ltr"
								className="max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-zinc-100/70 dark:[&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/25"
							>
								<div
									className="grid min-w-[980px]"
									style={{
										width: `${ganttWidth}px`,
										gridTemplateColumns: `${layout.leftColumnWidth}px ${timelineWidth}px`,
									}}
								>
									<div
										className={cn(
											"sticky left-0 z-30 border-b border-zinc-200/85 px-5 py-4 shadow-[10px_0_28px_-22px_rgba(15,23,42,0.18)] dark:border-[#7f6c47]/26 sm:px-6",
											timelinePinnedSurface
										)}
										style={{ height: layout.headerHeight }}
									>
										<div className="flex h-full flex-col justify-between">
											<div className="flex items-center justify-between gap-3">
												<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
													{timelineDisplayLabels.activity}
												</p>
												<span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:border-[#7f6c47]/18 dark:bg-white/5 dark:text-stone-300">
													{totalRenderedRows}
												</span>
											</div>
											<div className="space-y-1.5">
												<p className="text-sm font-semibold text-zinc-900 dark:text-stone-100">
													{t("Task Name")}
												</p>
												<p className="text-xs text-zinc-500 dark:text-stone-400">
													{lang === "ar"
														? "اسم النشاط مع الحالة والمسؤول والمدة في سطر واضح"
														: "Activity list with status, owner, and duration"}
												</p>
											</div>
										</div>
									</div>

									<div
										className={cn(
											"sticky top-0 z-20 relative border-b border-border/70 shadow-[inset_0_-1px_0_rgba(0,0,0,0.04)]",
											timelineHeaderSurface
										)}
										style={{ height: layout.headerHeight }}
									>
										<div className="flex h-full flex-col">
											<div className="flex h-[54px] border-b border-zinc-200/80 dark:border-[#7f6c47]/22">
												{monthSegments.map((segment) => (
													<div
														key={segment.key}
														className="flex shrink-0 items-center border-r border-zinc-200/75 bg-zinc-50/90 px-4 dark:border-[#7f6c47]/20 dark:bg-[#1d1712]/80"
														style={{ width: segment.days * layout.dayColumnWidth }}
													>
														<span className="whitespace-nowrap text-sm font-semibold tracking-[0.01em] text-zinc-900 dark:text-stone-100">
															{segment.label}
														</span>
													</div>
												))}
											</div>
											<div className="flex h-[calc(100%-54px)]">
												{weekSegments.map((segment) => (
													<div
														key={segment.key}
														className="flex shrink-0 flex-col justify-center border-r border-zinc-200/65 bg-white/80 px-3 dark:border-[#7f6c47]/16 dark:bg-[#17120e]/88"
														style={{ width: segment.days * layout.dayColumnWidth }}
													>
														<span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-stone-400">
															{segment.subLabel ? `${segment.label} - ${segment.subLabel}` : segment.label}
														</span>
														<span className="mt-1 whitespace-nowrap text-[11px] font-medium text-zinc-800 dark:text-stone-200">
															{lang === "ar" ? "أسبوع" : "Week"}
														</span>
													</div>
												))}
											</div>
										</div>
										{monthSegments.slice(1).map((segment) => (
											<div
												key={`month-boundary-${segment.key}`}
												className="pointer-events-none absolute inset-y-0 z-10 border-l border-border/70"
												style={{ left: segment.startOffsetDays * layout.dayColumnWidth }}
											/>
										))}
										{weekSegments.slice(1).map((segment) => (
											<div
												key={`week-boundary-${segment.key}`}
												className="pointer-events-none absolute inset-y-0 z-[5] border-l border-border/35"
												style={{ left: segment.startOffsetDays * layout.dayColumnWidth }}
											/>
										))}
										{todayOffset >= 0 && todayOffset < timelineRange.totalDays && (
											<div
												className="absolute inset-y-0 z-20"
												style={{ left: todayLeft }}
											>
												<div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700 shadow-sm dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
													{timelineDisplayLabels.today}
												</div>
												<div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-blue-500/80 dark:bg-blue-400/80" />
											</div>
										)}
									</div>
								</div>

								<div
									className="roadmap-rows-scroll relative overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/70 hover:[&::-webkit-scrollbar-thumb]:bg-border"
									style={{ height: `${roadmapBodyHeight}px` }}
								>
									<div
										className="grid min-w-[980px] border-t border-zinc-200/75 dark:border-[#7f6c47]/20"
										style={{
											width: `${ganttWidth}px`,
											gridTemplateColumns: `${layout.leftColumnWidth}px ${timelineWidth}px`,
										}}
									>
										<div
											className={cn("sticky left-0 z-20 border-r border-zinc-200/80 shadow-[12px_0_26px_-22px_rgba(15,23,42,0.18)] dark:border-[#7f6c47]/24", timelinePinnedSurface)}
											style={{ height: bodyHeight }}
										>
											{positionedTimelineRows.map((row) =>
												row.rowType === "group" ? (
													<div
														key={row.key}
														className="absolute inset-x-0 border-b border-zinc-200/70 bg-zinc-50/92 px-5 dark:border-[#7f6c47]/18 dark:bg-[#1a1511]/90 sm:px-6"
														style={{
															top: row.top,
															height: row.height,
														}}
													>
														<div className="flex h-full min-w-0 items-center gap-3">
															<span
																className={cn(
																	"h-3 w-3 rounded-full shadow-sm",
																	getGroupAccentClasses(row.groupKey)
																)}
															/>
															<div className="min-w-0 flex-1">
																<p className="truncate text-sm font-semibold text-foreground">
																	{row.title}
																</p>
															</div>
															<span className="rounded-full border border-zinc-200 bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:border-[#7f6c47]/18 dark:bg-[#17120e] dark:text-stone-300">
																{row.count}
															</span>
														</div>
													</div>
												) : (
													(() => {
														const task = row.task;
														const taskStatusLabel = getTranslatedTaskStatusLabel(task, t);
														const taskTypeLabel = getTranslatedTaskTypeLabel(task, t);
														const taskOwnerLabel = task.ownerLabel || t("Not set");
														const resolvedDurationText = !task.isScheduled
															? timelineDisplayLabels.unscheduled
															: task.isMilestone
																? timelineDisplayLabels.milestone
																: `${task.durationDays} ${task.durationDays === 1 ? timelineDisplayLabels.day : timelineDisplayLabels.days}`;
														const durationText = !task.isScheduled
															? untranslatedLabels.unscheduled
															: task.isMilestone
																? untranslatedLabels.milestone
																: `${task.durationDays} ${lang === "ar" ? "يوم" : task.durationDays === 1 ? "day" : "days"}`;

														return (
															<div
																key={row.key}
																className="absolute inset-x-0 border-b border-zinc-200/60 bg-white px-5 py-3 dark:border-[#7f6c47]/14 dark:bg-[#17120e] sm:px-6"
																style={{
																	top: row.top,
																	height: row.height,
																}}
															>
																<div className="flex h-full min-w-0 flex-col justify-center">
																	<div className="min-w-0">
																		<p
																			className={cn(
																				"line-clamp-2 text-sm font-semibold leading-6 text-zinc-900 dark:text-stone-100",
																				isRTL && "text-right"
																			)}
																			title={task.name}
																		>
																			{task.name}
																		</p>
																		<div
																			className={cn(
																				"mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 dark:text-stone-300",
																				isRTL && "justify-end"
																			)}
																		>
																			<span
																				className="max-w-[180px] truncate rounded-full border border-zinc-200/80 bg-zinc-50/95 px-2 py-0.5 font-medium text-zinc-600 dark:border-[#7f6c47]/24 dark:bg-[#221b15] dark:text-stone-300"
																				title={taskTypeLabel}
																			>
																				{taskTypeLabel}
																			</span>
																			<span
																				className={cn(
																					"inline-flex max-w-[150px] truncate rounded-full border px-2 py-0.5 font-semibold",
																					getTaskStatusBadgeClasses(task)
																				)}
																				title={taskStatusLabel}
																			>
																				{taskStatusLabel}
																			</span>
																			<span
																				className="max-w-[160px] truncate text-zinc-700 dark:text-stone-200"
																				title={taskOwnerLabel}
																			>
																				{taskOwnerLabel}
																			</span>
																		</div>
																	</div>
																	<div
																		className={cn(
																			"mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-stone-400",
																			isRTL && "justify-end"
																		)}
																	>
																		<div className="flex items-center gap-2">
																			<span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-[9px] font-semibold text-zinc-700 dark:border-[#7f6c47]/18 dark:bg-[#201914] dark:text-stone-200">
																				{getOwnerInitials(taskOwnerLabel)}
																			</span>
																			<span>{resolvedDurationText}</span>
																		</div>
																		<div className="truncate">
																			{row.startDate && row.endDate
																				? `${formatTimelineCellDate(row.startDate, locale)} - ${formatTimelineCellDate(row.endDate, locale)}`
																				: formatTimelineCellDate(row.startDate ?? row.endDate, locale)}
																		</div>
																	</div>
																</div>
															</div>
														);
													})()
												)
											)}
										</div>

										<div
											className="relative bg-[linear-gradient(to_bottom,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] dark:bg-[linear-gradient(to_bottom,rgba(24,19,15,0.98),rgba(17,17,17,0.985))]"
											style={{
												height: bodyHeight,
												width: timelineWidth,
											}}
										>
											{monthSegments.slice(1).map((segment) => (
												<div
													key={`month-line-${segment.key}`}
													className="pointer-events-none absolute inset-y-0 z-[2] border-l border-border/60"
													style={{ left: segment.startOffsetDays * layout.dayColumnWidth }}
												/>
											))}
											{weekSegments.slice(1).map((segment) => (
												<div
													key={`week-line-${segment.key}`}
													className="pointer-events-none absolute inset-y-0 z-[1] border-l border-border/30"
													style={{ left: segment.startOffsetDays * layout.dayColumnWidth }}
												/>
											))}
											{todayOffset >= 0 && todayOffset < timelineRange.totalDays && (
												<div
													className="pointer-events-none absolute inset-y-0 z-10"
													style={{ left: todayLeft }}
												>
													<div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-blue-500/80 dark:bg-blue-400/80" />
												</div>
											)}

											{positionedTimelineRows.map((row) =>
												row.rowType === "group" ? (
													<div
														key={row.key}
														className="absolute inset-x-0 border-b border-zinc-200/60 bg-zinc-50/80 dark:border-[#7f6c47]/16 dark:bg-white/[0.025]"
														style={{
															top: row.top,
															height: row.height,
														}}
													>
														{(() => {
															const summaryLayout = groupSummaryLayouts.get(row.key);

															return (
																<>
																	{summaryLayout ? (
																		<div
																			className="pointer-events-none absolute top-1/2 h-3 -translate-y-1/2 rounded-full border border-sky-200/80 bg-sky-100/80 shadow-[0_8px_18px_-14px_rgba(14,116,144,0.55)] dark:border-sky-800/60 dark:bg-sky-950/35"
																			style={{
																				left: summaryLayout.left,
																				width: summaryLayout.width,
																			}}
																		/>
																	) : null}
																	<div className="relative flex h-full items-center px-4">
																		<div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/92 px-3 py-1 shadow-sm">
																<span
																	className={cn(
																		"h-2.5 w-2.5 rounded-full",
																		getGroupAccentClasses(row.groupKey)
																	)}
																/>
																<span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
																	{row.title}
																</span>
																		</div>
																	</div>
																</>
															);
														})()}
													</div>
												) : (
													(() => {
														const task = row.task;
														const taskLayout = taskLayouts.get(task.id);
														if (!taskLayout || !taskLayout.isRenderable) return null;

														const barClasses = getTaskBarClasses(task);
														const showInlineContent =
															!taskLayout.isMilestone && Boolean(taskLayout.barWidth && taskLayout.barWidth >= 120);
														const taskHref = resolveTaskHref(task.id);
														const barTitle = task.name;

															return (
																<div
																	key={row.key}
																	className="absolute inset-x-0 border-b border-zinc-200/55 dark:border-[#7f6c47]/12"
																	style={{
																		top: row.top,
																		height: row.height,
																	}}
																>
																	{taskLayout.isMilestone ? (
																		<button
																		type="button"
																		onClick={() => openTask(task.id)}
																		disabled={!taskHref}
																		title={barTitle}
																			aria-label={barTitle}
																			className={cn(
																				"absolute flex items-center justify-center border shadow-[0_8px_20px_-14px_rgba(15,23,42,0.45)] ring-2 ring-white/70 transition-all hover:-translate-y-px hover:shadow-md disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-sm dark:ring-[#17120e]",
																				barClasses
																			)}
																			style={{
																				left: taskLayout.barLeft ?? 0,
																				top: (row.height - Math.max(layout.barHeight + 2, 18)) / 2,
																				width: taskLayout.barWidth ?? Math.max(layout.barHeight, 16),
																				height: taskLayout.barWidth ?? Math.max(layout.barHeight + 2, 18),
																				transform: "rotate(45deg)",
																				borderRadius: "6px",
																			}}
																		>
																		<span className="sr-only">{barTitle}</span>
																	</button>
																) : (
																	<button
																		type="button"
																		onClick={() => openTask(task.id)}
																		disabled={!taskHref}
																		title={barTitle}
																			aria-label={barTitle}
																			className={cn(
																				"absolute flex items-center overflow-hidden rounded-full border px-3.5 text-left shadow-[0_12px_24px_-18px_rgba(15,23,42,0.5)] ring-2 ring-white/70 transition-all hover:-translate-y-px hover:shadow-md disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-sm dark:ring-[#17120e]",
																				barClasses
																			)}
																			style={{
																				left: taskLayout.barLeft ?? 0,
																				top: (row.height - layout.barHeight) / 2,
																				width: taskLayout.barWidth ?? 0,
																				height: layout.barHeight,
																			}}
																		>
																		{showInlineContent ? (
																			<span
																				className={cn(
																					"block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold tracking-[0.01em]",
																					isRTL ? "text-right" : "text-left"
																				)}
																			>
																				{task.name}
																			</span>
																		) : null}
																	</button>
																)}
															</div>
														);
													})()
												)
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>

				{showWeeklyTable && (
					<div className="space-y-4">
						<div>
							<h3 className="text-lg font-semibold">{t("This Week")}</h3>
							<p className="text-sm text-muted-foreground">
								{t("Weekly execution focus across active tasks")}
							</p>
						</div>

						<div className="overflow-hidden rounded-3xl border border-border/60 bg-card">
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-border/60">
									<thead className="bg-muted/30">
										<tr className="text-left">
											{[
												t("Task Name"),
												t("Owner"),
												t("Priority"),
												t("Timeline"),
												t("Due date"),
												t("Status"),
											].map((label) => (
												<th
													key={label}
													className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
												>
													{label}
												</th>
											))}
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{thisWeekTasks.length === 0 ? (
											<tr>
												<td
													colSpan={6}
													className="px-4 py-10 text-center text-sm text-muted-foreground"
												>
													{t("No scheduled tasks for this week")}
												</td>
											</tr>
										) : (
											thisWeekTasks.map((task) => (
												<tr
													key={task.id}
													className="bg-background/40 transition-colors hover:bg-muted/20"
												>
													<td className="px-4 py-4">
														{(() => {
															const taskHref = resolveTaskHref(task.id);
															return (
																<button
																	type="button"
																	onClick={() => openTask(task.id)}
																	disabled={!taskHref}
																	className={cn(
																		"max-w-[220px] truncate text-sm font-medium text-foreground transition-colors hover:text-primary disabled:cursor-default disabled:hover:text-foreground",
																		isRTL && "text-right"
																	)}
																>
																	{task.name}
																</button>
															);
														})()}
													</td>
													<td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
														{task.ownerLabel || t("Not set")}
													</td>
													<td className="px-4 py-4">
														<span
															className={cn(
																"inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]",
																getPriorityClasses(task.priority)
															)}
														>
															{t(
																task.priority === "high"
																	? "High"
																	: task.priority === "medium"
																		? "Medium"
																		: "Low"
															)}
														</span>
													</td>
													<td className="min-w-[240px] px-4 py-4">
														<div className="space-y-2">
															<div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
																<span>{getDurationLabel(task, locale)}</span>
																<span>{task.progress}%</span>
															</div>
															<Progress
																value={task.progress}
																showValueLabel={false}
																className="h-2.5 bg-muted/70"
																indicatorClassName={getProgressIndicatorClasses(task)}
															/>
														</div>
													</td>
													<td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
														{format(task.dueDate ?? task.placementDate, "d MMM yyyy", { locale })}
													</td>
													<td className="px-4 py-4">
														<span
															className={cn(
																"inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]",
																task.isOverdue
																	? "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-400/30 dark:bg-rose-950/35 dark:text-rose-200"
																	: task.status === "completed"
																		? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/35 dark:text-emerald-200"
																		: task.status === "in_progress" || task.status === "needs_review"
																			? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/35 dark:text-amber-200"
																			: "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-400/30 dark:bg-slate-900/45 dark:text-slate-200"
															)}
														>
															{getTranslatedTaskStatusLabel(task, t)}
														</span>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
