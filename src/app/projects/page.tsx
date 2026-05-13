'use client'
import React, {useEffect, useState} from "react";
import {DataTable, DataTableColumnHeader} from "@/components/data-table";
import {Button} from "@/components/ui/button";
import {Loader2, PlusCircleIcon} from "lucide-react";
import Link from "next/link";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {useRouter} from "next/navigation";
import {useProjectStore} from "@/store/projectStore";
import {hasRole} from "@/lib/utils";
import {useSession} from "next-auth/react";
import StatusBadge from "@/components/StatusBadgeSystem";
import CustomLink from "@/components/CustomLink";
import {ActionButtons} from "@/components/ActionButtons";
import Spinner from "@/components/Spinner";
import {useTranslations} from "use-intl";
import { ProjectVisibilityFilter } from "@/components/project-visibility-filter";
import { filterProjectsByVisibility, ProjectVisibilityScope } from "@/lib/project-visibility";

export function ProjectsPage() {
	const {projects, fetchProjects, loading, error, deleteProject} = useProjectStore();
	const [selectedProject, setSelectedProject] = useState(null);
	const [projectVisibilityScope, setProjectVisibilityScope] = useState<ProjectVisibilityScope>("all");

	const {data: session, status} = useSession();
	const user = session?.user;

	const router = useRouter();
	const [checkingClientRedirect, setCheckingClientRedirect] = useState(true);

	useEffect(() => {
		if (status === "loading") return;

		if (!session) {
			router.push("/login");
		} else {
			fetchProjects();
		}
	}, [session, status]);



	useEffect(() => {
		if (status === "loading" || loading) return;

		if (user && hasRole(user, ["client"])) {
			if (projects.length > 0) {
				router.push(`/projects/${projects[0].id}`);
			} else {
				setCheckingClientRedirect(false);
			}
		} else {
			setCheckingClientRedirect(false);
		}
	}, [status, loading, user, projects, router]);

	const columns = [
		{
			accessorKey: "name",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Name"/>
			),
			cell: ({row}: any) => (
				<span className="font-medium"><CustomLink href={`/projects/${row.original.id}`}>{row.getValue("name")}</CustomLink></span>
			),
			enableSorting: true,
			enableHiding: false,
		},
		{
			accessorKey: "projectType",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Project Type"/>
			),
			cell: ({row}: any) => (
				<span className="font-medium">{<StatusBadge status={row.original.projectType}/>}</span>
			),
		},
		{
			accessorKey: "city",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="City"/>
			),
			cell: ({row}: any) => (
				<span className="font-medium">{row.getValue("city")} - {row.original.district}</span>
			),
		},
		{
			accessorKey: "client.name",
			header: ({ column }: any) => (
				<DataTableColumnHeader column={column} title="Client Name" />
			),
			cell: ({ row }: any) => {
				const client = row.original.client;
				return <span className="font-medium">{client?.name ?? <StatusBadge />}</span>;
			},
		},
		{
			accessorKey: "designer",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Designer Name"/>
			),
			cell: ({row}: any) => (
				<span className="font-medium">{row.getValue("designer")}</span>
			),
		},
		{
			accessorKey: "startDate",
			header: ({column}: any) => (
				<DataTableColumnHeader column={column} title="Started On"/>
			),
			cell: ({row}: any) => <div>{row.original.startDate ? new Date(row.getValue("startDate")).toLocaleDateString() : <StatusBadge />}</div>,
		},
		{
			id: "actions",
			cell: ({ row }: any) => (
				<ActionButtons
					entity="project"
					data={row.original}
					onDelete={() => handleDelete(row.original)}
					confirmationText={row.original.name}
				/>
			),
		}
,
	];


	const handleEdit = (item: any) => {
		router.push(`/projects/edit/${item.id}`)
	};
	const handleView = (item: any) => {
		router.push(`/projects/${item.id}`)
	};


	const [deleting, setDeleting] = useState(false)

	const handleDelete = (item: any) => {
		deleteProject(item.id)
	};

	const handleCopyId = (id: string) => {
		navigator.clipboard.writeText(id.toString());
	};

	const handlePrint = (item: any) => {
		setSelectedProject(item);
		setTimeout(() => {
			window.print();
		}, 100);
	}

	const t = useTranslations();
	const showProjectVisibilityFilter = !!user && !hasRole(user, ["client"]);
	const visibleProjects = filterProjectsByVisibility(projects, user, projectVisibilityScope);

	const customActions = (
		<>
			{user && hasRole(user, ['admin', 'moderator']) && <Link href="/projects/new">
          <Button size="sm" className="create-new lg:px-3 gap-2 py-1 px-2 ">
	            <PlusCircleIcon className="h-4 w-4"/>
	            <span className="md:block hidden">
              {t('Add New Project')}
          </span>
          </Button>
      </Link>}
		</>
	);

	const projectVisibilityFilter = showProjectVisibilityFilter ? (
		<ProjectVisibilityFilter
			value={projectVisibilityScope}
			onValueChange={setProjectVisibilityScope}
		/>
	) : null;

	// 🔄 Loading state or redirecting
	if ((loading || status === "loading" || checkingClientRedirect) && hasRole(user, ["client"])) {
		return (
			<div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
				<Spinner className="h-6 w-6 text-muted-foreground" />
				<span className="mx-2 text-muted-foreground">{t("Loading your project")}...</span>
			</div>
		);
	}

	// 🟡 No projects for client
	if (!loading && hasRole(user, ["client"]) && projects.length === 0) {
		return (
			<div className="flex flex-col space-y-2 justify-center items-center min-h-[calc(100vh-8rem)]">
				<h2 className="text-xl font-semibold">{t("You have no projects yet")}</h2>
				<p className="text-muted-foreground">{t("Please contact")} <CustomLink href={"https://www.craftksa.com/contact"}>{t("craft")}</CustomLink> {t("team to get started")}.</p>
			</div>
		);
	}

	return (
		<div className="print:hidden">
			{user && !hasRole(user, ['client']) && <Card className="md:bg-card rounded-none bg-transparent border-0 md:border ">
          <CardHeader className="md:px-6 p-0 ">
            <CardTitle>
              <div className="flex justify-between items-center">
                <span>{t("Projects")}</span>
              </div>
            </CardTitle>
              <CardDescription>{t("Projects information details table")}.</CardDescription>
          </CardHeader>
          <CardContent className="md:px-6 p-0 ">
            <DataTable
              data={visibleProjects}
              columns={columns}
              globalFilter={true}
              customActions={customActions}
              customRange={projectVisibilityFilter}
              loading={loading}
              emptyTableMessage={
								projectVisibilityScope === "mine"
									? "No projects assigned to you yet"
									: "No results"
							}
            />
          </CardContent>
      </Card>}
		</div>
	)
}

export default ProjectsPage;
