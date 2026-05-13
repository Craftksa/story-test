"use client"

import * as React from "react"
import Image from "next/image"
import {SidebarMenu, SidebarMenuButton, SidebarMenuItem} from "@/components/ui/sidebar"
import {useRouter} from "next/navigation";

export function BrandDetails() {
	const router = useRouter();

	return (
		<SidebarMenu>
			<SidebarMenuItem className="pt-4">
				<SidebarMenuButton className="hover:bg-transparent  justify-center items-center active:bg-transparent" onClick={() => router.push('/')} size="lg">
					<div className="flex aspect-square size-24  items-center justify-center rounded-lg">
						<Image src="/Craft_Logo.svg" alt={"Craft_Logo"} width={100} height={100}/>
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
