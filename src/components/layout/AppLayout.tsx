'use client';

import {AppSidebar} from "@/components/app-sidebar"
import DashboardTopBar from "@/components/layout/dashboard-topbar";
import {SidebarInset, SidebarProvider} from "@/components/ui/sidebar"
import {usePathname} from "next/navigation";
import {useCheckedLocale} from "@/lib/client-utils";
import MobileNavigation from "@/components/layout/mobile-navigations";

export default function AppLayout({children}: { children: React.ReactNode }) {
	const pathname = usePathname();
	const {dir} = useCheckedLocale();

	return (
		<>
			{pathname === '/login' ? <div>{children}</div> : <div className="app-shell-theme min-w-0 max-w-full overflow-x-hidden"><SidebarProvider>
				<AppSidebar side={dir === 'rtl' ? 'right' : 'left'}/>
				<SidebarInset>
					<DashboardTopBar />
					<div className="app-shell-content flex min-w-0 max-w-full flex-col gap-4 overflow-x-hidden p-4 pt-32 md:pt-0">
						{children}
						<div className="mt-16">
						<MobileNavigation />
						</div>
					</div>
				</SidebarInset>
			</SidebarProvider></div>}
		</>
	)
}
