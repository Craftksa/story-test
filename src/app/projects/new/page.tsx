'use client'

import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import ProjectForm from "@/components/forms/ProjectForm";
import {useTranslations} from "use-intl";


const NewProjectPage = () => {
	const t= useTranslations();
	return (
		<div className="flex justify-center">
			<Card className="w-full rounded-none">
				<CardHeader>
					<CardTitle className="relative">
						{t("Create a New Project")}
					</CardTitle>
					<CardDescription>
						{t("Add a new project to your system")}.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ProjectForm />
				</CardContent>
			</Card>
		</div>
	)
}

export default NewProjectPage
