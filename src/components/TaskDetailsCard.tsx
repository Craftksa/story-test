import React from 'react';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Calendar, CalendarDays, Clock, ImagePlus, Images, StickyNote, Wrench} from 'lucide-react';
import StatusBadge from "@/components/StatusBadgeSystem";
import {capitalizeWords, formatStatus, hasRole} from '@/lib/utils';
import {TaskGallery} from "@/components/TaskGallery";
import {ActionButtons} from "@/components/ActionButtons";
import {useParams, useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {useTranslations} from "use-intl";

interface TaskImage {
	id: string;
	url: string;
	description?: string | null;
	uploadedAt: string;
}

export interface Task {
	id: string;
	name: string;
	status: string;
	type: string;
	startDate: string | null;
	endDate: string | null;
	notes?: string | null;
	projectId: string;
	createdAt: string;
	updatedAt: string;
	images: TaskImage[];
}

interface TaskDetailsCardProps {
	task: Task;
	deleteTask: (id: string) => void;
	user: { role?: string | null } | null | undefined;
}

const TaskDetailsCard: React.FC<TaskDetailsCardProps> = ({ task, deleteTask, user}) => {
	const t = useTranslations();
	const {id: projectId } = useParams();
	const formatDate = (dateString: string | null) => {
		if (!dateString) return t('Not set');
		return new Date(dateString).toLocaleDateString();
	};

	const getTaskTypeIcon = (taskType: string) => {
		switch (taskType.toLowerCase()) {
			case 'foundations':
				return <Wrench className="h-6 w-6 text-muted-foreground" />;
			default:
				return <Wrench className="h-6 w-6 text-muted-foreground" />;
		}
	};

	const router = useRouter()
	return (
		<div className="w-full">
			<Card className="rounded-none">
				<CardHeader className="">
					<div className="flex md:items-center items-start justify-between md:flex-row flex-col gap-2 ">
						<div>
							<CardTitle className="text-2xl mb-2 font-semibold leading-none">
								{task.name}
							</CardTitle>
							<CardDescription className="">
								{t("Task details and progress")}
							</CardDescription>
						</div>
						<div className="flex md:items-end items-center md:flex-col flex-row justify-between md:w-auto w-full">
							<StatusBadge status={formatStatus(task.status)} />
							<div>
								<ActionButtons
									view={false}
									data={task}
									onDelete={() => {
										deleteTask(task.id)
										router.back()
									}}
									editPath={`/projects/${projectId}/tasks/edit/${task.id}`}
									confirmationText={task.name}
									extraActions={
										hasRole(user, ['admin', 'moderator','employee']) && (
											<Button variant="rounded" title={"Upload Images"} size="icon" onClick={() => router.push(`/projects/${projectId}/tasks/upload/${task.id}`)}>
												<ImagePlus className="h-4 w-4" />
											</Button>
										)
									}
								/>
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="space-y-4">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
								{getTaskTypeIcon(task.type)}
								<div>
									<p className="text-sm font-bold">{t("Task Type")}</p>
									<p className="text-sm text-muted-foreground">
										{capitalizeWords(t(task.type))}
									</p>
								</div>
							</div>
							<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
								<Calendar className="h-6 w-6 text-muted-foreground" />
								<div>
									<p className="text-sm font-bold">{t("Task ID")}</p>
									<p className="text-sm text-muted-foreground font-mono">
										{task.id}
									</p>
								</div>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
								<CalendarDays className="h-6 w-6 text-muted-foreground" />
								<div>
									<p className="text-sm font-bold">{t("Start Date")}</p>
									<p className="text-sm text-muted-foreground">
										{formatDate(task.startDate)}
									</p>
								</div>
							</div>
							<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
								<Clock className="h-6 w-6 text-muted-foreground" />
								<div>
									<p className="text-sm font-bold">{t('End Date')}</p>
									<p className="text-sm text-muted-foreground">
										{formatDate(task.endDate)}
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* Notes Section */}
					{task.notes && (
						<div className="space-y-2">
							<h3 className="font-semibold flex items-center">
								<StickyNote className="h-4 w-4 mx-2" />
								{t("Notes")}
							</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								{task.notes}
							</p>
						</div>
					)}

					{/* Task Gallery */}
					<div className="space-y-4">
						<h3 className="font-semibold flex items-center">
							<Images className="h-4 w-4 mx-2" />
							{t("Gallery")}
						</h3>
						<TaskGallery task={task} images={task.images} />
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default TaskDetailsCard;