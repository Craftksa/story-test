'use client'

import {useEffect} from 'react'
import {useParams} from 'next/navigation'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import ContractForm from '@/components/forms/ContractForm'
import {useContractStore} from '@/store/contractStore'
import Spinner from '@/components/Spinner'
import {useTranslations} from "use-intl";

const EditContractPage = () => {
	const {id: projectId, contractId} = useParams<{ id: string; contractId: string }>()
	const {fetchOneContract, selectedContract, loading, setProjectId} = useContractStore()
	const t = useTranslations();

	useEffect(() => {
		const fetchContract = () => {
			if (typeof contractId !== 'string') return
			setProjectId(projectId as string)
			fetchOneContract(contractId)
		}

		fetchContract()
	}, [projectId, contractId, setProjectId, fetchOneContract])

	if (loading) {
		return (
			<div className="flex justify-center items-center h-64">
				<Spinner/>
			</div>
		)
	}

	if (!selectedContract) {
		return (
			<div className="text-center mt-10 text-destructive font-medium">
				{t("Contract not found")}.
			</div>
		)
	}

	return (
		<div className="flex justify-center">
			<Card className="w-full rounded-none">
				<CardHeader>
					<CardTitle className="relative">
						{t("Update Contract")}
					</CardTitle>
					<CardDescription>
						{t("Update the contract details")}.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ContractForm projectId={projectId} contract={selectedContract}/>
				</CardContent>
			</Card>
		</div>
	)
}

export default EditContractPage
