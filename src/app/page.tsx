import ProjectsPage from "@/app/projects/page";
import {hasRole} from "@/lib/utils";
import {auth} from "@/auth";
import AdminDashboard from "@/components/AdminDashboard";
import { USE_DEV_AUTH_FALLBACK } from "@/lib/auth-config";

export default async function Home() {
	const session = await auth();
	const user = session?.user
	const showEmployeeDashboard = USE_DEV_AUTH_FALLBACK && user && hasRole(user, ['employee']);

	return (
		<div className="flex gap-4 flex-col">
			{user && (hasRole(user, ['admin', 'moderator']) || showEmployeeDashboard) && <div className="">
					<AdminDashboard />

      </div>}
			<div className="">
				<ProjectsPage/>
			</div>
		</div>
	);
}
