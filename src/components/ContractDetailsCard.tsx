'use client';

import React from 'react';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Calendar, FileDownIcon, FileText, FileUp, ReceiptText, SaudiRiyal, User2} from 'lucide-react';
import {useParams, useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {ActionButtons} from '@/components/ActionButtons';
import {useTranslations} from 'use-intl';
import InstallmentsPage from "@/components/InstallmentDetailsPage";
import Link from "next/link";
import {hasRole} from "@/lib/utils";

interface Contract {
	id: string;
	contractorName: string;
	contractedAmount: string;
	fileUrl?: string;
	createdAt: string;
	updatedAt: string;
	projectId: string;
}

interface ContractDetailsCardProps {
	contract: Contract;
	deleteContract: (id: string) => void;
	user: any;
}

const ContractDetailsCard: React.FC<ContractDetailsCardProps> = ({contract, deleteContract, user}) => {
	const {id: projectId} = useParams();
	const router = useRouter();
	const t = useTranslations();

	const formatDate = (date: string) => new Date(date).toLocaleDateString();

	const getInstallmentTotals = (installments: any
	) => {
		return installments.reduce(
			(acc, curr) => {
				acc.totalAmount += parseFloat(curr.installmentAmount || '0');
				acc.totalPaid += parseFloat(curr.paidAmount || '0');
				return acc;
			},
			{totalAmount: 0, totalPaid: 0}
		);
	};
	const {totalAmount, totalPaid} = getInstallmentTotals(contract.installments);

	return (
		<div className="w-full">
			<Card className="rounded-none">
				<CardHeader>
					<div className="flex md:items-center items-start justify-between md:flex-row flex-col gap-2">
						<div>
							<CardTitle className="text-2xl mb-2 font-semibold leading-none">
								{contract.contractorName}
							</CardTitle>
							<CardDescription>
								{t('Contract details and document')}
							</CardDescription>
						</div>
						<ActionButtons
							view={false}
							data={contract}
							onDelete={() => {
								deleteContract(contract.id);
								router.back();
							}}
							editPath={`/projects/${projectId}/contracts/edit/${contract.id}`}
							confirmationText={contract.contractorName}
							extraActions={
								<div className="flex gap-1">
									{!hasRole(user, ["client"]) && <Button title="Upload Contract" variant="rounded" size="icon" asChild>
                      <Link href={`/projects/${contract.projectId}/contracts/upload/${contract.id}`}>
                          <FileUp className="h-4 w-4"/>
                      </Link>
                  </Button>}
									{contract.fileUrl && (
										<Button title="Download Contract" variant="rounded" size="icon" asChild>
											<Link href={contract.fileUrl} target="_blank" rel="noopener noreferrer">
												<FileDownIcon className="h-4 w-4 "/>
											</Link>
										</Button>
									)}
								</div>}/>
					</div>
				</CardHeader>

				<CardContent className="space-y-6">
					<div className="grid md:grid-cols-2 gap-4">
						<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
							<User2 className="h-6 w-6 text-muted-foreground"/>
							<div>
								<p className="text-sm font-bold">{t("Contractor")}</p>
								<p className="text-sm text-muted-foreground">{contract.contractorName}</p>
							</div>
						</div>

						<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
							<FileText className="h-6 w-6 text-muted-foreground"/>
							<div>
								<p className="text-sm font-bold">{t("Amount")}</p>
								<p className="text-sm text-muted-foreground">
									SAR. {parseFloat(contract.contractedAmount).toLocaleString()}
								</p>
							</div>
						</div>

						<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
							<Calendar className="h-6 w-6 text-muted-foreground"/>
							<div>
								<p className="text-sm font-bold">{t("Created At")}</p>
								<p className="text-sm text-muted-foreground">{formatDate(contract.createdAt)}</p>
							</div>
						</div>

						<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
							<Calendar className="h-6 w-6 text-muted-foreground"/>
							<div>
								<p className="text-sm font-bold">{t("Last Updated")}</p>
								<p className="text-sm text-muted-foreground">{formatDate(contract.updatedAt)}</p>
							</div>
						</div>

						<div className="flex md:col-span-2 items-center space-x-3 p-3 bg-muted rounded-lg">
							<ReceiptText className="h-6 w-6 text-muted-foreground"/>
							<div>
								<p className="text-sm font-bold">{t("Description")}</p>
								<p className="text-sm text-muted-foreground">{contract.description}</p>
							</div>
						</div>

					</div>
					<div className="space-y-4">
						<InstallmentsPage contractId={contract.id} projectId={contract.projectId}/>
					</div>
					<div className="grid md:grid-cols-2 gap-4">
						<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
							<SaudiRiyal className="h-6 w-6 text-muted-foreground"/>
							<div>
								<p className="text-sm font-bold">{t("Total Installment")}</p>
								<p className="text-sm text-muted-foreground">
									{t("SAR")}. {totalAmount.toLocaleString()}
								</p>
							</div>
						</div>
						<div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
							<SaudiRiyal className="h-6 w-6 text-muted-foreground"/>
							<div>
								<p className="text-sm font-bold">{t("Total Paid")}</p>
								<p className="text-sm text-muted-foreground">
									{t("SAR")}. {totalPaid.toLocaleString()}
								</p>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default ContractDetailsCard;
