'use client'

import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import InstallmentForm from "@/components/forms/InstallmentForm";
import {useParams} from "next/navigation";
import {useTranslations} from "use-intl";


const NewInstallmentPage = () => {
	const {id: projectId, contractId} = useParams<{ id: string; contractId: string }>()

	const t = useTranslations();
	return (
		<div className="flex justify-center">
			<Card className="w-full rounded-none">
				<CardHeader>
					<CardTitle className="relative">
						{t("Create a New Installment")}
					</CardTitle>
					<CardDescription>
						{t("Add a new installment to your contracts")}.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<InstallmentForm projectId={projectId} contractId={contractId} />
				</CardContent>
			</Card>
		</div>
	)
}

export default NewInstallmentPage
