"use client";

import { useEffect } from "react";
import { differenceInCalendarDays, format } from "date-fns";
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
	leftColumnWidth: 304,
	dayColumnWidth: 70,
	headerHeight: 68,
	groupRowHeight: 28,
	taskRowHeight: 66,
	barHeight: 28,
	maxBodyHeight: "none",
};

const COMPACT_LAYOUT: TimelineLayoutMetrics = {
	leftColumnWidth: 268,
	dayColumnWidth: 58,
	headerHeight: 60,
	groupRowHeight: 28,
	taskRowHeight: 64,
	barHeight: 28,
	maxBodyHeight: "none",
};

type TimelineTaskLayout = {
	rowTop: number;
	rowHeight: number;
	barLeft: number;
	barWidth: number;
	barRight: number;
	durationDays: number;
};

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
	switch (getTaskVisualState(task.status)) {
		case "completed":
			return "border-[rgba(71,127,99,0.55)] bg-[rgba(47,125,98,0.72)] text-white";
		case "blocked":
			return "border-[rgba(138,72,84,0.55)] bg-[rgba(111,48,56,0.78)] text-white";
		case "not_started":
			return "border-[rgba(123,125,130,0.42)] bg-[rgba(82,86,94,0.55)] text-white";
		case "in_progress":
		default:
			return "border-[rgba(218,197,143,0.48)] bg-[rgba(218,197,143,0.68)] text-[#111315]";
	}
}

function getPriorityClasses(priority: TimelineTask["priority"]) {
	switch (priority) {
		case "high":
			return "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";
		case "medium":
			return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";
		case "low":
		default:
			return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200";
	}
}

function getProgressIndicatorClasses(task: TimelineTask) {
	switch (getTaskVisualState(task.status)) {
		case "completed":
			return "bg-emerald-500";
		case "blocked":
			return "bg-rose-500";
		case "not_started":
			return "bg-slate-400";
		case "in_progress":
		default:
			return "bg-amber-500";
	}
}

function getDurationLabel(task: TimelineTask, locale: typeof enUS) {
	const startDate = task.startDate ?? task.placementDate;
	const endDate = task.endDate ?? startDate;

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
			return "bg-[#dac58f]";
		case "finishes":
		case "architectural":
			return "bg-[#9b8460]";
		case "mechanical":
			return "bg-[#7d8b92]";
		case "electrical":
			return "bg-[#8f7356]";
		default:
			return "bg-[#dac58f]";
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
			const effectiveStartDate = task.startDate ?? timelineStart;
			const startOffset = Math.max(
				0,
				differenceInCalendarDays(effectiveStartDate, timelineStart)
			);
			const durationDays =
				task.startDate && task.endDate
					? Math.max(1, differenceInCalendarDays(task.endDate, task.startDate) + 1)
					: 1;
			const minimumShortWidth = Math.max(layout.dayColumnWidth - 16, 84);
			const barWidth = task.startDate && task.endDate
				? Math.max(layout.dayColumnWidth - 14, durationDays * layout.dayColumnWidth - 14)
				: minimumShortWidth;

			taskLayouts.set(task.id, {
				rowTop: currentTop,
				rowHeight: layout.taskRowHeight,
				barLeft: startOffset * layout.dayColumnWidth + 8,
				barWidth,
				barRight: startOffset * layout.dayColumnWidth + 8 + barWidth,
				durationDays,
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
	const layout = compact ? COMPACT_LAYOUT : DEFAULT_LAYOUT;
	const timelineTitle = title ?? t("Construction Roadmap");
	const visibleTaskRows = 6;

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
	const thisWeekTasks = getThisWeekTasks(timelineTasks, today);
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

	return (
		<Card className="w-full min-w-0 max-w-full overflow-visible border-border/60 bg-card shadow-sm">
			<CardHeader className="space-y-4 pb-4">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className={cn("space-y-1", isRTL ? "text-right" : "text-left")}>
						<CardTitle className="text-xl tracking-[0.06em] text-foreground">
							{timelineTitle}
						</CardTitle>
						<p className="text-sm text-muted-foreground">
							{t("Task timeline grouped by task type and status")}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
							<span className="size-2 rounded-full bg-[#dac58f]" />
							{t("In Progress")}
						</span>
						<span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
							<span className="size-2 rounded-full bg-[#2f7d62]" />
							{t("Completed")}
						</span>
						<span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
							<span className="size-2 rounded-full bg-[#6f3038]" />
							{t("On Hold")}
						</span>
						<span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
							<span className="size-2 rounded-full bg-[#52565e]" />
							{t("Not Started")}
						</span>
					</div>
				</div>
			</CardHeader>
			<CardContent className={cn("min-w-0 max-w-full overflow-visible", showWeeklyTable ? "space-y-6" : "space-y-0")}>
				<div className="min-w-0 max-w-full overflow-visible rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,#12181f_0%,#0f141a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
					<div className="flex flex-col gap-3 border-b border-white/8 px-5 py-4 text-white/80 lg:flex-row lg:items-center lg:justify-between">
						<div className={cn("space-y-1", isRTL ? "text-right" : "text-left")}>
							<p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/88">
								{timelineTitle}
							</p>
							<p className="text-xs text-white/52">
								{t("Task timeline grouped by task type and status")}
							</p>
						</div>
						<div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
							{groupedTimelineTasks.length} {t("Tasks")}
						</div>
					</div>

					{timelineTasks.length === 0 ? (
						<div className="px-6 py-14 text-center text-sm text-white/60">
							{t("There are no tasks at this stage")}
						</div>
					) : (
						<div className="min-w-0 max-w-full overflow-visible">
							<div
								dir="ltr"
								className="max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain"
							>
								<div
									className="grid min-w-[980px]"
									style={{
										width: `${ganttWidth}px`,
										gridTemplateColumns: `${layout.leftColumnWidth}px ${timelineWidth}px`,
									}}
								>
									<div
										className="sticky left-0 z-30 border-b border-white/8 bg-[#131a22] px-5 py-4"
										style={{ height: layout.headerHeight }}
									>
										<div className="flex h-full items-center justify-between gap-3">
											<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
												{t("Tasks")}
											</p>
											<div className="h-px flex-1 bg-white/8" />
										</div>
									</div>

									<div
										className="relative border-b border-white/8 bg-[#121921]"
										style={{
											height: layout.headerHeight,
											backgroundImage:
												"linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px)",
											backgroundSize: `${layout.dayColumnWidth}px 100%`,
										}}
									>
										<div className="flex h-full">
											{timelineDays.map((day) => (
												<div
													key={day.toISOString()}
													className="flex shrink-0 flex-col justify-center border-r border-white/5 px-2 text-center"
													style={{ width: layout.dayColumnWidth }}
												>
													<span className="text-[10px] uppercase tracking-[0.18em] text-white/36">
														{format(day, "EEE", { locale })}
													</span>
													<span className="mt-1 text-sm font-medium text-white/82">
														{format(day, "d MMM", { locale })}
													</span>
												</div>
											))}
										</div>
										{todayOffset >= 0 && todayOffset < timelineRange.totalDays && (
											<div
												className="absolute inset-y-0 z-20"
												style={{ left: todayLeft }}
											>
												<div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-[#dac58f] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#111315] shadow-sm">
													{t("Today")}
												</div>
												<div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#dac58f]/80" />
											</div>
										)}
									</div>
								</div>

								<div
									className="roadmap-rows-scroll relative h-[408px] overflow-y-scroll overflow-x-visible overscroll-y-contain pr-1 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/28 hover:[&::-webkit-scrollbar-thumb]:bg-white/38"
								>
									<div
										className="grid min-w-[980px] border-t border-white/8"
										style={{
											width: `${ganttWidth}px`,
											gridTemplateColumns: `${layout.leftColumnWidth}px ${timelineWidth}px`,
										}}
									>
										<div
											className="sticky left-0 z-20 bg-[#10161d]"
											style={{ height: bodyHeight }}
										>
											{groupedTimelineTasks.map((group) => {
												const groupLayout = groupLayouts.get(group.key);
												if (!groupLayout) return null;

												return (
													<div key={group.key}>
														<div
															className="absolute inset-x-0 border-b border-white/6 bg-white/[0.03] px-5"
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
																	<p className="truncate text-sm font-semibold tracking-[0.04em] text-white/88">
																		{group.label}
																	</p>
																</div>
																<span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
																	{group.tasks.length}
																</span>
															</div>
														</div>

														{group.tasks.map((task) => {
															const taskLayout = taskLayouts.get(task.id);
															if (!taskLayout) return null;

															return (
																<div
																	key={task.id}
																	className="absolute inset-x-0 border-b border-white/6 px-5 py-3"
																	style={{
																		top: taskLayout.rowTop,
																		height: taskLayout.rowHeight,
																	}}
																>
																	<div className="flex h-full min-w-0 items-center">
																		<div className="flex h-full items-stretch pr-3">
																			<div className="w-px bg-white/8" />
																		</div>
																		<div className="min-w-0 flex-1">
																			<p
																				className={cn(
																					"truncate text-sm font-medium text-white/92",
																					isRTL && "text-right"
																				)}
																			>
																				{task.name}
																			</p>
																			<div
																				className={cn(
																					"mt-1 flex items-center gap-2 text-[11px] text-white/42",
																					isRTL && "justify-end"
																				)}
																			>
																				<span>{getTranslatedTaskStatusLabel(task, t)}</span>
																				<span className="text-white/20">|</span>
																				<span>{task.ownerLabel || t("Not set")}</span>
																			</div>
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
											className="relative bg-[#0f151c]"
											style={{
												height: bodyHeight,
												width: timelineWidth,
												backgroundImage:
													"linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px)",
												backgroundSize: `${layout.dayColumnWidth}px 100%`,
											}}
										>
											{todayOffset >= 0 && todayOffset < timelineRange.totalDays && (
												<div
													className="pointer-events-none absolute inset-y-0 z-10"
													style={{ left: todayLeft }}
												>
													<div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#dac58f]/80" />
												</div>
											)}

											{groupedTimelineTasks.map((group) => {
												const groupLayout = groupLayouts.get(group.key);
												if (!groupLayout) return null;

												return (
													<div key={group.key}>
														<div
															className="absolute inset-x-0 border-b border-white/6 bg-white/[0.03]"
															style={{
																top: groupLayout.top,
																height: groupLayout.height,
															}}
														>
															<div className="flex h-full items-center px-4">
																<div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">
																	<span
																		className={cn(
																			"h-2.5 w-2.5 rounded-full",
																			getGroupAccentClasses(group.key)
																		)}
																	/>
																	<span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/52">
																		{group.label}
																	</span>
																</div>
															</div>
														</div>

														{group.tasks.map((task) => {
															const taskLayout = taskLayouts.get(task.id);
															if (!taskLayout) return null;

															const barClasses = getTaskBarClasses(task);
															const showInlineContent = taskLayout.barWidth >= 112;
															const taskHref = resolveTaskHref(task.id);
															const barTitle = task.hasStartDate && !task.hasExplicitEndDate
																? `${task.name} - ${t("No fixed end date")}`
																: task.hasStartDate
																	? task.name
																	: `${task.name} - ${t("Unscheduled")}`;

															return (
																<div
																	key={task.id}
																	className="absolute inset-x-0 border-b border-white/6"
																	style={{
																		top: taskLayout.rowTop,
																		height: taskLayout.rowHeight,
																	}}
																>
																	<button
																		type="button"
																		onClick={() => openTask(task.id)}
																		disabled={!taskHref}
																		title={barTitle}
																		aria-label={barTitle}
																		className={cn(
																			"absolute flex items-center overflow-hidden rounded-md border px-[10px] text-left shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-px disabled:cursor-default disabled:hover:translate-y-0",
																			barClasses
																		)}
																		style={{
																			left: taskLayout.barLeft,
																			top: (taskLayout.rowHeight - layout.barHeight) / 2,
																			width: taskLayout.barWidth,
																			height: layout.barHeight,
																		}}
																	>
																		{showInlineContent ? (
																			<span
																				className={cn(
																					"block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold tracking-[0.02em]",
																					getTaskVisualState(task.status) === "in_progress"
																						? "text-[#111315]"
																						: "text-white",
																					isRTL ? "text-right" : "text-left"
																				)}
																			>
																				{task.name}
																			</span>
																		) : null}
																	</button>
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
																	? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
																	: task.status === "completed"
																		? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
																		: task.status === "in_progress" || task.status === "needs_review"
																			? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
																			: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200"
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
