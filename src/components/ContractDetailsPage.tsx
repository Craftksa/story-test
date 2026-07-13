'use client';

import React, { useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import {PlusCircleIcon, FileDownIcon, FileUp} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useContractStore } from '@/store/contractStore';
import { useProjectStore } from '@/store/projectStore';
import CustomLink from '@/components/CustomLink';
import { ActionButtons } from '@/components/ActionButtons';
import { useTranslations } from 'use-intl';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useCheckedLocale } from '@/lib/client-utils';
import {hasRole} from "@/lib/utils";
import StatusBadge from "@/components/StatusBadgeSystem";

export interface ContractListItem {
	id: string;
	contractorName: string;
	contractedAmount: string;
	fileUrl?: string | null;
	createdAt: string | Date;
}

export function ContractsPage({ contracts, projectId }: { contracts: ContractListItem[]; projectId: string }) {
	const { deleteContract, setProjectId } = useContractStore();
	const { removeContractFromProject } = useProjectStore();
	const t = useTranslations();
	const { lang } = useCheckedLocale();

	useEffect(() => {
		setProjectId(projectId);
	}, [projectId, setProjectId]);

	const { data: session } = useSession();
	const user = session?.user;
	const router = useRouter();

	const handleUpload = (data: ContractListItem) => {
		router.push(`/projects/${projectId}/contracts/upload/${data.id}`)
	}

	const columns: ColumnDef<ContractListItem>[] = [
		{
			accessorKey: 'contractorName',
			header: ({ column }) => <DataTableColumnHeader column={column} title={t('Contractor')} />,
			cell: ({ row }) => (
				<CustomLink href={`/projects/${projectId}/contracts/${row.original.id}`}>{row.getValue('contractorName') as string}</CustomLink>
			),
		},
		{
			accessorKey: 'contractedAmount',
			header: ({ column }) => <DataTableColumnHeader column={column} title={t('Amount')} />,
			cell: ({ row }) => {
				const amount = row.getValue('contractedAmount') as string;
				return <span>{amount ? `${parseFloat(amount).toLocaleString()}` : <StatusBadge />}</span>;
			},
		},
		{
			accessorKey: 'fileUrl',
			header: ({ column }) => <DataTableColumnHeader column={column} title={t('File')} />,
			cell: ({ row }) => {
				const url = row.getValue('fileUrl') as string | undefined;
				return url ? (
					<a href={url} target="_blank" rel="noopener noreferrer">
						<Button variant="ghost" size="icon" title={t('Download File')}>
							<FileDownIcon className="w-4 h-4" />
						</Button>
					</a>
				) : (
					<span>-</span>
				);
			},
		},
		{
			accessorKey: 'createdAt',
			header: ({ column }) => <DataTableColumnHeader column={column} title={t('Created')} />,
			cell: ({ row }) => {
				const date = row.getValue('createdAt') as string;
				const locale = lang === 'ar' ? ar : enUS;
				return <span>{date ? formatDistanceToNow(new Date(date), { addSuffix: true, locale }) : <StatusBadge />}</span>;
			},
		},
		{
			id: 'actions',
			cell: ({ row }) => (
				<ActionButtons
					entity="contract"
					data={row.original}
					onDelete={() => {
						deleteContract(row.original.id);
						removeContractFromProject(row.original.id);
					}}
					confirmationText={row.original.contractorName}
					viewPath={`/projects/${projectId}/contracts/${row.original.id}`}
					editPath={`/projects/${projectId}/contracts/edit/${row.original.id}`}
					extraActions={
						hasRole(user, ['admin', 'moderator']) && (
							<Button variant="rounded" title={"Upload Contract"} size="icon" onClick={() => handleUpload(row.original)}>
								<FileUp className="h-4 w-4"/>
							</Button>)
					}
				/>
			),
		},
	];
	const customActions = (
		<>
			{user && hasRole(user, ["admin", "moderator"]) && (
				<Link href={`/projects/${projectId}/contracts/new`}>
					<Button size="sm" className="create-new lg:px-3 gap-2 py-1 px-2">
						<PlusCircleIcon className="h-4 w-4" />
						<span className="md:block hidden">{t('Add New Contract')}</span>
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
							<span>{t('Contracts')}</span>
						</div>
					</CardTitle>
					<CardDescription>{t('List of all contracts for this project')}.</CardDescription>
				</CardHeader>
				<CardContent className="md:px-6 p-0">
					<DataTable
						data={contracts}
						columns={columns}
						globalFilter={true}
						customActions={customActions}
						loading={false}
						// initialSorting={[{ id: 'createdAt', desc: true }]}
						emptyTableMessage={t('There are no contracts yet')}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

export default ContractsPage;
