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
	rowHeight: number;
	maxBodyHeight: string;
};

const DEFAULT_LAYOUT: TimelineLayoutMetrics = {
	leftColumnWidth: 232,
	dayColumnWidth: 64,
	headerHeight: 64,
	rowHeight: 60,
	maxBodyHeight: "none",
};

const COMPACT_LAYOUT: TimelineLayoutMetrics = {
	leftColumnWidth: 208,
	dayColumnWidth: 52,
	headerHeight: 56,
	rowHeight: 52,
	maxBodyHeight: "min(58vh, 34rem)",
};

function getTaskVisualState(status: string) {
	const normalizedStatus = status.trim().toLowerCase();

	if (["completed", "done", "complete"].includes(normalizedStatus)) {
		return "completed";
	}

	if (
		["on_hold", "paused", "stopped", "blocked"].includes(normalizedStatus)
	) {
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
			return "border-[rgba(109,150,122,0.42)] bg-[rgba(109,150,122,0.30)] text-white";
		case "blocked":
			return "border-[rgba(176,96,96,0.42)] bg-[rgba(176,96,96,0.28)] text-white";
		case "not_started":
			return "border-[rgba(112,118,128,0.42)] bg-[rgba(112,118,128,0.28)] text-white";
		case "in_progress":
		default:
			return "border-[rgba(218,197,143,0.45)] bg-[rgba(218,197,143,0.35)] text-white";
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
	return `${format(task.startDate, "d MMM", { locale })} - ${format(task.endDate, "d MMM", {
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
			return t(task.status);
		default:
			return formatStatus(task.status);
	}
}

function getTranslatedTaskTypeLabel(task: TimelineTask, t: ReturnType<typeof useTranslations>) {
	switch (task.type) {
		case "foundations":
		case "finishes":
		case "general":
			return t(task.type);
		default:
			return formatStatus(task.type);
	}
}

function getTaskLayouts(
	tasks: TimelineTask[],
	timelineStart: Date,
	layout: TimelineLayoutMetrics
) {
	const entries = tasks.map((task, index) => {
		const startOffset = differenceInCalendarDays(task.startDate, timelineStart);
		const endOffset = differenceInCalendarDays(task.endDate, timelineStart);
		const barLeft = startOffset * layout.dayColumnWidth + 8;
		const durationDays = Math.max(1, differenceInCalendarDays(task.endDate, task.startDate) + 1);
		const barWidth = task.hasExplicitEndDate
			? Math.max(layout.dayColumnWidth - 12, durationDays * layout.dayColumnWidth - 12)
			: Math.max(18, layout.dayColumnWidth - 20);

		return [
			task.id,
			{
				rowCenter: index * layout.rowHeight + layout.rowHeight / 2,
				barLeft,
				barWidth,
				barRight: barLeft + barWidth,
				durationDays,
			},
		] as const;
	});

	return Object.fromEntries(entries) as Record<
		string,
		{
			rowCenter: number;
			barLeft: number;
			barWidth: number;
			barRight: number;
			durationDays: number;
		}
	>;
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
	const timelineRange = getTimelineRange(timelineTasks, today);
	const thisWeekTasks = getThisWeekTasks(timelineTasks, today);
	const timelineDays = Array.from({ length: timelineRange.totalDays }, (_, index) => {
		const day = new Date(timelineRange.start);
		day.setDate(day.getDate() + index);
		return day;
	});
	const timelineWidth = timelineRange.totalDays * layout.dayColumnWidth;
	const bodyHeight = Math.max(
		layout.rowHeight * Math.max(timelineTasks.length, 1),
		layout.rowHeight
	);
	const ganttWidth = layout.leftColumnWidth + timelineWidth;
	const todayOffset = differenceInCalendarDays(today, timelineRange.start);
	const todayLeft = todayOffset * layout.dayColumnWidth + layout.dayColumnWidth / 2;
	const taskLayouts = getTaskLayouts(timelineTasks, timelineRange.start, layout);

	useEffect(() => {
		if (process.env.NODE_ENV !== "development") return;

		timelineTasks.forEach((task) => {
			const taskLayout = taskLayouts[task.id];
			if (!taskLayout) return;

			console.debug("[timeline-task]", {
				title: task.title,
				mappedStartDate: task.startDate.toISOString(),
				mappedEndDate: task.endDate.toISOString(),
				durationDays: task.durationDays,
				width: taskLayout.barWidth,
			});
		});
	}, [taskLayouts, timelineTasks]);

	return (
		<Card className="w-full min-w-0 max-w-full overflow-hidden border-border/60 shadow-sm">
			<CardHeader className="space-y-4 pb-4">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<CardTitle className="text-xl tracking-[0.08em]">
							{timelineTitle}
						</CardTitle>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							{t("Project Timeline View")}
						</span>
						{showWeeklyTable && (
							<span className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								{t("This Week")}
							</span>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className={cn("min-w-0 max-w-full overflow-hidden", showWeeklyTable ? "space-y-6" : "space-y-0")}>
				<div className="min-w-0 max-w-full overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,#151d26_0%,#0f151d_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
					<div className="flex flex-col gap-3 border-b border-white/8 px-4 py-4 text-white/80 lg:flex-row lg:items-center lg:justify-between">
						<div className="space-y-1">
							<p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/90">
								{timelineTitle}
							</p>
							{!compact && (
								<p className="text-xs text-white/55">
									{t("Task bars reflect task start dates and due dates")}
								</p>
							)}
						</div>
						<div className="flex flex-wrap items-center gap-2 text-[11px] text-white/65">
							<span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
								<span className="size-2 rounded-full bg-[#d8c7a3]" />
								{t("In Progress")}
							</span>
							<span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
								<span className="size-2 rounded-full bg-emerald-400" />
								{t("Completed")}
							</span>
							<span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
								<span className="size-2 rounded-full bg-rose-400" />
								{t("On Hold")}
							</span>
							<span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
								<span className="size-2 rounded-full bg-slate-300" />
								{t("Not Started")}
							</span>
						</div>
					</div>

					{timelineTasks.length === 0 ? (
						<div className="px-6 py-14 text-center text-sm text-white/60">
							{t("There are no tasks at this stage")}
						</div>
					) : (
						<div className="min-w-0 max-w-full overflow-hidden">
							<div
								dir="ltr"
								className="max-w-full overflow-x-auto overflow-y-auto overscroll-contain"
								style={{
									maxHeight: layout.maxBodyHeight,
								}}
							>
								<div
									className="min-w-[900px]"
									style={{
										width: `${ganttWidth}px`,
									}}
								>
									<div
										className="grid"
										style={{
											gridTemplateColumns: `${layout.leftColumnWidth}px ${timelineWidth}px`,
										}}
									>
								<div
									className="sticky left-0 top-0 z-30 border-b border-white/8 bg-[#14202a] px-4 py-4"
									style={{ height: layout.headerHeight }}
								>
									<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
										{t("Tasks")}
									</p>
								</div>
								<div
									className="relative border-b border-white/8"
									style={{
										height: layout.headerHeight,
										backgroundImage:
											"linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)",
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
												<span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
													{format(day, "EEE", { locale })}
												</span>
												<span className="mt-1 text-sm font-medium text-white/85">
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
											<div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-sm">
												{t("Today")}
											</div>
											<div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-amber-300/90" />
										</div>
									)}
								</div>

								<div
									className="sticky left-0 z-20 bg-[#111923]"
									style={{ height: bodyHeight }}
								>
									{timelineTasks.map((task, index) => (
										<div
											key={task.id}
											className="absolute inset-x-0 border-b border-white/6 px-4 py-3"
											style={{
												top: index * layout.rowHeight,
												height: layout.rowHeight,
											}}
										>
											<div className="flex items-center justify-between gap-3">
												<div className="min-w-0">
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
															"mt-1 flex items-center gap-2 text-[11px] text-white/45",
															isRTL && "justify-end"
														)}
													>
														<span>{getTranslatedTaskTypeLabel(task, t)}</span>
														<span className="text-white/20">|</span>
														<span>{task.ownerLabel || t("Not set")}</span>
													</div>
												</div>
											</div>
										</div>
									))}
								</div>

								<div
									className="relative"
									style={{
										height: bodyHeight,
										width: timelineWidth,
										backgroundImage:
											"linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)",
										backgroundSize: `${layout.dayColumnWidth}px 100%`,
									}}
								>
									{todayOffset >= 0 && todayOffset < timelineRange.totalDays && (
										<div
											className="pointer-events-none absolute inset-y-0 z-10"
											style={{ left: todayLeft }}
										>
											<div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-amber-300/90" />
										</div>
									)}

									{timelineTasks.map((task, index) => {
										const taskLayout = taskLayouts[task.id];
										const barClasses = getTaskBarClasses(task);
										const minimumVisibleBarWidth = layout.dayColumnWidth - 12;
										const showInlineContent = taskLayout.barWidth >= 88;
										const taskHref = resolveTaskHref(task.id);

										return (
											<div
												key={task.id}
												className="absolute inset-x-0 border-b border-white/6"
												style={{
													top: index * layout.rowHeight,
													height: layout.rowHeight,
												}}
											>
												<button
													type="button"
													onClick={() => openTask(task.id)}
													disabled={!taskHref}
													title={task.name}
													aria-label={task.name}
													className={cn(
														"absolute flex h-6 items-center overflow-hidden rounded-md border px-2 text-left shadow-[0_10px_22px_rgba(0,0,0,0.12)] disabled:cursor-default",
														barClasses
													)}
													style={{
														left: taskLayout.barLeft,
														top: (layout.rowHeight - 24) / 2,
														width: task.hasExplicitEndDate
															? Math.max(taskLayout.barWidth, minimumVisibleBarWidth)
															: taskLayout.barWidth,
													}}
												>
													<div
														className={cn(
															"flex min-w-0 flex-1 items-center overflow-hidden",
															isRTL ? "justify-end text-right" : "justify-start text-left"
														)}
													>
														{showInlineContent ? (
															<span
																className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold tracking-[0.04em] text-white"
																title={task.name}
															>
																{task.name}
															</span>
														) : null}
													</div>
												</button>
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
													{format(task.dueDate, "d MMM yyyy", { locale })}
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

