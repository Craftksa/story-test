"use client";

import type { Locale } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
	formatTimelineDate,
	getTaskDurationLabel,
	getTaskStatusColorClasses,
	type SprintBuckets,
	type TimelineTask,
} from "./task-timeline-utils";

export type TaskSprintBoardLabels = {
	active: string;
	activeDescription: string;
	noActive: string;
	starting: string;
	startingDescription: string;
	noStarting: string;
	ending: string;
	endingDescription: string;
	noEnding: string;
	overdue: string;
	overdueDescription: string;
	noOverdue: string;
	completed: string;
	completedDescription: string;
	noCompleted: string;
	upcoming: string;
	upcomingDescription: string;
	noUpcoming: string;
	owner: string;
	start: string;
	finish: string;
	duration: string;
	noOwner: string;
	day: string;
	days: string;
	high: string;
	medium: string;
	low: string;
	phase: string;
	overdueBadge: string;
};

type TaskSprintBoardProps = {
	buckets: SprintBuckets;
	getTaskHref: (taskId: string) => string | null;
	isRTL: boolean;
	labels: TaskSprintBoardLabels;
	locale: Locale;
	onOpenTask: (taskId: string) => void;
	translateStatus: (status: string) => string;
	translateType: (task: TimelineTask) => string;
};

type SprintColumnConfig = {
	key: keyof SprintBuckets;
	title: string;
	description: string;
	emptyLabel: string;
};

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

function getPriorityLabel(task: TimelineTask, labels: TaskSprintBoardLabels) {
	switch (task.priority) {
		case "high":
			return labels.high;
		case "medium":
			return labels.medium;
		case "low":
		default:
			return labels.low;
	}
}

function TaskSprintCard({
	task,
	getTaskHref,
	labels,
	locale,
	onOpenTask,
	translateStatus,
	translateType,
}: {
	task: TimelineTask;
	getTaskHref: (taskId: string) => string | null;
	labels: TaskSprintBoardLabels;
	locale: Locale;
	onOpenTask: (taskId: string) => void;
	translateStatus: (status: string) => string;
	translateType: (task: TimelineTask) => string;
}) {
	const statusClasses = getTaskStatusColorClasses(task.status);
	const taskHref = getTaskHref(task.id);

	return (
		<div
			className={cn(
				"rounded-xl border bg-white p-4 shadow-sm transition-colors dark:bg-stone-950",
				statusClasses.card
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<Button
						type="button"
						variant="link"
						onClick={() => onOpenTask(task.id)}
						disabled={!taskHref}
						className="h-auto p-0 text-start text-sm font-semibold text-slate-900 hover:text-sky-600 disabled:no-underline dark:text-stone-100"
					>
						<span className="line-clamp-2">{task.name}</span>
					</Button>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<Badge className={cn("border", statusClasses.badge)}>
							{translateStatus(task.status)}
						</Badge>
						<Badge
							variant="outline"
							className="border-slate-200 bg-slate-50 text-slate-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
						>
							{translateType(task)}
						</Badge>
						<Badge className={cn("border", getPriorityTone(task.priority))}>
							{getPriorityLabel(task, labels)}
						</Badge>
						{task.isOverdue ? (
							<Badge className="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
								{labels.overdueBadge}
							</Badge>
						) : null}
					</div>
				</div>
				<div className={cn("mt-0.5 size-3 rounded-full", statusClasses.dot)} />
			</div>

			<div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 dark:text-stone-300">
				<div className="min-w-0">
					<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
						{labels.owner}
					</p>
					<p className="mt-1 truncate">{task.ownerLabel || labels.noOwner}</p>
				</div>
				<div className="min-w-0">
					<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
						{labels.duration}
					</p>
					<p className="mt-1">
						{getTaskDurationLabel(task, {
							dayLabel: labels.day,
							daysLabel: labels.days,
							unscheduledLabel: "-",
						})}
					</p>
				</div>
				<div className="min-w-0">
					<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
						{labels.start}
					</p>
					<p className="mt-1 truncate">
						{formatTimelineDate(task.startDate, { locale })}
					</p>
				</div>
				<div className="min-w-0">
					<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-stone-500">
						{labels.finish}
					</p>
					<p className="mt-1 truncate">
						{formatTimelineDate(task.endDate, { locale })}
					</p>
				</div>
			</div>
		</div>
	);
}

export default function TaskSprintBoard({
	buckets,
	getTaskHref,
	isRTL,
	labels,
	locale,
	onOpenTask,
	translateStatus,
	translateType,
}: TaskSprintBoardProps) {
	const columns: SprintColumnConfig[] = [
		{
			key: "active",
			title: labels.active,
			description: labels.activeDescription,
			emptyLabel: labels.noActive,
		},
		{
			key: "starting",
			title: labels.starting,
			description: labels.startingDescription,
			emptyLabel: labels.noStarting,
		},
		{
			key: "ending",
			title: labels.ending,
			description: labels.endingDescription,
			emptyLabel: labels.noEnding,
		},
		{
			key: "overdue",
			title: labels.overdue,
			description: labels.overdueDescription,
			emptyLabel: labels.noOverdue,
		},
		{
			key: "completed",
			title: labels.completed,
			description: labels.completedDescription,
			emptyLabel: labels.noCompleted,
		},
		{
			key: "upcoming",
			title: labels.upcoming,
			description: labels.upcomingDescription,
			emptyLabel: labels.noUpcoming,
		},
	];

	return (
		<div
			className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3"
			dir={isRTL ? "rtl" : "ltr"}
		>
			{columns.map((column) => {
				const tasks = buckets[column.key];

				return (
					<section
						key={column.key}
						className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-stone-800 dark:bg-stone-900/40"
					>
						<div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-stone-800">
							<div>
								<h3 className="text-base font-semibold text-slate-900 dark:text-stone-100">
									{column.title}
								</h3>
								<p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
									{column.description}
								</p>
							</div>
							<Badge
								variant="outline"
								className="border-slate-200 bg-white text-slate-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200"
							>
								{tasks.length}
							</Badge>
						</div>

						<div className="mt-4 space-y-3">
							{tasks.length === 0 ? (
								<div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center text-sm text-slate-500 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400">
									{column.emptyLabel}
								</div>
							) : (
								tasks.map((task) => (
									<TaskSprintCard
										key={task.id}
										task={task}
										getTaskHref={getTaskHref}
										labels={labels}
										locale={locale}
										onOpenTask={onOpenTask}
										translateStatus={translateStatus}
										translateType={translateType}
									/>
								))
							)}
						</div>
					</section>
				);
			})}
		</div>
	);
}
