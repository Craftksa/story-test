'use client'
import React, {useEffect, useState} from "react";
import {ColumnDef} from "@tanstack/react-table";
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

interface UserListItem {
	id: string;
	name: string;
	username: string;
	email: string;
	role: string;
	createdAt: string | Date;
}

function UsersPage() {
	const {users, fetchUsers, loading, deleteUser} = useUserStore();

	const t = useTranslations();
	const router = useRouter();

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	const handleEdit = (item: UserListItem) => {
		router.push(`/users/edit/${item.id}`)
	};

	const [deleting, setDeleting] = useState(false)

	const handleDelete = (item: UserListItem) => {
		deleteUser(item.id)
	};

	const columns: ColumnDef<UserListItem>[] = [
		{
			accessorKey: "name",
			header: ({column}) => (
				<DataTableColumnHeader column={column} title="Name"/>
			),
			cell: ({row}) => (
				<span className="font-medium">{row.getValue("name") as string}</span>
			),
			enableSorting: true,
			enableHiding: false,
		},
		{
			accessorKey: "username",
			header: ({column}) => (
				<DataTableColumnHeader column={column} title="Username"/>
			),
			cell: ({row}) => (
				<span className="font-medium">{row.getValue("username") as string}</span>
			),
			enableSorting: true,
			enableHiding: false,
		},
		{
			accessorKey: "email",
			header: ({column}) => (
				<DataTableColumnHeader column={column} title="Email"/>
			),
			cell: ({row}) => (
				<span className="text-muted-foreground text-sm">{row.getValue("email") as string}</span>
			),
		},
		{
			accessorKey: "role",
			header: ({column}) => (
				<DataTableColumnHeader column={column} title="Role"/>
			),
			cell: ({row}) => (
				<span className="capitalize"><StatusBadge status={row.original.role} /></span>
			),
		},
		{
			accessorKey: "createdAt",
			header: ({column}) => (
				<DataTableColumnHeader column={column} title="Joined"/>
			),
			cell: ({row}) => new Date(row.getValue("createdAt") as string).toLocaleDateString(),
			enableSorting: true,
		},
		{
			id: "actions",
			cell: ({row}) => (
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
						data={users as unknown as UserListItem[]}
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