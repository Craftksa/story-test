'use client'

import React, {useEffect, useState} from "react";
import {DataTable, DataTableColumnHeader, DataTableFacetedFilter} from "@/components/data-table";
import {Button} from "@/components/ui/button";
import {ImagePlus, Loader2Icon, PlusCircleIcon} from "lucide-react";
import Link from "next/link";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {useRouter, useSearchParams} from "next/navigation";
import {useSession} from "next-auth/react";
import {formatStatus, hasRole} from "@/lib/utils";
import StatusBadge from "@/components/StatusBadgeSystem";
import {useTaskStore} from "@/store/taskStore";
import {useProjectStore} from "@/store/projectStore";
import CustomLink from "@/components/CustomLink";
import {ActionButtons} from "@/components/ActionButtons";
import {useTranslations} from "use-intl";
import {formatDistanceToNow} from "date-fns";
import {ar, enUS} from "date-fns/locale";
import {useCheckedLocale} from "@/lib/client-utils";
import TaskTimelineView from "@/components/tasks/TaskTimelineView";


export function TasksPage({tasks, projectId}: { tasks: any[], projectId: string }) {
	const [viewMode, setViewMode] = useState<"table" | "timeline">("table");
	const {deleteTask, setProjectId} = useTaskStore();
	const {fetchOneProject, selectedProject, removeTaskFromProject} = useProjectStore();
	const searchParams = useSearchParams();
	const typeParam = searchParams.get("type");
	const t = useTranslations();
	const {lang} = useCheckedLocale();

	function sortTasksByEffectiveDate(tasks: any[]) {
		return tasks.slice().sort((a, b) => {
			const aDate = a.startDate ? new Date(a.startDate) : new Date(a.createdAt);
			const bDate = b.startDate ? new Date(b.startDate) : new Date(b.createdAt);

			return aDate.getTime() - bDate.getTime();
		});
	}

	const sortedTasks = sortTasksByEffectiveDate(tasks);


	useEffect(() => {
		setProjectId(projectId);
		if (!selectedProject || selectedProject.id !== projectId) {
			fetchOneProject(projectId);
		}
	}, [fetchOneProject, projectId, selectedProject?.id, setProjectId]);

	const {data: session} = useSession();
	const user = session?.user;
	const router = useRouter();

	const columns = [
		{
			accessorKey: "taskName",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Task Name"/>
			),
			cell: ({row}: any) => (
				<span
					className={`${row.original.taskStatus === 'completed' ? 'line-through' : ''} font-medium inline-flex items-center justify-center`}>
					<CustomLink href={`/projects/${projectId}/tasks/${row.original.taskId}`}>
						{row.getValue("taskName")}
					</CustomLink>
					{row.original.taskStatus === 'in_progress' &&
              <Loader2Icon className="size-4 min-w-4 mx-2 animate-spin text-primary"/>}
				</span>
			),
		},
		{
			accessorKey: "taskStatus",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Status"/>
			),
			cell: ({row}: any) => (
				<StatusBadge status={formatStatus(row.original.taskStatus)}/>
			),
		},
		{
			accessorKey: "taskType",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Type"/>
			),
			cell: ({row}: any) => (
				<span className="font-medium">{<StatusBadge status={formatStatus(row.original.taskType)}/>}</span>
			),
		},
		{
			accessorKey: "startDate",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Start Date"/>
			),
			cell: ({row}: any) => {
				const date = row.getValue("startDate");
				return <span>{date ? new Date(date).toLocaleDateString() : <StatusBadge/>}</span>;
			},
		},
		{
			accessorKey: "endDate",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="End Date"/>
			),
			cell: ({row}: any) => {
				const date = row.getValue("endDate");
				return <span>{date ? new Date(date).toLocaleDateString() : <StatusBadge/>}</span>;
			},
		},
		{
			accessorKey: "updatedAt",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Updated"/>
			),
			cell: ({row}: any) => {
				const date = row.getValue("updatedAt");
				const locale = lang === "ar" ? ar : enUS;

				return (
					<span>
						{date
							? formatDistanceToNow(new Date(date), {
								addSuffix: true,
								locale,
							})
							: <StatusBadge/>
						}
					</span>);
			},
		},
		{
			id: "actions",
			cell: ({row}: any) => (
				<ActionButtons
					entity="task"
					data={row.original}
					onDelete={() => {
						handleDelete(row.original);
						removeTaskFromProject(row.original.taskId);
					}}
					confirmationText={row.original.taskName}
					viewPath={`/projects/${projectId}/tasks/${row.original.taskId}`}
					editPath={`/projects/${projectId}/tasks/edit/${row.original.taskId}`}
					extraActions={
						hasRole(user, ['admin', 'moderator', 'employee']) && (
							<Button variant="rounded" title={"Upload Images"} size="icon" onClick={() => handleUpload(row.original)}>
								<ImagePlus className="h-4 w-4"/>
							</Button>)
					}
				/>
			),
		}
	];

	const handleUpload = (item: any) => {
		router.push(`/projects/${projectId}/tasks/upload/${item.taskId}`);
	};


	const handleDelete = (item: any) => {
		deleteTask(item.taskId)
		removeTaskFromProject(item.taskId);
	};

	const customActions = (
		<>
			{user && hasRole(user, ["admin", "moderator"]) && (
				<Link href={`/projects/${projectId}/tasks/new`}>
					<Button size="sm" className="create-new lg:px-3 gap-2 py-1 px-2">
						<PlusCircleIcon className="h-4 w-4"/>
						<span className="md:block hidden">{t("Add New Task")}</span>
					</Button>
				</Link>
			)}
		</>
	);

	const facetedFilter = (table: any) => {
		const typeOptions = [
			{value: "foundations", label: "Foundations"},
			{value: "finishes", label: "Finishes"},
		];

		const statusOptions = [
			{value: "in_progress", label: "In Progress"},
			{value: "not_started", label: "Not Started"},
			{value: "needs_review", label: "Needs Review"},
			{value: "on_hold", label: "On Hold"},
			{value: "completed", label: "Completed"},
		];

		const validTypeDefault = typeOptions.find(opt => opt.value === typeParam)?.value;

		return (
			<div className="flex md:gap-2 gap-1">
				<DataTableFacetedFilter
					column={table.getColumn("taskType")}
					title="Type"
					options={typeOptions.map(option => ({
						...option,
						default: option.value === validTypeDefault
					}))}
				/>
				<DataTableFacetedFilter
					column={table.getColumn("taskStatus")}
					title="Status"
					options={statusOptions}
				/>
			</div>
		);
	};

	return (
		<div className="print:hidden">
			<Card className="md:bg-card rounded-none bg-transparent border-0 md:border">
				<CardHeader className="md:px-6 p-0">
					<CardTitle className="space-y-4">
						<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<span>{t("Tasks")}</span>
							<div className="flex flex-wrap items-center gap-3">
								<div className="inline-flex rounded-full border border-border/60 bg-muted/30 p-1">
									<Button
										type="button"
										size="sm"
										variant={viewMode === "table" ? "default" : "ghost"}
										className="rounded-full px-4"
										onClick={() => setViewMode("table")}
									>
										{t("Table")}
									</Button>
									<Button
										type="button"
										size="sm"
										variant={viewMode === "timeline" ? "default" : "ghost"}
										className="rounded-full px-4"
										onClick={() => setViewMode("timeline")}
									>
										{t("Timeline")}
									</Button>
								</div>
								{customActions}
							</div>
						</div>
					</CardTitle>
					<CardDescription>{t("Task information details table")}.</CardDescription>
				</CardHeader>
				<CardContent className="md:px-6 p-0">
					{viewMode === "timeline" ? (
						<TaskTimelineView
							projectId={projectId}
							tasks={sortedTasks}
							projectTeam={selectedProject?.employees ?? []}
						/>
					) : (
						<DataTable
							data={sortedTasks}
							columns={columns}
							globalFilter={true}
							loading={false}
							facetedFilter={facetedFilter}
							initialPageSize={tasks.length}
							// initialSorting={[{id: "taskStatus", desc: false}]}
							emptyTableMessage={t("There are no tasks at this stage")}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export default TasksPage;
