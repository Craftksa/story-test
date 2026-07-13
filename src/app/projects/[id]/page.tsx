'use client'

import React, { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProjectStore } from '@/store/projectStore'
import Spinner from '@/components/Spinner'
import ProjectDetailsCard, {type ProjectDetails} from "@/components/ProjectDetailsCard";
import {useTranslations} from "use-intl";
import { Button } from '@/components/ui/button'

const ViewProjectPage = () => {
	const { id } = useParams()
	const router = useRouter()
	const { fetchOneProject, selectedProject, loading, error, deleteProject} = useProjectStore()

	useEffect(() => {
			fetchOneProject(id)
	}, [id, fetchOneProject])
	const t = useTranslations();

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
				<Spinner className="h-6 w-6 text-muted-foreground" />
				<span className="mx-2 text-muted-foreground">{t("Loading your project")}...</span>
			</div>
		)
	}

	if (error || !selectedProject) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 text-center min-h-[calc(100vh-8rem)]">
				<p className="text-destructive font-medium">
					{t("Project not found or you don't have access")}
				</p>
				<Button onClick={() => router.push('/')}>
					{t("Return Home")}
				</Button>
			</div>
		)
	}

	return (
		<div className="flex justify-center">
			<ProjectDetailsCard project={selectedProject as unknown as ProjectDetails} deleteProject={deleteProject} />
		</div>
	)
}

export default ViewProjectPage
