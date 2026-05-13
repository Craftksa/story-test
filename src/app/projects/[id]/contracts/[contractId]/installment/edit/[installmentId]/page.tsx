'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import InstallmentForm from '@/components/forms/InstallmentForm';
import { useInstallmentStore } from '@/store/installmentStore';
import Spinner from '@/components/Spinner';
import { useTranslations } from 'use-intl';

const EditInstallmentPage = () => {
	const {
		id: projectId,
		contractId,
		installmentId,
	} = useParams();

	const t = useTranslations();
	const {
		setProjectId,
		setContractId,
		fetchOneInstallment,
		selectedInstallment,
		loading,
	} = useInstallmentStore();

	useEffect(() => {
		const fetchInstallment = () => {
			if (typeof installmentId !== 'string') return;

			setProjectId(projectId as string);
			setContractId(contractId as string);
			fetchOneInstallment(installmentId);
		};

		fetchInstallment();
	}, [projectId, contractId, installmentId]);

	if (loading) {
		return (
			<div className="flex justify-center items-center h-64">
				<Spinner />
			</div>
		);
	}

	if (!selectedInstallment) {
		return (
			<div className="text-center mt-10 text-destructive font-medium">
				{t('Installment not found')}.
			</div>
		);
	}

	return (
		<div className="flex justify-center">
			<Card className="w-full rounded-none">
				<CardHeader>
					<CardTitle>{t('Update Installment')}</CardTitle>
					<CardDescription>
						{t('Update the installment details')}.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<InstallmentForm
						projectId={projectId as string}
						contractId={contractId as string}
						installment={selectedInstallment}
					/>
				</CardContent>
			</Card>
		</div>
	);
};

export default EditInstallmentPage;
