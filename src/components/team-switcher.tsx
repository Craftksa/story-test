"use client"

import * as React from "react"
import CraftLogo from "@/components/craft-logo"
import {SidebarMenu, SidebarMenuButton, SidebarMenuItem} from "@/components/ui/sidebar"
import {useRouter} from "next/navigation";

export function BrandDetails() {
	const router = useRouter();

	return (
		<SidebarMenu>
			<SidebarMenuItem className="pt-4">
				<SidebarMenuButton className="hover:bg-transparent  justify-center items-center active:bg-transparent" onClick={() => router.push('/')} size="lg">
					<div className="flex aspect-square size-24  items-center justify-center rounded-lg">
						<CraftLogo className="h-20 w-20" sizes="80px" />
					</div>
					{/*<div className="grid flex-1 text-left text-sm leading-tight">*/}
					{/*  <span className="truncate font-bold">CRAFT</span>*/}
					{/*  <span className="truncate text-xs">For Construction</span>*/}
					{/*</div>*/}
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
