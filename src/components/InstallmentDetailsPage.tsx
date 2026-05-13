'use client';

import React, {useEffect} from 'react';
import {DataTable, DataTableColumnHeader} from '@/components/data-table';
import {Button} from '@/components/ui/button';
import {PlusCircleIcon} from 'lucide-react';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {useSession} from 'next-auth/react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useInstallmentStore} from '@/store/installmentStore';
import {useTranslations} from 'use-intl';
import {format} from 'date-fns';
import {ar, enUS} from 'date-fns/locale';
import {useCheckedLocale} from '@/lib/client-utils';
import {hasRole} from '@/lib/utils';
import StatusBadge from '@/components/StatusBadgeSystem';
import {ActionButtons} from '@/components/ActionButtons';

export function InstallmentsPage({ projectId, contractId }: { projectId: string; contractId: string }) {
	const {
		setProjectId,
		setContractId,
		fetchInstallments,
		deleteInstallment,
		installments,
		loading,
	} = useInstallmentStore();

	const t = useTranslations();
	const { lang } = useCheckedLocale();
	const locale = lang === 'ar' ? ar : enUS;

	const { data: session } = useSession();
	const user = session?.user;
	const router = useRouter();

	useEffect(() => {
		setProjectId(projectId);
		setContractId(contractId);
		fetchInstallments();
	}, [projectId, contractId]);

	const sortedInstallments = [...installments].sort((a, b) =>
		new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
	);

	const getInstallmentStatus = (installmentAmount: string, paidAmount: string) => {
		const amount = parseFloat(installmentAmount);
		const paid = parseFloat(paidAmount);

		if (paid === 0) return 'Unpaid';
		if (paid < amount) return 'Partial Paid';
		return 'Paid';
	};

	const columns = [
		{
			accessorKey: 'installmentNo',
			header: ({ column }: any) => <DataTableColumnHeader column={column} title={t('Installment No')} />,
			cell: ({ row }: any) => <span>#{parseFloat(row.getValue('installmentNo'))}</span>,
		},
		{
			accessorKey: 'status',
			header: ({ column }: any) => <DataTableColumnHeader column={column} title={t('Status')} />,
			cell: ({ row }: any) => {
				const installment = row.original;
				const status = getInstallmentStatus(installment.installmentAmount, installment.paidAmount);
				const color = status === 'Paid' ? 'Completed' : status === 'Partial Paid' ? 'moderator' : 'On Hold';
				return <span className={`${color}`}><StatusBadge status={status} color={color} /></span>;
			},
		},
		{
			accessorKey: 'installmentAmount',
			header: ({ column }: any) => <DataTableColumnHeader column={column} title={t('Installment Amount')} />,
			cell: ({ row }: any) => <span>{parseFloat(row.getValue('installmentAmount')).toLocaleString()}</span>,
		},
		{
			accessorKey: 'paidAmount',
			header: ({ column }: any) => <DataTableColumnHeader column={column} title={t('Paid Amount')} />,
			cell: ({ row }: any) => <span>{parseFloat(row.getValue('paidAmount')).toLocaleString()}</span>,
		},
		{
			accessorKey: 'paymentDate',
			header: ({ column }: any) => <DataTableColumnHeader column={column} title={t('Payment Date')} />,
			cell: ({ row }: any) => {
				const date = row.getValue('paymentDate');
				return date ? format(new Date(date), 'PP', { locale }) : <StatusBadge />;
			},
		},
		{
			accessorKey: 'notes',
			header: ({ column }: any) => <DataTableColumnHeader column={column} title={t('Notes')} />,
			cell: ({ row }: any) => <span>{row.getValue('notes') || <StatusBadge />} </span>,
		},
		{
			id: 'actions',
			cell: ({ row }: any) => (
				<ActionButtons
					entity="installment"
					data={row.original}
					onDelete={() => deleteInstallment(row.original.id)}
					view={false}
					confirmationText={t('Installment') + ` #${row.original.installmentNo}`}
					// viewPath={`/projects/${projectId}/contracts/${contractId}/installment/${row.original.id}`}
					editPath={`/projects/${projectId}/contracts/${contractId}/installment/edit/${row.original.id}`}
				/>
			),
		},
	];

	const customActions = (
		<>
			{user && hasRole(user, ['admin']) && (
				<Link href={`/projects/${projectId}/contracts/${contractId}/installment/new`}>
					<Button size="sm" className="create-new lg:px-3 gap-2 py-1 px-2">
						<PlusCircleIcon className="h-4 w-4" />
						<span className="md:block hidden">{t('Add New Installment')}</span>
					</Button>
				</Link>
			)}
		</>
	);

	return (
		<div className="print:hidden">
			<Card className="md:bg-card rounded-none bg-transparent border-0 md:border">
				<CardHeader className="md:px-6 p-0">
					<CardTitle>
						<div className="flex justify-between items-center">
							<span>{t('Installments')}</span>
						</div>
					</CardTitle>
					<CardDescription>{t('List of all installments under this contract')}</CardDescription>
				</CardHeader>
				<CardContent className="md:px-6 p-0">
					<DataTable
						data={sortedInstallments}
						columns={columns}
						globalFilter={true}
						customActions={customActions}
						loading={loading}
						emptyTableMessage={t('There are no installments yet')}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

export default InstallmentsPage;
