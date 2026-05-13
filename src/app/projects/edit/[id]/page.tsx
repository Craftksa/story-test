'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import ProjectForm, {ProjectFormData} from '@/components/forms/ProjectForm'
import { useProjectStore } from '@/store/projectStore'
import Spinner from '@/components/Spinner'
import {useTranslations} from "use-intl";

const EditProjectPage = () => {
	const { id } = useParams()
	const { fetchOneProject, selectedProject, loading} = useProjectStore()
	const t = useTranslations();

	useEffect(() => {
		const fetchProject = () => {
			if (typeof id !== 'string') return
			fetchOneProject(id)
		}

		fetchProject()
	}, [])

	if (loading) {
		return (
			<div className="flex justify-center items-center h-64">
				<Spinner />
			</div>
		)
	}

	if (!selectedProject) {
		return (
			<div className="text-center mt-10 text-destructive font-medium">
				{t("Project not found")}.
			</div>
		)
	}

	return (
		<div className="flex justify-center">
			<Card className="w-full rounded-none">
				<CardHeader>
					<CardTitle className="relative">
						{t("Update Project")}
					</CardTitle>
					<CardDescription>
						{t("Update the project details")}.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ProjectForm project={selectedProject} />
				</CardContent>
			</Card>
		</div>
	)
}

export default EditProjectPage
