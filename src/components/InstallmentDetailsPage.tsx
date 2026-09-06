'use client';

import React, {useEffect} from 'react';
import {ColumnDef} from '@tanstack/react-table';
import {DataTable, DataTableColumnHeader} from '@/components/data-table';
import {Button} from '@/components/ui/button';
import {PlusCircleIcon} from 'lucide-react';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {useSession} from 'next-auth/react';
import Link from 'next/link';
import {useInstallmentStore} from '@/store/installmentStore';
import {useTranslations} from 'use-intl';
import {format} from 'date-fns';
import {ar, enUS} from 'date-fns/locale';
import {useCheckedLocale} from '@/lib/client-utils';
import {hasRole} from '@/lib/utils';
import StatusBadge from '@/components/StatusBadgeSystem';
import {ActionButtons} from '@/components/ActionButtons';
import PaymentProofUploader from '@/components/PaymentProofUploader';
import {toast} from 'sonner';
import api from '@/lib/api';
import {FileText} from 'lucide-react';

interface InstallmentListItem {
	id: string;
	installmentNo: number;
	installmentAmount: string;
	paidAmount: string;
	paymentDate: string | Date | null;
	notes: string | null;
	createdAt: string;
	hasPaymentProof?: boolean;
}

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
	// Payment proofs: admin / moderator / employee only (never client). The
	// backend enforces the same rule (see @/lib/payment-proof-access).
	const canUsePaymentProof = hasRole(user, ['admin', 'moderator', 'employee']);

	const viewPaymentProof = async (installmentId: string) => {
		try {
			const data = await api.get(
				`projects/${projectId}/contracts/${contractId}/installments/${installmentId}/payment-proof`
			);
			if (data?.url) {
				window.open(data.url, '_blank', 'noopener,noreferrer');
			} else {
				toast.error(t('No payment proof found'));
			}
		} catch {
			toast.error(t('Failed to open payment proof'));
		}
	};

	useEffect(() => {
		setProjectId(projectId);
		setContractId(contractId);
		fetchInstallments();
	}, [projectId, contractId, setProjectId, setContractId, fetchInstallments]);

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

	const columns: ColumnDef<InstallmentListItem>[] = [
		{
			accessorKey: 'installmentNo',
			header: ({ column }) => <DataTableColumnHeader column={column} title={t('Installment No')} />,
			cell: ({ row }) => <span>#{row.getValue('installmentNo') as number}</span>,
		},
		{
			accessorKey: 'status',
			header: ({ column }) => <DataTableColumnHeader column={column} title={t('Status')} />,
			cell: ({ row }) => {
				const installment = row.original;
				const status = getInstallmentStatus(installment.installmentAmount, installment.paidAmount);
				const color = status === 'Paid' ? 'Completed' : status === 'Partial Paid' ? 'moderator' : 'On Hold';
				return <span className={`${color}`}><StatusBadge status={status} color={color} /></span>;
			},
		},
		{
			accessorKey: 'installmentAmount',
			header: ({ column }) => <DataTableColumnHeader column={column} title={t('Installment Amount')} />,
			cell: ({ row }) => <span>{parseFloat(row.getValue('installmentAmount') as string).toLocaleString()}</span>,
		},
		{
			accessorKey: 'paidAmount',
			header: ({ column }) => <DataTableColumnHeader column={column} title={t('Paid Amount')} />,
			cell: ({ row }) => <span>{parseFloat(row.getValue('paidAmount') as string).toLocaleString()}</span>,
		},
		{
			accessorKey: 'paymentDate',
			header: ({ column }) => <DataTableColumnHeader column={column} title={t('Payment Date')} />,
			cell: ({ row }) => {
				const date = row.getValue('paymentDate') as string | null;
				return date ? format(new Date(date), 'PP', { locale }) : <StatusBadge />;
			},
		},
		{
			accessorKey: 'notes',
			header: ({ column }) => <DataTableColumnHeader column={column} title={t('Notes')} />,
			cell: ({ row }) => <span>{(row.getValue('notes') as string | null) || <StatusBadge />} </span>,
		},
		{
			id: 'paymentProof',
			header: () => <span>{t('Payment Proof')}</span>,
			cell: ({ row }) => {
				const installment = row.original;
				// Payment proofs are employee-only end to end; this column is filtered
				// out for everyone else (see `visibleColumns`).
				return (
					<div className="flex items-center gap-2">
						{installment.hasPaymentProof && (
							<Button
								size="sm"
								variant="outline"
								className="flex text-xs items-center gap-2"
								onClick={() => viewPaymentProof(installment.id)}
							>
								<FileText className="w-4 h-4" />
								{t('View')}
							</Button>
						)}
						<PaymentProofUploader
							installmentId={installment.id}
							hasExisting={!!installment.hasPaymentProof}
							onUploaded={fetchInstallments}
						/>
					</div>
				);
			},
		},
		{
			id: 'actions',
			cell: ({ row }) => (
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

	const visibleColumns = canUsePaymentProof
		? columns
		: columns.filter((column) => column.id !== 'paymentProof');

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
						columns={visibleColumns}
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
