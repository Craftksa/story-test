'use client'

import React, { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useProjectStore } from '@/store/projectStore'
import Spinner from '@/components/Spinner'
import ProjectDetailsCard, {type ProjectDetails} from "@/components/ProjectDetailsCard";
import {useTranslations} from "use-intl";

const ViewProjectPage = () => {
	const { id } = useParams()
	const { fetchOneProject, selectedProject, loading, deleteProject} = useProjectStore()

	useEffect(() => {
			fetchOneProject(id)
	}, [id, fetchOneProject])
	const t = useTranslations();

	if (!selectedProject || loading) {
		return (
			<div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
				<Spinner className="h-6 w-6 text-muted-foreground" />
				<span className="mx-2 text-muted-foreground">{t("Loading your project")}...</span>
			</div>
		)
	}

	// if (!selectedProject) {
	// 	return (
	// 		<div className="text-center mt-10 text-destructive font-medium">
	// 			Project not found.
	// 		</div>
	// 	)
	// }

	return (
		<div className="flex justify-center">
			<ProjectDetailsCard project={selectedProject as unknown as ProjectDetails} deleteProject={deleteProject} />
		</div>
	)
}

export default ViewProjectPage
