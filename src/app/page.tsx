import ProjectsPage from "@/app/projects/page";
import {hasRole} from "@/lib/utils";
import {auth} from "@/auth";
import AdminDashboard from "@/components/AdminDashboard";

export default async function Home() {
	const session = await auth();
	const user = session?.user

	return (
		<div className="flex gap-4 flex-col">
			{user && hasRole(user, ['admin', 'moderator']) && <div className="">
					<AdminDashboard />

      </div>}
			<div className="">
				<ProjectsPage/>
			</div>
		</div>
	);
}
