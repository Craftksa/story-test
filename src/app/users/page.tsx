'use client'
import React, {useEffect, useState} from "react";
import {DataTable, DataTableColumnHeader} from "@/components/data-table";
import {Button} from "@/components/ui/button";
import {EditIcon, PlusCircleIcon} from "lucide-react";
import Link from "next/link";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {useRouter} from "next/navigation";
import {useUserStore} from "@/store/userStore";
import DeleteDialog from "@/components/DeleteDialog";
import StatusBadge from "@/components/StatusBadgeSystem";
import {useTranslations} from "use-intl";


export function UsersPage() {
	const {users, fetchUsers, loading, error, deleteUser} = useUserStore();
	const [selectedUser, setSelectedUser] = useState(null);

	const t = useTranslations();
	const router = useRouter();

	useEffect(() => {
		fetchUsers();
	}, []);

	const columns = [
		{
			accessorKey: "name",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Name"/>
			),
			cell: ({row}: any) => (
				<span className="font-medium">{row.getValue("name")}</span>
			),
			enableSorting: true,
			enableHiding: false,
		},
		{
			accessorKey: "username",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Username"/>
			),
			cell: ({row}: any) => (
				<span className="font-medium">{row.getValue("username")}</span>
			),
			enableSorting: true,
			enableHiding: false,
		},
		{
			accessorKey: "email",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Email"/>
			),
			cell: ({row}: any) => (
				<span className="text-muted-foreground text-sm">{row.getValue("email")}</span>
			),
		},
		{
			accessorKey: "role",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Role"/>
			),
			cell: ({row}: any) => (
				<span className="capitalize"><StatusBadge status={row.original.role} /></span>
			),
		},
		{
			accessorKey: "createdAt",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Joined"/>
			),
			cell: ({row}: any) => new Date(row.getValue("createdAt")).toLocaleDateString(),
			enableSorting: true,
		},
		{
			id: "actions",
			cell: ({row}: any) => (
				<div className="actions-column">
					<div className="flex -ml-2 gap-1 justify-center items-center">
						<Button variant="rounded" size="icon" onClick={() => handleEdit(row.original)}>
							<EditIcon className="h-4 w-4"/>
						</Button>
						<DeleteDialog
							confirmationText={row.original.name}
							isDeleting={deleting}
							className="px-2 gap-2 text-destructive w-8 h-8 rounded-full hover:bg-muted my-1"
							onCancel={() => setDeleting(false)}
							onConfirm={() => handleDelete(row.original)}
						/>
					</div>
				</div>
			),
		},
	];


	const handleEdit = (item: any) => {
		router.push(`/users/edit/${item.id}`)
	};

	const [deleting, setDeleting] = useState(false)

	const handleDelete = (item: any) => {
		deleteUser(item.id)
	};

	const handleCopyId = (id: string) => {
		navigator.clipboard.writeText(id.toString());
	};

	const handlePrint = (item: any) => {
		setSelectedUser(item);
		setTimeout(() => {
			window.print();
		}, 100);
	}

	const customActions = (
		<>
			<Link href="/users/new">
				<Button size="sm" className="create-new lg:px-3 gap-2 py-1 px-2 ">
					<PlusCircleIcon className="h-4 w-4"/>
					<span className="md:block hidden">
            {t("Add New User")}
          </span>
				</Button>
			</Link>
		</>
	);


	return (
		<div className="print:hidden">
			<Card className="md:bg-card rounded-none bg-transparent border-0 md:border ">
				<CardHeader className="md:px-6 p-0 ">
					<CardTitle>
						<div className="flex justify-between items-center">
							<span>{t("Users")}</span>
						</div>
					</CardTitle>
					<CardDescription>{t("Users information details table")}.</CardDescription>
				</CardHeader>
				<CardContent className="md:px-6 p-0 ">
					<DataTable
						data={users}
						columns={columns}
						globalFilter={true}
						customActions={customActions}
						loading={loading}
					/>
				</CardContent>
			</Card>
		</div>
	)
}

export default UsersPage;