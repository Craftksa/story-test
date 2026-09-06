'use client'

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {useSession} from "next-auth/react";
import {useTranslations} from "use-intl";
import {hasRole} from "@/lib/utils";
import {useProjectStore} from "@/store/projectStore";
import AdminDashboard from "@/components/AdminDashboard";
import Spinner from "@/components/Spinner";
import CustomLink from "@/components/CustomLink";

export default function Home() {
	const {data: session, status} = useSession();
	const user = session?.user;
	const router = useRouter();
	const t = useTranslations();

	const {projects, fetchProjects, loading} = useProjectStore();
	const [checkingClientRedirect, setCheckingClientRedirect] = useState(true);

	useEffect(() => {
		if (status === "loading") return;
		if (user && hasRole(user, ["client"])) {
			fetchProjects();
		}
	}, [status, user, fetchProjects]);

	useEffect(() => {
		if (status === "loading" || loading) return;
		if (user && hasRole(user, ["client"])) {
			if (projects.length === 1) router.push(`/projects/${projects[0].id}`);
			else if (projects.length > 1) router.push("/projects");
			else setCheckingClientRedirect(false);
		} else setCheckingClientRedirect(false);
	}, [status, loading, user, projects, router]);

	if (user && hasRole(user, ["client"]) && (loading || status === "loading" || checkingClientRedirect)) {
		return (
			<div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
				<Spinner className="h-6 w-6 text-muted-foreground" />
				<span className="mx-2 text-muted-foreground">{t("Loading your project")}...</span>
			</div>
		);
	}

	if (user && hasRole(user, ["client"]) && !loading && projects.length === 0) {
		return (
			<div className="flex flex-col space-y-2 justify-center items-center min-h-[calc(100vh-8rem)]">
				<h2 className="text-xl font-semibold">{t("You have no projects yet")}</h2>
				<p className="text-muted-foreground">
					{t("Please contact")} <CustomLink href={"https://www.craftksa.com/contact"}>{t("craft")}</CustomLink> {t("team to get started")}.
				</p>
			</div>
		);
	}

	return (
		<div className="flex gap-4 flex-col">
			{user && hasRole(user, ['admin', 'moderator']) && <div className="">
					<AdminDashboard />

      </div>}
		</div>
	);
}
