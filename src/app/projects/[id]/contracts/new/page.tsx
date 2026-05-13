'use client'

import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import ContractForm from "@/components/forms/ContractForm";
import {useParams} from "next/navigation";
import {useTranslations} from "use-intl";


const NewContractPage = () => {
	const {id: projectId} = useParams()

	const t = useTranslations();
	return (
		<div className="flex justify-center">
			<Card className="w-full rounded-none">
				<CardHeader>
					<CardTitle className="relative">
						{t("Create a New Contract")}
					</CardTitle>
					<CardDescription>
						{t("Add a new contract to your project")}.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ContractForm projectId={projectId} />
				</CardContent>
			</Card>
		</div>
	)
}

export default NewContractPage
