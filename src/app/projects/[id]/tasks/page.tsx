'use client'

import { useParams, useRouter } from "next/navigation"
import TasksDetailsPage from "@/components/TasksDetailsPage"
import { useTaskStore } from "@/store/taskStore"
import { useProjectStore } from "@/store/projectStore"
import Spinner from "@/components/Spinner"
import { useEffect, useState } from "react"
import {useTranslations} from "use-intl";

const TasksMainPage = () => {
	const router = useRouter()
	const { id: rawParamId } = useParams()

	const { tasks, fetchTasks, loading: tasksLoading, setProjectId } = useTaskStore()
	const { projects, fetchProjects, loading: projectsLoading } = useProjectStore()

	const [resolvingProjectId, setResolvingProjectId] = useState(false)

	// Properly check if paramId is valid (not undefined or literal "undefined")
	const paramId = typeof rawParamId === "string" && rawParamId !== "undefined" ? rawParamId : undefined

	useEffect(() => {
		if (!paramId) {
			setResolvingProjectId(true)
			fetchProjects().then(() => {
				if (projects.length > 0) {
					const defaultId = projects[0].id
					router.replace(`/projects/${defaultId}/tasks`)
				}
			}).finally(() => {
				setResolvingProjectId(false)
			})
		}
	}, [fetchProjects, paramId, projects, router])

	useEffect(() => {
		if (paramId) {
			setProjectId(paramId)
			fetchTasks()
		}
	}, [fetchTasks, paramId, setProjectId])

	const isLoading = tasksLoading || resolvingProjectId || (!paramId && projectsLoading)

	const t = useTranslations();
	if (isLoading) {
		return (
			<div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
				<Spinner className="h-6 w-6 text-muted-foreground" />
				<span className="mx-2 text-muted-foreground">{t("Loading tasks")}...</span>
			</div>
		)
	}

	return <TasksDetailsPage projectId={paramId!} tasks={tasks} />
}

export default TasksMainPage
