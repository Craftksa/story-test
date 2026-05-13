'use client'

import React, {useEffect, useState} from "react";
import {DataTable, DataTableColumnHeader, DataTableFacetedFilter} from "@/components/data-table";
import {Button} from "@/components/ui/button";
import {EditIcon, EyeIcon, ImagePlus, Loader2Icon, PlusCircleIcon} from "lucide-react";
import Link from "next/link";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {useRouter, useSearchParams} from "next/navigation";
import {useSession} from "next-auth/react";
import {formatStatus, hasRole} from "@/lib/utils";
import StatusBadge from "@/components/StatusBadgeSystem";
import DeleteDialog from "@/components/DeleteDialog";
import {useTaskStore} from "@/store/taskStore";
import {useProjectStore} from "@/store/projectStore";
import CustomLink from "@/components/CustomLink";
import {ActionButtons} from "@/components/ActionButtons";
import {useTranslations} from "use-intl";
import {formatDistanceToNow} from "date-fns";
import {ar, enUS} from "date-fns/locale";
import {useCheckedLocale} from "@/lib/client-utils";


export function TasksPage({tasks, projectId}: { tasks: any[], projectId: string }) {
	const [selectedTask, setSelectedTask] = useState(null);
	const {deleteTask, setProjectId} = useTaskStore();
	const {fetchOneProject, selectedProject, removeTaskFromProject} = useProjectStore();
	const searchParams = useSearchParams();
	const typeParam = searchParams.get("type");
	const t = useTranslations();
	const {lang} = useCheckedLocale();

	function sortTasksByCreatedAtAsc(tasks: any[]) {
		return tasks.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
	}

	function sortTasksByEffectiveDate(tasks: any[]) {
		return tasks.slice().sort((a, b) => {
			const aDate = a.startDate ? new Date(a.startDate) : new Date(a.createdAt);
			const bDate = b.startDate ? new Date(b.startDate) : new Date(b.createdAt);

			return aDate.getTime() - bDate.getTime();
		});
	}

	const sortedTasks = sortTasksByEffectiveDate(tasks);

	const taskStatusOrder = [
		"in_progress",
		"not_started",
		"needs_review",
		"on_hold",
		"completed"
	];

	function customStatusSort(rowA: any, rowB: any, columnId: string) {
		const valueA = rowA.getValue(columnId);
		const valueB = rowB.getValue(columnId);

		const indexA = taskStatusOrder.indexOf(valueA);
		const indexB = taskStatusOrder.indexOf(valueB);

		return indexA - indexB;
	}


	useEffect(() => {
		setProjectId(projectId);
	}, [projectId]);

	const {data: session} = useSession();
	const user = session?.user;
	const router = useRouter();
	const [deleting, setDeleting] = useState(false)

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
			// sortingFn: customStatusSort,
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

	const handleEdit = (item: any) => {
		router.push(`/projects/${projectId}/tasks/edit/${item.taskId}`);
	};

	const handleView = (item: any) => {
		router.push(`/projects/${projectId}/tasks/${item.taskId}`);
	};

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
					<CardTitle>
						<div className="flex justify-between items-center">
							<span>{t("Tasks")}</span>
						</div>
					</CardTitle>
					<CardDescription>{t("Task information details table")}.</CardDescription>
				</CardHeader>
				<CardContent className="md:px-6 p-0">
					<DataTable
						data={sortedTasks}
						columns={columns}
						globalFilter={true}
						customActions={customActions}
						loading={false}
						facetedFilter={facetedFilter}
						initialPageSize={tasks.length}
						// initialSorting={[{id: "taskStatus", desc: false}]}
						emptyTableMessage={t("There are no tasks at this stage")}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

export default TasksPage;
