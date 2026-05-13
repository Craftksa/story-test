import * as React from "react"
import { type LucideIcon } from "lucide-react"
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar"
import Link from "next/link"
import {Button} from "@/components/ui/button";

type NavItem =
	| {
	title: string
	icon: LucideIcon
	onClick: () => void
	url?: undefined
}
	| {
	title: string
	icon: LucideIcon
	url: string
	onClick?: undefined
}

export function NavSecondary({
	                             items,
	                             ...props
                             }: {
	items: NavItem[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
	return (
		<SidebarGroup {...props}>
			<SidebarGroupContent>
				<SidebarMenu>
					{items.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton className='text-[15px] size-8 w-full' asChild tooltip={item.title}>
								{item.onClick ? (
									<Button variant="simple" onClick={item.onClick} className="flex text-primary justify-start items-center w-full gap-2">
										<item.icon />
										<span>{item.title}</span>
									</Button>
								) : (
									<Link href={item.url!} className="flex items-center w-full gap-2">
										<item.icon />
										<span>{item.title}</span>
									</Link>
								)}
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	)
}
