'use client'

import { useParams, useRouter } from "next/navigation"
import { useContractStore } from "@/store/contractStore"
import { useProjectStore } from "@/store/projectStore"
import Spinner from "@/components/Spinner"
import CustomLink from "@/components/CustomLink"
import React, { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {useTranslations} from "use-intl";
import ContractDetailsPage from "@/components/ContractDetailsPage";

const ContractsMainPage = () => {
	const router = useRouter()
	const { id: rawParamId } = useParams()
	const { data: session } = useSession()

	const { contracts, fetchContracts, loading: contractsLoading, setProjectId } = useContractStore()
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
					router.replace(`/projects/${defaultId}/contracts`)
				}
			}).finally(() => {
				setResolvingProjectId(false)
			})
		}
	}, [paramId])

	useEffect(() => {
		if (paramId) {
			setProjectId(paramId)
			fetchContracts()
		}
	}, [paramId])

	const isLoading = contractsLoading || resolvingProjectId || (!paramId && projectsLoading)

	const t = useTranslations();
	if (isLoading) {
		return (
			<div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
				<Spinner className="h-6 w-6 text-muted-foreground" />
				<span className="mx-2 text-muted-foreground">{t("Loading contracts")}...</span>
			</div>
		)
	}

	if (!contractsLoading && contracts.length === 0) {
		return (
			<div className="flex flex-col space-y-2 justify-center items-center min-h-[calc(100vh-8rem)]">
				<h2 className="text-xl font-semibold">{t("You have no contracts yet")}</h2>
				<p className="text-muted-foreground">
					{t("Please contact")} <CustomLink href={"https://www.craftksa.com/contact"}>{t("craft")}</CustomLink> {t("team to get started")}.
				</p>
			</div>
		)
	}

	return <ContractDetailsPage projectId={paramId!} contracts={contracts} />
}

export default ContractsMainPage
