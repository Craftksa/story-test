'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import ProjectForm, {ProjectFormData} from '@/components/forms/ProjectForm'
import { useProjectStore } from '@/store/projectStore'
import Spinner from '@/components/Spinner'
import ProjectDetailsCard from "@/components/ProjectDetailsCard";
import {Loader2} from "lucide-react";
import {useTranslations} from "use-intl";

const ViewProjectPage = () => {
	const { id } = useParams()
	const { fetchOneProject, selectedProject, loading, deleteProject} = useProjectStore()

	useEffect(() => {
			fetchOneProject(id)
	}, [id])
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
			<ProjectDetailsCard project={selectedProject} deleteProject={deleteProject} />
		</div>
	)
}

export default ViewProjectPage
