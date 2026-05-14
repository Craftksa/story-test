'use client';

import {AppSidebar} from "@/components/app-sidebar"
import {Separator} from "@/components/ui/separator"
import {SidebarInset, SidebarProvider, SidebarTrigger,} from "@/components/ui/sidebar"
import {ModeToggle} from "@/components/ModeToggle";
import CustomBreadcrumb from "@/components/layout/CustomBreadCrumb";
import {usePathname, useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {ChevronLeft, ChevronRight} from "lucide-react";
import {LocaleSwitcher} from "@/components/LocaleSwitcher";
import {useCheckedLocale} from "@/lib/client-utils";
import {useTranslations} from "use-intl";
import MobileNavigation from "@/components/layout/mobile-navigations";

export default function AppLayout({children}: { children: React.ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const {dir} = useCheckedLocale();
	const t = useTranslations();

	return (
		<>
			{pathname === '/login' ? <div>{children}</div> : <div className="app-shell-theme min-w-0 max-w-full overflow-x-hidden"><SidebarProvider>
				<AppSidebar side={dir === 'rtl' ? 'right' : 'left'}/>
				<SidebarInset>
					<header
						className="app-shell-header fixed top-0 z-50 flex px-4 h-16 w-full shrink-0 items-center backdrop-blur-sm justify-between gap-2 transition-[width,height] ease-linear md:relative bg-background/30 border-b"
					>
						<div className="relative flex items-center gap-2 ">
							{/*<SidebarTrigger className="md:hidden flex -ml-1"/>*/}
							{/*<Separator*/}
							{/*	orientation="vertical"*/}
							{/*	className="data-[orientation=vertical]:h-4"*/}
							{/*/>*/}
							<Button onClick={() => router.back()} size="sm" variant="outline" className="flex gap-1 items-center">
								{dir === 'rtl' ? <ChevronRight className="size-4"/> : <ChevronLeft className="size-4"/>}
								<span className="md:block hidden">{t("Back")}</span>
							</Button>
							<Separator
								orientation="vertical"
								className="mx-1 data-[orientation=vertical]:h-4"
							/>
							<CustomBreadcrumb/>
						</div>
						<div className="flex gap-4 items-center justify-center">
							<div className="mt-1">
								<LocaleSwitcher/>
							</div>
							<ModeToggle/>
						</div>
					</header>
					<div className="app-shell-content flex min-w-0 max-w-full flex-col gap-4 overflow-x-hidden p-4 md:pt-0 pt-20">
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
