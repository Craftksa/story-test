'use client';

import React, {useEffect} from 'react';
import {useParams} from "next/navigation";
import TaskDetailsCard from "@/components/TaskDetailsCard";
import {useTaskStore} from "@/store/taskStore";
import Spinner from "@/components/Spinner";
import {useSession} from "next-auth/react";
import {useTranslations} from "use-intl";

const Page = () => {
	const {id: projectId, taskId} = useParams();
	const {selectedTask, fetchOneTask, setProjectId, loading, deleteTask} = useTaskStore();
	const { data: session } = useSession();
	const user = session?.user;

	useEffect(() => {
		setProjectId(projectId as string)
		fetchOneTask(taskId as string)
	}, [projectId, taskId, setProjectId, fetchOneTask])

	const t = useTranslations();

	if (!selectedTask || loading) {
		return (
			<div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
				<Spinner className="h-6 w-6 text-muted-foreground" />
				<span className="mx-2 text-muted-foreground">{t("Loading task")}...</span>
			</div>
		)
	}

	return (
		<div>
			<TaskDetailsCard task={selectedTask} deleteTask={deleteTask} user={user} />
		</div>
	);
};

export default Page;