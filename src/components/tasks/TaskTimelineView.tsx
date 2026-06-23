"use client";

import { useEffect, useMemo, useState } from "react";
import { format, startOfDay } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import {
	CalendarDays,
	ChevronDown,
	ChevronRight,
	Filter,
	Plus,
	Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useCheckedLocale } from "@/lib/client-utils";
import { cn, formatStatus } from "@/lib/utils";

import {
	createTimelineTasks,
	getTaskDurationLabel,
	getTaskStatusColorClasses,
	getThisWeekTasks,
	groupTasksByType,
	isTaskInThisWeek,
	sortTasksByDate,
	type TimelineRow,
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
};

type FilterValue =
	| "all"
	| "in_progress"
	| "completed"
	| "on_hold"
	| "not_started"
	| "this_week";

function extractProjectName(title: string | undefined, lang: string) {
	if (!title?.trim()) {
		return lang === "ar" ? "المشروع الحالي" : "Current Project";
	}

	const trimmed = title.trim();
	const parts = trimmed.split(/[:：]/);

	if (parts.length > 1) {
		const candidate = parts.slice(1).join(":").trim();
		return candidate || trimmed;
	}

	return trimmed;
}

function formatDateLabel(date: Date | null | undefined, locale: typeof enUS) {
	if (!date) return "-";
	return format(date, "d MMM yyyy", { locale });
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

function matchesTaskFilter(task: TimelineTask, filter: FilterValue, today: Date) {
	switch (filter) {
		case "in_progress":
			return ["in_progress", "needs_review", "working", "active"].includes(task.status);
		case "completed":
			return task.status === "completed";
		case "on_hold":
			return ["on_hold", "paused", "stopped", "blocked"].includes(task.status);
		case "not_started":
			return ["not_started", "pending"].includes(task.status);
		case "this_week":
			return isTaskInThisWeek(task, today);
		case "all":
		default:
			return true;
	}
}

export default function TaskTimelineView({
	projectId,
	tasks,
	timelineRows: providedTimelineRows,
	projectTeam = [],
	getTaskHref,
	showWeeklyTable = true,
	compact = false,
	title,
	isLoading = false,
}: TaskTimelineViewProps) {
	const t = useTranslations();
	const router = useRouter();
	const { lang, isRTL } = useCheckedLocale();
	const locale = lang === "ar" ? ar : enUS;
	const today = startOfDay(new Date());
	const [searchValue, setSearchValue] = useState("");
	const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
	const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
	const projectName = extractProjectName(title, lang);

	const labels = useMemo(
		() => ({
			scheduling: "Scheduling",
			project: lang === "ar" ? "المشروع" : "Project",
			operationsTimeline:
				lang === "ar" ? "التسلسل التشغيلي" : "Operations Timeline",
			search:
				lang === "ar"
					? "ابحث عن مهمة أو حالة أو مسؤول"
					: "Search by task, status, or owner",
			addActivity: lang === "ar" ? "إضافة نشاط" : "Add Activity",
			all: lang === "ar" ? "الكل" : "All",
			inProgress: lang === "ar" ? "قيد التنفيذ" : "In Progress",
			completed: lang === "ar" ? "مكتمل" : "Completed",
			onHold: lang === "ar" ? "متوقف" : "On Hold",
			notStarted: lang === "ar" ? "لم يبدأ" : "Not Started",
			thisWeek: lang === "ar" ? "هذا الأسبوع" : "This Week",
			noTasks:
				lang === "ar"
					? "لا توجد مهام لعرضها في هذا التسلسل."
					: "No tasks are available for this timeline.",
			noResults:
				lang === "ar"
					? "لا توجد نتائج مطابقة للبحث أو الفلتر الحالي."
					: "No tasks match the current search or filter.",
			loading: lang === "ar" ? "جارٍ تحميل المهام..." : "Loading tasks...",
			owner: lang === "ar" ? "المسؤول / الشركة" : "Assignee / Company",
			start: lang === "ar" ? "البداية" : "Start",
			finish: lang === "ar" ? "النهاية" : "Finish",
			duration: lang === "ar" ? "المدة" : "Duration",
			progress: lang === "ar" ? "الإنجاز" : "Progress",
			status: lang === "ar" ? "الحالة" : "Status",
			note: lang === "ar" ? "ملاحظة" : "Note",
			withoutDate: lang === "ar" ? "بدون تاريخ" : "Without Date",
			noOwner: lang === "ar" ? "غير محدد" : "Not set",
			day: lang === "ar" ? "يوم" : "day",
			days: lang === "ar" ? "أيام" : "days",
			tasksCount: lang === "ar" ? "مهام" : "tasks",
			thisWeekTable: lang === "ar" ? "هذا الأسبوع" : "This Week",
			weeklyFocus:
				lang === "ar"
					? "قائمة سريعة للمهام الواقعة ضمن الأسبوع الحالي"
					: "Quick list of tasks scheduled within the current week",
			noWeekTasks:
				lang === "ar" ? "لا توجد مهام لهذا الأسبوع" : "No scheduled tasks for this week",
		}),
		[lang]
	);

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

	const translatedTasks = useMemo(
		() =>
			baseTimelineTasks.map((task) => ({
				...task,
				groupLabel: getTranslatedTaskTypeLabel(task, t),
			})),
		[baseTimelineTasks, t]
	);

	const filteredTasks = useMemo(() => {
		const query = searchValue.trim().toLowerCase();

		return translatedTasks.filter((task) => {
			if (!matchesTaskFilter(task, activeFilter, today)) {
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
	}, [activeFilter, searchValue, t, today, translatedTasks]);

	const groupedSections = useMemo(
		() => groupTasksByType(sortTasksByDate(filteredTasks)),
		[filteredTasks]
	);

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

	const thisWeekTasks = useMemo(
		() => getThisWeekTasks(baseTimelineTasks, today),
		[baseTimelineTasks, today]
	);

	const resolveTaskHref = (taskId: string) =>
		getTaskHref?.(taskId) ?? (projectId ? `/projects/${projectId}/tasks/${taskId}` : null);

	const openTask = (taskId: string) => {
		const href = resolveTaskHref(taskId);
		if (!href) return;
		router.push(href);
	};

	const openTasksPage = () => {
		if (projectId) {
			router.push(`/projects/${projectId}/tasks?create=1`);
		}
	};

	const hasAnyTasks = translatedTasks.length > 0;
	const showEmptyState = isLoading || !hasAnyTasks || groupedSections.length === 0;
	const emptyStateLabel = isLoading
		? labels.loading
		: hasAnyTasks
			? labels.noResults
			: labels.noTasks;

	return (
		<div
			className="w-full min-w-0 border-y border-slate-200 bg-slate-50 text-slate-900 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-100"
			dir={isRTL ? "rtl" : "ltr"}
		>
			<div className="border-b border-slate-200 px-4 py-4 sm:px-5 dark:border-stone-800">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="min-w-0">
						<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-stone-500">
							{labels.scheduling}
						</p>
						<div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
							<h2 className="text-[18px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-stone-100">
								{labels.operationsTimeline}
							</h2>
							<span className="h-4 w-px bg-slate-200 dark:bg-stone-800" />
							<span className="truncate text-sm text-slate-600 dark:text-stone-300">
								{projectName}
							</span>
						</div>
					</div>

					<div className="flex items-center gap-2 self-start lg:self-auto">
						<Button
							type="button"
							size="sm"
							disabled={!projectId}
							onClick={openTasksPage}
							className="h-8 rounded-sm bg-slate-900 px-3 text-[12px] font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-stone-200 dark:text-stone-950 dark:hover:bg-stone-100"
						>
							<Plus className="me-1.5 h-3.5 w-3.5" />
							{labels.addActivity}
						</Button>
					</div>
				</div>

				<div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="relative w-full max-w-sm">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
						<Input
							value={searchValue}
							onChange={(event) => setSearchValue(event.target.value)}
							placeholder={labels.search}
							className={cn(
								"h-9 rounded-sm border-slate-200 bg-white ps-9 text-sm shadow-none dark:border-stone-800 dark:bg-stone-950",
								isRTL && "text-right"
							)}
						/>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Filter className="h-3.5 w-3.5 text-slate-400 dark:text-stone-500" />
						{(
							[
								["all", labels.all],
								["in_progress", labels.inProgress],
								["completed", labels.completed],
								["on_hold", labels.onHold],
								["not_started", labels.notStarted],
								["this_week", labels.thisWeek],
							] as const
						).map(([value, label]) => (
							<button
								key={value}
								type="button"
								onClick={() => setActiveFilter(value)}
								className={cn(
									"inline-flex h-8 items-center rounded-sm border px-3 text-[12px] font-medium transition-colors",
									activeFilter === value
										? "border-slate-900 bg-slate-900 text-white dark:border-stone-200 dark:bg-stone-200 dark:text-stone-950"
										: "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-900"
								)}
							>
								{label}
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="px-4 py-5 sm:px-5 lg:px-6">
				{showEmptyState ? (
					<div className="rounded-sm border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400">
						{emptyStateLabel}
					</div>
				) : (
					<div className="space-y-4">
						{groupedSections.map((section) => {
							const isCollapsed = collapsedSections[section.groupKey];
							const scheduledTasks = section.tasks.filter((task) => task.startDate);
							const undatedTasks = section.tasks.filter((task) => !task.startDate);

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
									className="border border-slate-200 bg-white dark:border-stone-800 dark:bg-stone-950"
								>
									<CollapsibleTrigger asChild>
										<button
											type="button"
											className="flex w-full items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-right dark:border-stone-800"
										>
											<div className="min-w-0">
												<h3 className="truncate text-sm font-semibold text-slate-900 dark:text-stone-100">
													{section.groupLabel}
												</h3>
												<p className="mt-1 text-[12px] text-slate-500 dark:text-stone-400">
													{section.tasks.length} {labels.tasksCount}
												</p>
											</div>
											{isCollapsed ? (
												<ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-stone-500" />
											) : (
												<ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-stone-500" />
											)}
										</button>
									</CollapsibleTrigger>

									<CollapsibleContent>
										<div className="px-4 py-4">
											<div className="relative">
												<div className="absolute bottom-3 right-[0.7rem] top-3 w-px bg-slate-200 dark:bg-stone-800" />

												<div className="space-y-4">
													{scheduledTasks.map((task) => {
														const statusClasses = getTaskStatusColorClasses(task.status);
														const taskHref = resolveTaskHref(task.id);
														const taskStatusLabel = getTranslatedTaskStatusLabel(task.status, t);
														const note = task.notes?.trim();

														return (
															<div key={task.id} className="relative pe-8">
																<span
																	className={cn(
																		"absolute right-[0.375rem] top-6 size-3 rounded-full ring-4 ring-slate-50 dark:ring-stone-950",
																		statusClasses.dot
																	)}
																/>
																<article
																	className={cn(
																		"rounded-md border bg-white p-4 dark:bg-stone-950",
																		statusClasses.card
																	)}
																>
																	<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
																		<div className="min-w-0">
																			<button
																				type="button"
																				onClick={() => openTask(task.id)}
																				disabled={!taskHref}
																				title={task.name}
																				className="max-w-full truncate text-right text-sm font-semibold text-slate-900 transition-colors hover:text-sky-600 disabled:cursor-default disabled:hover:text-slate-900 dark:text-stone-100 dark:disabled:hover:text-stone-100"
																			>
																				{task.name}
																			</button>
																			<div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-500 dark:text-stone-400">
																				<span
																					className={cn(
																						"inline-flex items-center rounded-sm border px-2 py-1 font-medium",
																						statusClasses.badge
																					)}
																				>
																					{taskStatusLabel}
																				</span>
																				<span className="inline-flex items-center gap-1">
																					<CalendarDays className="h-3.5 w-3.5" />
																					{formatDateLabel(task.startDate, locale)}
																				</span>
																			</div>
																		</div>

																		<div className="flex items-center gap-3">
																			<div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100">
																				{getOwnerInitials(task.ownerLabel || labels.noOwner)}
																			</div>
																		</div>
																	</div>

																	<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
																		<div className="min-w-0">
																			<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
																				{labels.owner}
																			</p>
																			<p
																				className="mt-1 truncate text-sm text-slate-700 dark:text-stone-200"
																				title={task.ownerLabel || labels.noOwner}
																			>
																				{task.ownerLabel || labels.noOwner}
																			</p>
																		</div>

																		<div className="min-w-0">
																			<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
																				{labels.finish}
																			</p>
																			<p className="mt-1 truncate text-sm text-slate-700 dark:text-stone-200">
																				{task.hasExplicitEndDate
																					? formatDateLabel(task.endDate, locale)
																					: "-"}
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

																		<div className="min-w-0">
																			<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
																				{labels.progress}
																			</p>
																			<div className="mt-1 flex items-center gap-3">
																				<div className="min-w-[36px] text-sm font-semibold text-slate-700 dark:text-stone-200">
																					{task.progress}%
																				</div>
																				<Progress
																					value={task.progress}
																					showValueLabel={false}
																					className="h-2 bg-slate-200 dark:bg-stone-800"
																					indicatorClassName={statusClasses.progress}
																				/>
																			</div>
																		</div>
																	</div>

																	{note ? (
																		<div className="mt-4 border-t border-slate-200 pt-3 dark:border-stone-800">
																			<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
																				{labels.note}
																			</p>
																			<p
																				className="mt-1 truncate text-sm text-slate-600 dark:text-stone-300"
																				title={note}
																			>
																				{note}
																			</p>
																		</div>
																	) : null}
																</article>
															</div>
														);
													})}

													{undatedTasks.length > 0 ? (
														<div className="relative pe-8">
															<span className="absolute right-[0.375rem] top-5 size-3 rounded-full bg-slate-300 ring-4 ring-slate-50 dark:bg-stone-700 dark:ring-stone-950" />
															<div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 dark:border-stone-800 dark:bg-stone-900/50">
																<p className="mb-3 text-sm font-semibold text-slate-700 dark:text-stone-200">
																	{labels.withoutDate}
																</p>
																<div className="space-y-3">
																	{undatedTasks.map((task) => {
																		const statusClasses = getTaskStatusColorClasses(task.status);
																		const taskHref = resolveTaskHref(task.id);
																		return (
																			<div
																				key={task.id}
																				className={cn(
																					"rounded-md border bg-white px-3 py-3 dark:bg-stone-950",
																					statusClasses.card
																				)}
																			>
																				<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
																					<div className="min-w-0">
																						<button
																							type="button"
																							onClick={() => openTask(task.id)}
																							disabled={!taskHref}
																							title={task.name}
																							className="max-w-full truncate text-right text-sm font-medium text-slate-900 transition-colors hover:text-sky-600 disabled:cursor-default disabled:hover:text-slate-900 dark:text-stone-100 dark:disabled:hover:text-stone-100"
																						>
																							{task.name}
																						</button>
																						<p
																							className="mt-1 truncate text-[12px] text-slate-500 dark:text-stone-400"
																							title={task.ownerLabel || labels.noOwner}
																						>
																							{task.ownerLabel || labels.noOwner}
																						</p>
																					</div>
																					<span
																						className={cn(
																							"inline-flex items-center self-start rounded-sm border px-2 py-1 text-[12px] font-medium",
																							statusClasses.badge
																						)}
																					>
																						{getTranslatedTaskStatusLabel(task.status, t)}
																					</span>
																				</div>
																			</div>
																		);
																	})}
																</div>
															</div>
														</div>
													) : null}
												</div>
											</div>
										</div>
									</CollapsibleContent>
								</Collapsible>
							);
						})}
					</div>
				)}
			</div>

			{showWeeklyTable ? (
				<div className="border-t border-slate-200 bg-white px-4 py-5 sm:px-5 lg:px-6 dark:border-stone-800 dark:bg-stone-950">
					<div className="mb-4 flex flex-col gap-1">
						<h3 className="text-base font-semibold">{labels.thisWeekTable}</h3>
						<p className="text-sm text-slate-500 dark:text-stone-400">{labels.weeklyFocus}</p>
					</div>

					<div className="overflow-hidden border border-slate-200 dark:border-stone-800">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-slate-200 dark:divide-stone-800">
								<thead className="bg-slate-50 dark:bg-stone-900">
									<tr className="text-right">
										{[
											labels.project,
											labels.owner,
											labels.status,
											labels.start,
											labels.finish,
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
											<td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-stone-400">
												{labels.noWeekTasks}
											</td>
										</tr>
									) : (
										thisWeekTasks.map((task) => {
											const statusClasses = getTaskStatusColorClasses(task.status);
											return (
												<tr key={task.id} className="bg-white dark:bg-stone-950">
													<td className="px-4 py-4">
														<button
															type="button"
															onClick={() => openTask(task.id)}
															disabled={!resolveTaskHref(task.id)}
															className="max-w-[240px] truncate text-sm font-medium text-slate-900 transition-colors hover:text-sky-600 disabled:cursor-default disabled:hover:text-slate-900 dark:text-stone-100 dark:disabled:hover:text-stone-100"
														>
															{task.name}
														</button>
													</td>
													<td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-stone-300">
														{task.ownerLabel || labels.noOwner}
													</td>
													<td className="px-4 py-4">
														<span
															className={cn(
																"inline-flex rounded-sm border px-2.5 py-1 text-xs font-semibold",
																statusClasses.badge
															)}
														>
															{getTranslatedTaskStatusLabel(task.status, t)}
														</span>
													</td>
													<td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-stone-300">
														{formatDateLabel(task.startDate, locale)}
													</td>
													<td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-stone-300">
														{task.hasExplicitEndDate
															? formatDateLabel(task.endDate, locale)
															: "-"}
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
