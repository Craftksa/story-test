'use client'

import {useEffect} from 'react'
import {useParams} from 'next/navigation'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import TaskForm from '@/components/forms/TaskForm'
import {useTaskStore} from '@/store/taskStore'
import Spinner from '@/components/Spinner'
import {useTranslations} from "use-intl";

const EditTaskPage = () => {
	const {id: projectId, taskId} = useParams<{ id: string; taskId: string }>()
	const {fetchOneTask, selectedTask, loading, setProjectId} = useTaskStore()
	const t = useTranslations();

	useEffect(() => {
		const fetchTask = () => {
			if (typeof taskId !== 'string') return
			setProjectId(projectId as string)
			fetchOneTask(taskId)
		}

		fetchTask()
	}, [projectId, taskId, setProjectId, fetchOneTask])

	if (loading) {
		return (
			<div className="flex justify-center items-center h-64">
				<Spinner/>
			</div>
		)
	}

	if (!selectedTask) {
		return (
			<div className="text-center mt-10 text-destructive font-medium">
				{t("Task not found")}.
			</div>
		)
	}

	return (
		<div className="flex justify-center">
			<Card className="w-full rounded-none">
				<CardHeader>
					<CardTitle className="relative">
						{t("Update Task")}
					</CardTitle>
					<CardDescription>
						{t("Update the task details")}.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<TaskForm projectId={projectId} task={selectedTask}/>
				</CardContent>
			</Card>
		</div>
	)
}

export default EditTaskPage
