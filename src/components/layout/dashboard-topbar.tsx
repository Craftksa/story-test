"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import {
	Bell,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CircleHelp,
	LogOut,
	Moon,
	Search,
	SquareUser,
	Sun,
} from "lucide-react";

import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ModeToggle } from "@/components/ModeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useCheckedLocale } from "@/lib/client-utils";
import { cn } from "@/lib/utils";
import { useTranslations } from "use-intl";

type DashboardNotificationType =
	| "report_submitted_for_approval"
	| "report_approved"
	| "report_rejected";

type DashboardNotification = {
	id: string;
	type: DashboardNotificationType;
	title: string;
	description: string;
	timeLabel: string;
	unread: boolean;
	href?: string;
};

const roleLabels: Record<string, string> = {
	admin: "مدير النظام",
	moderator: "مشرف",
	employee: "موظف",
	client: "عميل",
};

const getInitials = (name?: string | null) => {
	if (!name) return "CR";

	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "CR";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

	return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

const getHeaderContent = (pathname: string, tab: string | null) => {
	if (pathname === "/" && tab === "activity") {
		return {
			title: "لوحة التحكم",
			subtitle: "متابعة المشاريع والاعتمادات والإجراءات اليومية",
		};
	}

	if (pathname === "/" && tab === "tasks") {
		return {
			title: "المهام",
			subtitle: "متابعة حالة المهام والجداول التنفيذية اليومية",
		};
	}

	if (pathname === "/") {
		return {
			title: "مركز النشاط",
			subtitle: "نظرة عامة على المشاريع والفرق وسير العمل اليومي",
		};
	}

	if (pathname === "/projects") {
		return {
			title: "المشاريع",
			subtitle: "إدارة المشاريع ومتابعة بياناتها الأساسية",
		};
	}

	if (pathname.startsWith("/projects/") && pathname.includes("/tasks")) {
		return {
			title: "مهام المشروع",
			subtitle: "متابعة المهام التنفيذية والمالكين والحالة الحالية",
		};
	}

	if (pathname.startsWith("/projects/") && pathname.includes("/contracts")) {
		return {
			title: "عقود المشروع",
			subtitle: "مراجعة العقود والملفات والدفعات المرتبطة بالمشروع",
		};
	}

	if (pathname.startsWith("/projects/")) {
		return {
			title: "تفاصيل المشروع",
			subtitle: "عرض حالة المشروع ومكوناته التشغيلية",
		};
	}

	if (pathname === "/users" || pathname.startsWith("/users/")) {
		return {
			title: "المستخدمون",
			subtitle: "إدارة أعضاء المنصة والأدوار والوصول",
		};
	}

	if (pathname === "/profile") {
		return {
			title: "الملف الشخصي",
			subtitle: "مراجعة بيانات الحساب والإعدادات الشخصية",
		};
	}

	return {
		title: "Craft",
		subtitle: "مساحة العمل اليومية لإدارة المشاريع والتنفيذ",
	};
};

export default function DashboardTopBar() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
	const { dir } = useCheckedLocale();
	const { data: session } = useSession();
	const { resolvedTheme, setTheme } = useTheme();
	const t = useTranslations();
	const [mounted, setMounted] = React.useState(false);

	const activeTab = searchParams.get("tab");
	const { title, subtitle } = getHeaderContent(pathname, activeTab);
	const user = session?.user;
	const userRole = typeof user?.role === "string" ? user.role : "";
	const activeTheme = mounted ? resolvedTheme ?? "light" : "light";
	const isDark = activeTheme === "dark";

	// Placeholder foundation until a real notifications schema/read API exists.
	const notifications: DashboardNotification[] = [];
	const unreadCount = notifications.filter((notification) => notification.unread).length;

	React.useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<header className="app-shell-header fixed top-0 z-50 flex w-full shrink-0 border-b bg-background/85 backdrop-blur-xl md:relative">
			<div className="flex w-full flex-col gap-3 px-4 py-3">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
					<div
						className={cn(
							"flex min-w-0 flex-1 items-start gap-3",
							dir === "rtl" ? "lg:justify-start" : "lg:justify-start"
						)}
					>
						<Button
							type="button"
							onClick={() => router.back()}
							size="icon"
							variant="outline"
							className="mt-1 hidden size-9 shrink-0 rounded-xl border-border/70 bg-background/70 sm:inline-flex"
							aria-label={t("Back")}
						>
							{dir === "rtl" ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
						</Button>

						<div className="min-w-0 flex-1 space-y-1">
							<div className="space-y-1">
								<h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
									{title}
								</h1>
								<p className="hidden text-sm text-muted-foreground md:block">
									{subtitle}
								</p>
							</div>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2 lg:justify-end">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="relative size-10 rounded-xl border-border/70 bg-background/70"
									aria-label="الإشعارات"
								>
									<Bell className="size-4" />
									<span className="absolute -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#CA4E40] px-1 text-[10px] font-semibold text-white [inset-inline-end:-0.35rem]">
										{unreadCount}
									</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align={dir === "rtl" ? "start" : "end"}
								className="w-[22rem] rounded-2xl border-border/70 bg-popover/95 p-0 backdrop-blur-xl"
								sideOffset={10}
							>
								<div className="p-4">
									<DropdownMenuLabel className="px-0 py-0 text-base font-semibold">
										الإشعارات
									</DropdownMenuLabel>
									<p className="mt-1 text-xs text-muted-foreground">
										متابعة التنبيهات الداخلية الخاصة بالتقارير والإجراءات.
									</p>
								</div>
								<DropdownMenuSeparator className="mx-0" />
								<div className="max-h-80 overflow-y-auto p-2">
									{notifications.length > 0 ? (
										notifications.map((notification) => (
											<button
												key={notification.id}
												type="button"
												onClick={() => {
													if (notification.href) {
														router.push(notification.href);
													}
												}}
												className={cn(
													"flex w-full flex-col items-start gap-1 rounded-xl px-3 py-3 text-start transition-colors hover:bg-accent/60",
													notification.unread ? "bg-accent/35" : "bg-transparent"
												)}
											>
												<div className="flex w-full items-start justify-between gap-3">
													<span className="text-sm font-medium text-foreground">
														{notification.title}
													</span>
													<span className="shrink-0 text-[11px] text-muted-foreground">
														{notification.timeLabel}
													</span>
												</div>
												<p className="text-xs leading-6 text-muted-foreground">
													{notification.description}
												</p>
											</button>
										))
									) : (
										<div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
											لا توجد إشعارات جديدة
										</div>
									)}
								</div>
							</DropdownMenuContent>
						</DropdownMenu>

						<Popover>
							<PopoverTrigger asChild>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="size-10 rounded-xl border-border/70 bg-background/70"
									aria-label="المساعدة"
								>
									<CircleHelp className="size-4" />
								</Button>
							</PopoverTrigger>
							<PopoverContent
								align={dir === "rtl" ? "start" : "end"}
								className="w-72 rounded-2xl border-border/70 bg-popover/95 p-4 backdrop-blur-xl"
								sideOffset={10}
							>
								<p className="text-sm font-semibold text-foreground">المساعدة</p>
								<p className="mt-2 text-sm leading-6 text-muted-foreground">
									سيتوفر مركز مساعدة مخصص داخل التطبيق في مرحلة لاحقة.
								</p>
							</PopoverContent>
						</Popover>

						<div className="hidden md:block">
							<LocaleSwitcher />
						</div>
						<ModeToggle />

						<Separator orientation="vertical" className="hidden h-8 lg:block" />

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									className="h-auto rounded-2xl border border-border/70 bg-card/80 px-3 py-2 shadow-sm hover:bg-accent/50"
									aria-label="قائمة المستخدم"
								>
									<div className="flex items-center gap-3">
										<Avatar className="size-10 border border-border/60">
											<AvatarImage src={user?.image ?? ""} alt={user?.name ?? "User"} />
											<AvatarFallback className="bg-muted text-sm font-semibold text-foreground">
												{getInitials(user?.name)}
											</AvatarFallback>
										</Avatar>
										<div className="min-w-0 text-sm">
											<p className="truncate font-medium text-foreground">
												{user?.name || "مستخدم Craft"}
											</p>
											<p className="truncate text-xs text-muted-foreground">
												{roleLabels[userRole] || "عضو الفريق"}
											</p>
										</div>
										<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
									</div>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align={dir === "rtl" ? "start" : "end"}
								className="w-60 rounded-2xl border-border/70 bg-popover/95 p-1 backdrop-blur-xl"
								sideOffset={10}
							>
								<DropdownMenuLabel className="px-3 py-2 text-sm font-semibold">
									{user?.name || "مستخدم Craft"}
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => router.push("/profile")}
									className="cursor-pointer rounded-xl px-3 py-2"
								>
									<SquareUser className="size-4" />
									<span>الملف الشخصي</span>
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => setTheme(isDark ? "light" : "dark")}
									className="cursor-pointer rounded-xl px-3 py-2"
								>
									{isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
									<span>{isDark ? "الوضع الداكن" : "الوضع الفاتح"}</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => signOut()}
									className="cursor-pointer rounded-xl px-3 py-2"
									variant="destructive"
								>
									<LogOut className="size-4" />
									<span>تسجيل الخروج</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				<div className="relative">
					<Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground [inset-inline-start:0.875rem]" />
					<Input
						type="search"
						placeholder="البحث في المشاريع والتحديثات..."
						className="h-11 rounded-2xl border-border/70 bg-background/75 ps-11 shadow-sm"
					/>
				</div>
			</div>
		</header>
	);
}
