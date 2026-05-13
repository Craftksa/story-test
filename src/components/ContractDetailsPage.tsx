'use client';

import React, { useEffect, useState } from 'react';
import { DataTable, DataTableColumnHeader } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import {EyeIcon, EditIcon, Loader2Icon, PlusCircleIcon, FileDownIcon, ImagePlus, FileUp} from 'lucide-react';
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

export function ContractsPage({ contracts, projectId }: { contracts: any[]; projectId: string }) {
	const { deleteContract, setProjectId } = useContractStore();
	const { fetchOneProject, removeContractFromProject } = useProjectStore();
	const t = useTranslations();
	const { lang } = useCheckedLocale();

	useEffect(() => {
		setProjectId(projectId);
	}, [projectId]);

	const { data: session } = useSession();
	const user = session?.user;
	const router = useRouter();

	const columns = [
		{
			accessorKey: 'contractorName',
			header: ({ column }: any) => <DataTableColumnHeader column={column} title={t('Contractor')} />,
			cell: ({ row }: any) => (
				<CustomLink href={`/projects/${projectId}/contracts/${row.original.id}`}>{row.getValue('contractorName')}</CustomLink>
			),
		},
		{
			accessorKey: 'contractedAmount',
			header: ({ column }: any) => <DataTableColumnHeader column={column} title={t('Amount')} />,
			cell: ({ row }: any) => {
				const amount = row.getValue('contractedAmount');
				return <span>{amount ? `${parseFloat(amount).toLocaleString()}` : <StatusBadge />}</span>;
			},
		},
		{
			accessorKey: 'fileUrl',
			header: ({ column }: any) => <DataTableColumnHeader column={column} title={t('File')} />,
			cell: ({ row }: any) => {
				const url = row.getValue('fileUrl');
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
			header: ({ column }: any) => <DataTableColumnHeader column={column} title={t('Created')} />,
			cell: ({ row }: any) => {
				const date = row.getValue('createdAt');
				const locale = lang === 'ar' ? ar : enUS;
				return <span>{date ? formatDistanceToNow(new Date(date), { addSuffix: true, locale }) : <StatusBadge />}</span>;
			},
		},
		{
			id: 'actions',
			cell: ({ row }: any) => (
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


	const handleUpload = (data: any) => {
		router.push(`/projects/${projectId}/contracts/upload/${data.id}`)
	}
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
