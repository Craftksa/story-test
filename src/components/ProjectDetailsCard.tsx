import React from 'react';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {
	ActivityIcon,
	Building2,
	Clock,
	FileCog,
	MapPin,
	Palette,
	ReceiptText,
	UserRound,
	UsersRound
} from 'lucide-react';
import StatusBadge from "@/components/StatusBadgeSystem";
import {capitalizeWords, formatStatus, hasRole} from '@/lib/utils';
import {UserCard} from "@/components/UserCard";
import {Tabs, TabsContent, TabsList, TabsTrigger} from './ui/tabs';
import TasksPage from "@/components/TasksDetailsPage";
import {ActionButtons} from "@/components/ActionButtons";
import {useRouter} from "next/navigation";
import {ProjectProgress} from "@/components/ProjectProgress";
import {useSession} from "next-auth/react";
import {useTranslations} from "use-intl";
import {ProjectActivityFeed} from "@/components/ProjectActivityFeed";
import ClientActionButtons from "@/components/ClientActionButtons";
import ContractsPage, {type ContractListItem} from "@/components/ContractDetailsPage";
import type {TimelineSourceTask} from "@/components/tasks/task-timeline-utils";
import {ProjectDelayReport} from "@/components/ProjectDelayReport";

interface ProjectEmployee {
	id: string;
	name?: string | null;
	email?: string | null;
	role?: string | null;
	image?: string | null;
}

export interface ProjectDetails {
	id: string;
	name: string;
	description?: string | null;
	status: string;
	projectType: string;
	designer: string;
	client?: { name?: string | null } | null;
	city: string;
	district: string;
	startDate?: string | Date | null;
	endDate?: string | Date | null;
	employees: ProjectEmployee[];
	tasks: unknown[];
	contracts: unknown[];
}

const ProjectDetailsCard = ({project, deleteProject}: { project: ProjectDetails, deleteProject: (id: string) => void }) => {
	const router = useRouter();
	const {data: session} = useSession();
	const user = session?.user;

	const t = useTranslations();

	return (
		<div className="w-full">
			<Card className="rounded-none">
				<CardHeader className="pb-4">
					<div className="flex md:items-center pb-4 items-start justify-between md:flex-row flex-col gap-2 ">
						<div>
							<CardTitle className="text-2xl mb-2 font-semibold leading-none">
								{project.name}
							</CardTitle>
							<CardDescription className="">
								{project.description || `${t('Project overview and details')}`}
							</CardDescription>
						</div>
						<div className="flex md:items-end items-center md:flex-col flex-row justify-between md:w-auto w-full">
							<StatusBadge status={formatStatus(project.status)}/>
							<div>
								<ActionButtons
									view={false}
									entity="project"
									data={project}
									onDelete={() => {
										deleteProject(project.id)
										router.back()
									}}
									confirmationText={project.name}
								/>
							</div>
						</div>
					</div>
					<ProjectProgress project={project}/>

				</CardHeader>

				<CardContent className="space-y-6">
					<div className="space-y-4">
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
							<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
								<Building2 className="h-6 w-6 text-muted-foreground"/>
								<div>
									<p className="text-sm font-bold">{t('Project Type')}</p>
									<p className="text-sm text-muted-foreground">{capitalizeWords(t(project.projectType))}</p>
								</div>
							</div>
							<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
								<Palette className="h-6 w-6 text-muted-foreground"/>
								<div>
									<p className="text-sm font-bold">{t("Designer")}</p>
									<p className="text-sm text-muted-foreground">{capitalizeWords(project.designer)}</p>
								</div>
							</div>
							<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
								<UserRound className="h-6 w-6 text-muted-foreground"/>
								<div>
									<p className="text-sm font-bold">{t("Client")}</p>
									<p
										className="text-sm text-muted-foreground">{project.client?.name ? capitalizeWords(project.client.name) : `${t("No Client Assigned")}`}</p>
								</div>
							</div>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
								<MapPin className="h-6 w-6 text-muted-foreground"/>
								<div>
									<p className="text-sm font-bold">{t("Location")}</p>
									<p className="text-sm text-muted-foreground">{t(project.city)}, {t(project.district)}</p>
								</div>
							</div>
							<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
								<Clock className="h-6 w-6 text-muted-foreground"/>
								<div>
									<p className="text-sm font-bold">{t("Timeline")}</p>
									<p className="text-sm text-muted-foreground">
										{project.startDate && project.endDate
											? `${new Date(project.startDate).toLocaleDateString()} - ${new Date(project.endDate).toLocaleDateString()}`
											: `${t("Not scheduled")}`
										}
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* Team Members */}
					{!hasRole(user, ["client"]) && <div className="space-y-4">
              <h3 className=" font-semibold flex items-center">
                  <UsersRound className="h-4 w-4 mx-2"/>
								{t("Team")}
              </h3>
						{project.employees.length > 0 ? (
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
								{project.employees.map((emp) => (
									<UserCard key={emp.id} user={{...emp, name: emp.name ?? '', email: emp.email ?? '', role: emp.role ?? ''}}/>
								))}
							</div>
						) : (
							<p className="text-muted-foreground text-sm">{t("No employees assigned to this project")}.</p>
						)}
          </div>}


					{/*{project.description && (*/}
					{/*	<div className="space-y-2">*/}
					{/*		<h3 className=" font-semibold flex items-center">*/}
					{/*			<FileText className="h-4 w-4 mx-2"/>*/}
					{/*			Description*/}
					{/*		</h3>*/}
					{/*		<p className="text-muted-foreground text-sm leading-relaxed">{project.description}</p>*/}
					{/*	</div>*/}
					{/*)}*/}
					{hasRole(user, ["client"]) && (
						<div className="">
							<h3 className=" font-semibold flex my-4 items-center">
								<FileCog className="h-4 w-4 mx-2"/>
								{t("Actions")}
							</h3>
							<ClientActionButtons projectId={project.id}/>
						</div>)
					}
					<div className="">
						<h3 className=" font-semibold flex my-4 items-center">
							<ActivityIcon className="h-4 w-4 mx-2"/>
							{t("Latest Activities")}
						</h3>
						<ProjectActivityFeed projectId={project.id}/>
					</div>

					{hasRole(user, ["admin", "moderator"]) && (
						<div className="">
							<ProjectDelayReport projectId={project.id}/>
						</div>
					)}
					{hasRole(user, ["employee"]) && (
						<div className="">
							<h3 className=" font-semibold flex my-4 items-center">
								<ReceiptText className="h-4 w-4 mx-2"/>
								{t("Tasks")}
							</h3>
							<TasksPage tasks={project.tasks as TimelineSourceTask[]} projectId={project.id}/>
						</div>
					)}

					{!hasRole(user, ["client", "employee"]) && (<Tabs defaultValue="tasks" className="w-full">
						<TabsList className="w-full mb-4">
							<TabsTrigger value="tasks" className="font-bold">{t("Tasks")}</TabsTrigger>
							<TabsTrigger value="contracts" className="font-bold">{t("Contracts")}</TabsTrigger>
						</TabsList>
						<TabsContent value="tasks">
							<TasksPage tasks={project.tasks as TimelineSourceTask[]} projectId={project.id}/>
						</TabsContent>
						<TabsContent value="contracts">
							<ContractsPage contracts={project.contracts as ContractListItem[]} projectId={project.id} />
						</TabsContent>
					</Tabs>)}
				</CardContent>
			</Card>
		</div>
	);
};

export default ProjectDetailsCard;