"use client"

import Link from "next/link"

import CraftLogo from "@/components/craft-logo"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

export function BrandDetails() {
	return (
		<SidebarMenu>
			<SidebarMenuItem className="pt-2">
				<SidebarMenuButton
					asChild
					size="lg"
					className="h-auto w-full justify-start rounded-xl px-2 py-3 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2"
				>
					<Link
						href="/"
						aria-label="Go to dashboard"
						className="flex w-full items-center justify-start group-data-[collapsible=icon]:justify-center"
					>
						<div className="flex h-16 w-full max-w-[196px] items-center justify-start [padding-inline-start:1.5rem] group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:max-w-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[padding-inline-start:0]">
							<CraftLogo className="h-full w-full" sizes="196px" />
						</div>
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
