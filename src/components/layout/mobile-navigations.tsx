'use client';

import React from 'react';
import {motion} from 'framer-motion';
import {
	FolderOpenDotIcon,
	Home,
	Plus,
	SettingsIcon,
	Users2Icon,
	User,
} from 'lucide-react';
import Link from "next/link";
import {useParams, usePathname} from "next/navigation";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {useSidebar} from "@/components/ui/sidebar";
import {useSession} from "next-auth/react";
import {hasRole} from "@/lib/utils";
import {useTranslations} from "use-intl";

const MobileNavigation = () => {
	const pathname = usePathname();
	const {toggleSidebar} = useSidebar();
	const {data: session} = useSession();
	const user = session?.user;
	const {id: projectId} = useParams();
	const t = useTranslations();

	const clientNavItems = [
		{icon: Home, label: 'Home', href: '/'},
		{icon: FolderOpenDotIcon, label: 'Tasks', href: `/projects/${projectId}/tasks`},
		{icon: Users2Icon, label: 'Contracts', href: `/projects/${projectId}/contracts`},
		{icon: SettingsIcon, label: 'Profile', href: '/profile'}
	];

	const baseNavItems = [
		{icon: Home, label: 'Home', href: '/'},
		{icon: FolderOpenDotIcon, label: 'Projects', href: '/projects'},
		{icon: Users2Icon, label: 'Users', href: '/users'},
		{icon: SettingsIcon, label: 'Profile', href: '/profile'}
	];

	const actionItems = [
		{icon: FolderOpenDotIcon, label: 'Add New Project', href: '/projects/new'},
		{icon: User, label: 'Add New User', href: '/users/new'},
	];

	let navItems = [];
	let showActions = true;

	if (hasRole(user, ['admin'])) {
		navItems = baseNavItems;
		showActions = true;
	} else if (hasRole(user, ['moderator'])) {
		navItems = baseNavItems.filter(item => item.label !== 'Users');
		showActions = true;
	} else if (hasRole(user, ['employee'])) {
		navItems = baseNavItems.filter(item => item.label === 'Home' || item.label === 'Projects' || item.label === 'Profile');
		showActions = false;
	} else if (hasRole(user, ['client'])) {
		navItems = clientNavItems;
		showActions = false;
	}

	const midPoint = Math.floor(navItems.length / 2);

	return (
		<nav className="block sm:hidden print:hidden fixed bottom-0 z-50 left-0 right-0 bg-background border-t pb-safe">
			<motion.div
				className="max-w-lg mx-auto py-2"
				initial={{y: 100}}
				animate={{y: 0}}
				transition={{type: "spring", stiffness: 300, damping: 30}}
			>
				<div className="flex justify-around items-end px-4">
					{navItems.map((item) => {
						const isActive = pathname === item.href;
						return (
							<Link href={item.href} key={item.label} className="flex-1">
								<motion.div
									className="flex flex-col items-center hover:text-foreground text-muted-foreground"
									whileTap={{scale: 0.9}}
									whileHover={{y: -2}}
								>
									<div className={`p-2 rounded-full ${isActive ? "bg-primary/10" : ""}`}>
										<item.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`}/>
									</div>
									<span className={`text-xs font-medium ${isActive ? "text-primary" : ""}`}>
				            {t(item.label)}
				          </span>
								</motion.div>
							</Link>
						);
					})}

					{/*{showActions && (*/}
					{/*	<Popover>*/}
					{/*		<PopoverTrigger asChild>*/}
					{/*			<motion.button*/}
					{/*				className="relative -mb-6"*/}
					{/*				whileTap={{ scale: 0.95 }}*/}
					{/*				whileHover={{ scale: 1.05 }}*/}
					{/*			>*/}
					{/*				<div className="relative">*/}
					{/*					<div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-30" />*/}
					{/*					<div className="relative h-14 w-14 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center shadow-lg">*/}
					{/*						<Plus className="w-7 h-7 text-white" />*/}
					{/*					</div>*/}
					{/*				</div>*/}
					{/*			</motion.button>*/}
					{/*		</PopoverTrigger>*/}
					{/*		<PopoverContent className="w-52 p-2" align="center" side="top">*/}
					{/*			<div className="grid gap-2">*/}
					{/*				{actionItems.map((item) => (*/}
					{/*					<Link*/}
					{/*						href={item.href}*/}
					{/*						key={item.label}*/}
					{/*						className="flex items-center space-x-2 hover:bg-muted rounded-lg p-1 transition-colors"*/}
					{/*					>*/}
					{/*						<div className="bg-primary/10 p-2 rounded-full">*/}
					{/*							<item.icon className="w-4 h-4 text-primary" />*/}
					{/*						</div>*/}
					{/*						<span className="text-sm tracking-tight font-medium">{item.label}</span>*/}
					{/*					</Link>*/}
					{/*				))}*/}
					{/*			</div>*/}
					{/*		</PopoverContent>*/}
					{/*	</Popover>*/}
					{/*)}*/}
				</div>

			</motion.div>
		</nav>
	);
};

export default MobileNavigation;
