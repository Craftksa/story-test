'use client'

import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import TaskForm from "@/components/forms/TaskForm";
import {useParams} from "next/navigation";
import {useTranslations} from "use-intl";


const NewTaskPage = () => {
	const {id: projectId} = useParams<{ id: string }>()

	const t = useTranslations();
	return (
		<div className="flex justify-center">
			<Card className="w-full rounded-none">
				<CardHeader>
					<CardTitle className="relative">
						{t("Create a New Task")}
					</CardTitle>
					<CardDescription>
						{t("Add a new task to your project")}.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<TaskForm projectId={projectId} />
				</CardContent>
			</Card>
		</div>
	)
}

export default NewTaskPage
