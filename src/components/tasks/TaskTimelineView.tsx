"use client";

import { useEffect, useMemo } from "react";
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
import { useRouter } from "next/navigation";
import { useTranslations } from "use-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCheckedLocale } from "@/lib/client-utils";
import { cn, formatStatus } from "@/lib/utils";

import {
	createTimelineTasks,
	getThisWeekTasks,
	getTimelineRange,
	type TimelineSourceTask,
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
	leftColumnWidth: 360,
	dayColumnWidth: 24,
	headerHeight: 88,
	groupRowHeight: 36,
	taskRowHeight: 84,
	barHeight: 20,
	maxBodyHeight: "none",
};

const COMPACT_LAYOUT: TimelineLayoutMetrics = {
	leftColumnWidth: 320,
	dayColumnWidth: 18,
	headerHeight: 84,
	groupRowHeight: 36,
	taskRowHeight: 80,
	barHeight: 18,
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
		return "border-rose-300/85 bg-rose-100 text-rose-950 dark:border-rose-500/35 dark:bg-rose-500/18 dark:text-rose-100";
	}

	switch (getTaskVisualState(task.status)) {
		case "completed":
			return "border-emerald-300/70 bg-emerald-100 text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/18 dark:text-emerald-100";
		case "blocked":
			return "border-rose-300/80 bg-rose-100 text-rose-950 dark:border-rose-500/35 dark:bg-rose-500/18 dark:text-rose-100";
		case "not_started":
			return "border-border/80 bg-muted/90 text-foreground dark:bg-muted/55";
		case "in_progress":
		default:
			return "border-amber-300/80 bg-amber-100 text-amber-950 dark:border-amber-400/35 dark:bg-amber-400/20 dark:text-amber-100";
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
	tasks: TimelineTask[],
	timelineStart: Date,
	layout: TimelineLayoutMetrics,
	groupedTasks: Array<{ key: string; label: string; tasks: TimelineTask[] }>
) {
	const taskLayouts = new Map<string, TimelineTaskLayout>();
	const groupLayouts = new Map<
		string,
		{
			top: number;
			height: number;
		}
	>();

	let currentTop = 0;

	for (const group of groupedTasks) {
		groupLayouts.set(group.key, {
			top: currentTop,
			height: layout.groupRowHeight,
		});
		currentTop += layout.groupRowHeight;

		for (const task of group.tasks) {
			const isRenderable = task.isScheduled && Boolean(task.startDate && task.endDate);
			const durationDays =
				task.startDate && task.endDate
					? Math.max(1, differenceInCalendarDays(task.endDate, task.startDate) + 1)
					: 1;
			let barLeft: number | null = null;
			let barWidth: number | null = null;
			let markerCenter: number | null = null;

			if (isRenderable && task.startDate) {
				const startOffset = Math.max(0, differenceInCalendarDays(task.startDate, timelineStart));

				if (task.isMilestone) {
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
				isMilestone: task.isMilestone,
			});

			currentTop += layout.taskRowHeight;
		}
	}

	return {
		taskLayouts,
		groupLayouts,
		bodyHeight: Math.max(currentTop, layout.taskRowHeight),
	};
}

type TaskTimelineViewProps = {
	projectId?: string;
	tasks: TimelineSourceTask[];
	projectTeam?: TimelineTeamMember[];
	getTaskHref?: (taskId: string) => string | null;
	showWeeklyTable?: boolean;
	compact?: boolean;
	title?: string;
};

export default function TaskTimelineView({
	projectId,
	tasks,
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

	const resolveTaskHref = (taskId: string) =>
		getTaskHref?.(taskId) ?? (projectId ? `/projects/${projectId}/tasks/${taskId}` : null);

	const openTask = (taskId: string) => {
		const href = resolveTaskHref(taskId);
		if (!href) return;
		router.push(href);
	};

	const timelineTasks = createTimelineTasks(tasks, projectTeam, {
		referenceDate: today,
	});
	const groupedTimelineTasks = Array.from(
		timelineTasks.reduce((map, task) => {
			const existingGroup = map.get(task.groupKey);
			if (existingGroup) {
				existingGroup.tasks.push(task);
				return map;
			}

			map.set(task.groupKey, {
				key: task.groupKey,
				label: getTranslatedTaskTypeLabel(task, t),
				tasks: [task],
			});

			return map;
		}, new Map<string, { key: string; label: string; tasks: TimelineTask[] }>())
	).map(([, value]) => value);
	const totalRenderedRows = groupedTimelineTasks.reduce(
		(total, group) => total + group.tasks.length,
		0
	);
	const groupedTaskCounts = groupedTimelineTasks.map((group) => ({
		taskType: group.key,
		count: group.tasks.length,
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

	const timelineRange = getTimelineRange(timelineTasks, today);
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
	const timelineDays = Array.from({ length: timelineRange.totalDays }, (_, index) => {
		const day = new Date(timelineRange.start);
		day.setDate(day.getDate() + index);
		return day;
	});
	const timelineWidth = timelineRange.totalDays * layout.dayColumnWidth;
	const ganttWidth = layout.leftColumnWidth + timelineWidth;
	const roadmapViewportHeight = layout.taskRowHeight * visibleTaskRows + 24;
	const todayOffset = differenceInCalendarDays(today, timelineRange.start);
	const todayLeft = todayOffset * layout.dayColumnWidth + layout.dayColumnWidth / 2;
	const { taskLayouts, groupLayouts, bodyHeight } = getTaskLayouts(
		timelineTasks,
		timelineRange.start,
		layout,
		groupedTimelineTasks
	);
	const roadmapBodyHeight = Math.min(bodyHeight, roadmapViewportHeight);

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

	const timelineHeaderSurface = "bg-muted/25 dark:bg-muted/15";
	const timelinePinnedSurface = "bg-card/95 dark:bg-card/90 backdrop-blur-sm";

	return (
		<Card className="w-full min-w-0 max-w-full overflow-visible border-border/60 bg-card shadow-sm">
			<CardHeader className="space-y-4 pb-4">
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
			<CardContent className={cn("min-w-0 max-w-full overflow-visible", showWeeklyTable ? "space-y-6" : "space-y-0")}>
				<div className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-border/60 bg-background shadow-sm">
					{timelineTasks.length === 0 ? (
						<div className="px-6 py-14 text-center text-sm text-muted-foreground">
							{t("There are no tasks at this stage")}
						</div>
					) : (
						<div className="min-w-0 max-w-full overflow-visible">
							<div
								dir="ltr"
								className="max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/70 hover:[&::-webkit-scrollbar-thumb]:bg-border"
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
											"sticky left-0 z-30 border-b border-border/60 px-5 py-4",
											timelinePinnedSurface
										)}
										style={{ height: layout.headerHeight }}
									>
										<div className="flex h-full flex-col justify-between">
											<div className="flex items-center justify-between gap-3">
												<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
													{untranslatedLabels.activity}
												</p>
												<span className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
													{timelineTasks.length}
												</span>
											</div>
											<div className="grid grid-cols-[minmax(0,1fr)_92px_108px] gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
												<span>{t("Task Name")}</span>
												<span>{untranslatedLabels.duration}</span>
												<span>{untranslatedLabels.window}</span>
											</div>
										</div>
									</div>

									<div
										className={cn(
											"relative border-b border-border/60",
											timelineHeaderSurface
										)}
										style={{ height: layout.headerHeight }}
									>
										<div className="flex h-full flex-col">
											<div className="flex h-[42px] border-b border-border/60">
												{monthSegments.map((segment) => (
													<div
														key={segment.key}
														className="flex shrink-0 items-center border-r border-border/60 px-3"
														style={{ width: segment.days * layout.dayColumnWidth }}
													>
														<span className="text-xs font-semibold text-foreground">
															{segment.label}
														</span>
													</div>
												))}
											</div>
											<div className="flex h-[calc(100%-42px)]">
												{weekSegments.map((segment) => (
													<div
														key={segment.key}
														className="flex shrink-0 flex-col justify-center border-r border-border/40 px-2"
														style={{ width: segment.days * layout.dayColumnWidth }}
													>
														<span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
															{segment.label}
														</span>
														<span className="mt-1 text-xs font-medium text-foreground">
															{segment.subLabel ? `${segment.label} - ${segment.subLabel}` : segment.label}
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
												<div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-border/60 bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground shadow-sm">
													{t("Today")}
												</div>
												<div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-primary/65" />
											</div>
										)}
									</div>
								</div>

								<div
									className="roadmap-rows-scroll relative overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/70 hover:[&::-webkit-scrollbar-thumb]:bg-border"
									style={{ height: `${roadmapBodyHeight}px` }}
								>
									<div
										className="grid min-w-[980px] border-t border-border/60"
										style={{
											width: `${ganttWidth}px`,
											gridTemplateColumns: `${layout.leftColumnWidth}px ${timelineWidth}px`,
										}}
									>
										<div
											className={cn("sticky left-0 z-20", timelinePinnedSurface)}
											style={{ height: bodyHeight }}
										>
											{groupedTimelineTasks.map((group) => {
												const groupLayout = groupLayouts.get(group.key);
												if (!groupLayout) return null;

												return (
													<div key={group.key}>
														<div
															className="absolute inset-x-0 border-b border-border/50 bg-muted/30 px-5"
															style={{
																top: groupLayout.top,
																height: groupLayout.height,
															}}
														>
															<div className="flex h-full items-center gap-3">
																<span
																	className={cn(
																		"h-3 w-3 rounded-full shadow-sm",
																		getGroupAccentClasses(group.key)
																	)}
																/>
																<div className="min-w-0 flex-1">
																	<p className="truncate text-sm font-semibold text-foreground">
																		{group.label}
																	</p>
																</div>
																<span className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
																	{group.tasks.length}
																</span>
															</div>
														</div>

														{group.tasks.map((task) => {
															const taskLayout = taskLayouts.get(task.id);
															if (!taskLayout) return null;

															const durationText = !task.isScheduled
																? untranslatedLabels.unscheduled
																: task.isMilestone
																	? untranslatedLabels.milestone
																	: `${task.durationDays} ${lang === "ar" ? "يوم" : task.durationDays === 1 ? "day" : "days"}`;

															return (
																<div
																	key={task.id}
																	className="absolute inset-x-0 border-b border-border/40 px-5 py-3"
																	style={{
																		top: taskLayout.rowTop,
																		height: taskLayout.rowHeight,
																	}}
																>
																	<div className="grid h-full min-w-0 grid-cols-[minmax(0,1fr)_92px_108px] items-center gap-3">
																		<div className="min-w-0">
																			<p
																				className={cn(
																					"truncate text-sm font-semibold text-foreground",
																					isRTL && "text-right"
																				)}
																				title={task.name}
																			>
																				{task.name}
																			</p>
																			<div
																				className={cn(
																					"mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground",
																					isRTL && "justify-end"
																				)}
																			>
																				<span className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5">
																					{getTranslatedTaskStatusLabel(task, t)}
																				</span>
																				<span className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5">
																					{task.ownerLabel || t("Not set")}
																				</span>
																				<span className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5">
																					{getTranslatedTaskTypeLabel(task, t)}
																				</span>
																			</div>
																		</div>
																		<div className="text-xs font-medium text-muted-foreground">
																			{durationText}
																		</div>
																		<div className="text-xs font-medium text-muted-foreground">
																			{getDurationLabel(task, locale)}
																		</div>
																	</div>
																</div>
															);
														})}
													</div>
												);
											})}
										</div>

										<div
											className="relative bg-background"
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
													<div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-primary/65" />
												</div>
											)}

											{groupedTimelineTasks.map((group) => {
												const groupLayout = groupLayouts.get(group.key);
												if (!groupLayout) return null;

												return (
													<div key={group.key}>
														<div
															className="absolute inset-x-0 border-b border-border/40 bg-muted/20"
															style={{
																top: groupLayout.top,
																height: groupLayout.height,
															}}
														>
															<div className="flex h-full items-center px-4">
																<div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1">
																	<span
																		className={cn(
																			"h-2.5 w-2.5 rounded-full",
																			getGroupAccentClasses(group.key)
																		)}
																	/>
																	<span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
																		{group.label}
																	</span>
																</div>
															</div>
														</div>

														{group.tasks.map((task) => {
															const taskLayout = taskLayouts.get(task.id);
															if (!taskLayout || !taskLayout.isRenderable) return null;

															const barClasses = getTaskBarClasses(task);
															const showInlineContent =
																!taskLayout.isMilestone && Boolean(taskLayout.barWidth && taskLayout.barWidth >= 120);
															const taskHref = resolveTaskHref(task.id);
															const barTitle = task.isScheduled
																? task.name
																: `${task.name} - ${untranslatedLabels.unscheduled}`;

															return (
																<div
																	key={task.id}
																	className="absolute inset-x-0 border-b border-border/30"
																	style={{
																		top: taskLayout.rowTop,
																		height: taskLayout.rowHeight,
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
																				"absolute flex items-center justify-center border shadow-sm ring-1 ring-background/60 transition-all hover:-translate-y-px hover:shadow-md disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-sm",
																				barClasses
																			)}
																			style={{
																				left: taskLayout.barLeft ?? 0,
																				top: (taskLayout.rowHeight - Math.max(layout.barHeight, 16)) / 2,
																				width: taskLayout.barWidth ?? Math.max(layout.barHeight, 16),
																				height: taskLayout.barWidth ?? Math.max(layout.barHeight, 16),
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
																				"absolute flex items-center overflow-hidden rounded-full border px-3 text-left shadow-sm ring-1 ring-background/60 transition-all hover:-translate-y-px hover:shadow-md disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-sm",
																				barClasses
																			)}
																			style={{
																				left: taskLayout.barLeft ?? 0,
																				top: (taskLayout.rowHeight - layout.barHeight) / 2,
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
														})}
													</div>
												);
											})}
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
