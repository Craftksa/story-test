'use client'

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef, Row, Table as TanStackTable } from "@tanstack/react-table";
import { ar, enUS } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
import { ImagePlus, Loader2Icon, PlusCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "use-intl";

import { ActionButtons } from "@/components/ActionButtons";
import { DataTable, DataTableColumnHeader, DataTableFacetedFilter } from "@/components/data-table";
import TaskTimelineView from "@/components/tasks/TaskTimelineView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCheckedLocale } from "@/lib/client-utils";
import { cn, formatStatus, hasRole } from "@/lib/utils";
import { useProjectStore } from "@/store/projectStore";
import { useTaskStore } from "@/store/taskStore";

import {
	createTimelineTasks,
	formatTimelineDate,
	getTaskDurationLabel,
	getTaskStatusColorClasses,
	type TimelineSourceTask,
	type TimelineTask,
} from "./tasks/task-timeline-utils";

type TasksPageProps = {
	tasks: TimelineSourceTask[];
	projectId: string;
};

type TaskTableRow = TimelineTask & {
	taskId: string;
	taskName: string;
	taskStatus: string;
	taskType: string;
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

export function TasksPage({ tasks, projectId }: TasksPageProps) {
	const [viewMode, setViewMode] = useState<"table" | "timeline">("timeline");
	const { deleteTask, setProjectId } = useTaskStore();
	const { fetchOneProject, selectedProject, removeTaskFromProject } = useProjectStore();
	const searchParams = useSearchParams();
	const typeParam = searchParams.get("type");
	const t = useTranslations();
	const { lang } = useCheckedLocale();
	const locale = lang === "ar" ? ar : enUS;
	const { data: session } = useSession();
	const user = session?.user;
	const router = useRouter();
	const canManageTasks = Boolean(user && hasRole(user, ["admin", "moderator"]));
	const selectedProjectId = selectedProject?.id;

	useEffect(() => {
		setProjectId(projectId);
		if (!selectedProjectId || selectedProjectId !== projectId) {
			fetchOneProject(projectId);
		}
	}, [fetchOneProject, projectId, selectedProjectId, setProjectId]);

	const timelineTasks = useMemo(
		() => createTimelineTasks(tasks, selectedProject?.employees ?? []),
		[tasks, selectedProject?.employees]
	);

	const tableRows = useMemo<TaskTableRow[]>(
		() =>
			timelineTasks.map((task) => ({
				...task,
				taskId: task.id,
				taskName: task.name,
				taskStatus: task.status,
				taskType: task.groupKey,
			})),
		[timelineTasks]
	);

	const typeOptions = useMemo(
		() =>
			Array.from(new Map(tableRows.map((task) => [task.groupKey, task.groupLabel])).entries()).map(
				([value, label]) => ({
					value,
					label,
				})
			),
		[tableRows]
	);

	const statusOptions = useMemo(
		() => [
			{ value: "in_progress", label: t("In Progress") },
			{ value: "not_started", label: t("Not Started") },
			{ value: "needs_review", label: t("Needs Review") },
			{ value: "on_hold", label: t("On Hold") },
			{ value: "completed", label: t("Completed") },
		],
		[t]
	);

	const handleUpload = (item: TaskTableRow) => {
		router.push(`/projects/${projectId}/tasks/upload/${item.taskId}`);
	};

	const handleDelete = (item: TaskTableRow) => {
		deleteTask(item.taskId);
		removeTaskFromProject(item.taskId);
	};

	const columns: ColumnDef<TaskTableRow>[] = [
			{
				accessorKey: "taskName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t("Task Name")} />
				),
				cell: ({ row }: { row: Row<TaskTableRow> }) => {
					const task = row.original;
					return (
						<div className="min-w-[220px]">
							<div className="flex items-center gap-2">
								<Link
									href={`/projects/${projectId}/tasks/${task.taskId}`}
									className="font-medium text-foreground hover:text-primary"
								>
									{row.getValue("taskName")}
								</Link>
								{task.taskStatus === "in_progress" ? (
									<Loader2Icon className="size-4 min-w-4 animate-spin text-primary" />
								) : null}
							</div>
							<div className="mt-2 flex flex-wrap gap-2">
								<Badge
									variant="outline"
									className="border-slate-200 bg-slate-50 text-slate-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
								>
									{task.groupLabel}
								</Badge>
								{task.isOverdue ? (
									<Badge className="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
										{t("Overdue")}
									</Badge>
								) : null}
							</div>
						</div>
					);
				},
			},
			{
				accessorKey: "taskStatus",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t("Status")} />
				),
				cell: ({ row }: { row: Row<TaskTableRow> }) => {
					const task = row.original;
					const statusClasses = getTaskStatusColorClasses(task.taskStatus);
					return (
						<Badge className={cn("border", statusClasses.badge)}>
							{t(formatStatus(task.taskStatus))}
						</Badge>
					);
				},
			},
			{
				accessorKey: "taskType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t("Task Type")} />
				),
				cell: ({ row }: { row: Row<TaskTableRow> }) => (
					<span className="font-medium">{row.original.groupLabel}</span>
				),
			},
			{
				accessorKey: "startDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t("Start Date")} />
				),
				cell: ({ row }: { row: Row<TaskTableRow> }) => (
					<span>{formatTimelineDate(row.original.startDate, { locale })}</span>
				),
			},
			{
				accessorKey: "endDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t("End Date")} />
				),
				cell: ({ row }: { row: Row<TaskTableRow> }) => {
					const task = row.original;
					return (
						<div className="space-y-1">
							<span>{formatTimelineDate(task.endDate, { locale })}</span>
							{task.isOverdue ? (
								<p className="text-xs text-rose-600 dark:text-rose-300">{t("Overdue")}</p>
							) : null}
						</div>
					);
				},
			},
			{
				accessorKey: "durationDays",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t("Duration")} />
				),
				cell: ({ row }: { row: Row<TaskTableRow> }) => (
					<span>
						{getTaskDurationLabel(row.original, {
							dayLabel: t("day"),
							daysLabel: t("days"),
							unscheduledLabel: "-",
						})}
					</span>
				),
			},
			{
				accessorKey: "progress",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t("Progress")} />
				),
				cell: ({ row }: { row: Row<TaskTableRow> }) => {
					const task = row.original;
					const statusClasses = getTaskStatusColorClasses(task.taskStatus);

					return (
						<div className="min-w-[150px]">
							<div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
								<span>{task.progress}%</span>
							</div>
							<Progress
								value={task.progress}
								showValueLabel={false}
								className="h-2 bg-slate-200 dark:bg-stone-800"
								indicatorClassName={statusClasses.progress}
							/>
						</div>
					);
				},
			},
			{
				accessorKey: "priority",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t("Urgency")} />
				),
				cell: ({ row }: { row: Row<TaskTableRow> }) => {
					const task = row.original;
					const label =
						task.priority === "high"
							? t("High")
							: task.priority === "medium"
								? t("Medium")
								: t("Low");
					return (
						<Badge className={cn("border", getPriorityTone(task.priority))}>{label}</Badge>
					);
				},
			},
			{
				accessorKey: "updatedAt",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title={t("Updated")} />
				),
				cell: ({ row }: { row: Row<TaskTableRow> }) => {
					const task = row.original;
					return (
						<span>
							{task.updatedAt
								? formatDistanceToNow(task.updatedAt, {
										addSuffix: true,
										locale,
									})
								: "-"}
						</span>
					);
				},
			},
			{
				id: "actions",
				cell: ({ row }: { row: Row<TaskTableRow> }) => (
					<ActionButtons
						entity="task"
						data={row.original}
						onDelete={() => handleDelete(row.original)}
						confirmationText={row.original.taskName}
						viewPath={`/projects/${projectId}/tasks/${row.original.taskId}`}
						editPath={`/projects/${projectId}/tasks/edit/${row.original.taskId}`}
						extraActions={
							hasRole(user, ['admin', 'moderator', 'employee']) && (
								<Button
									variant="rounded"
									title={t("Upload Images")}
									size="icon"
									onClick={() => handleUpload(row.original)}
								>
									<ImagePlus className="h-4 w-4" />
								</Button>
							)
						}
					/>
				),
			},
		];

	const customActions = (
		<>
			{canManageTasks ? (
				<Link href={`/projects/${projectId}/tasks/new`}>
					<Button size="sm" className="create-new gap-2 px-3 py-1">
						<PlusCircleIcon className="h-4 w-4" />
						<span className="hidden md:block">{t("Add New Task")}</span>
					</Button>
				</Link>
			) : null}
		</>
	);

	const facetedFilter = (table: TanStackTable<TaskTableRow>) => {
		const normalizedTypeParam =
			typeParam === "foundations"
				? "construction"
				: typeParam === "finishes"
					? "architectural"
					: typeParam;
		const validTypeDefault = typeOptions.find((option) => option.value === normalizedTypeParam)?.value;

		return (
			<div className="flex gap-2">
				<DataTableFacetedFilter
					column={table.getColumn("taskType")!}
					title={t("Type")}
					options={typeOptions.map((option) => ({
						...option,
						default: option.value === validTypeDefault,
					}))}
				/>
				<DataTableFacetedFilter
					column={table.getColumn("taskStatus")!}
					title={t("Status")}
					options={statusOptions}
				/>
			</div>
		);
	};

	return (
		<div className="print:hidden">
			<Card className="rounded-none border-0 bg-transparent md:border md:bg-card">
				<CardHeader className="p-0 md:px-6">
					<CardTitle className="space-y-4">
						<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<span>{t("Tasks")}</span>
							<div className="flex flex-wrap items-center gap-3">
								<div className="inline-flex rounded-full border border-border/60 bg-muted/30 p-1">
										<Button
											type="button"
											size="sm"
											variant={viewMode === "timeline" ? "default" : "ghost"}
											className="rounded-full px-4"
											onClick={() => setViewMode("timeline")}
										>
											{t("Timeline")}
										</Button>
										<Button
											type="button"
											size="sm"
											variant={viewMode === "table" ? "default" : "ghost"}
											className="rounded-full px-4"
											onClick={() => setViewMode("table")}
										>
											{t("Table")}
										</Button>
								</div>
								{customActions}
							</div>
						</div>
					</CardTitle>
					<CardDescription>
						{t("Switch between the timeline and task table")}
					</CardDescription>
				</CardHeader>
				<CardContent className="p-0 md:px-6">
					{viewMode === "table" ? (
						<DataTable
							data={tableRows}
							columns={columns}
							globalFilter={true}
							loading={false}
							facetedFilter={facetedFilter}
							initialPageSize={Math.max(Math.min(tableRows.length, 20), 10)}
							emptyTableMessage={t("There are no tasks at this stage")}
						/>
					) : (
						<TaskTimelineView
							projectId={projectId}
							tasks={tasks}
							projectTeam={selectedProject?.employees ?? []}
							title={selectedProject?.name ?? undefined}
							showWeeklyTable={false}
							canCreateTask={canManageTasks}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export default TasksPage;
