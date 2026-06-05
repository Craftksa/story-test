"use client"

import * as React from "react"
import {
  ActivityIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderOpenDotIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SettingsIcon,
  SquareUserIcon,
  UsersIcon,
} from "lucide-react"

import {NavMain} from "@/components/nav-main"
import {NavUser} from "@/components/nav-user"
import {SidebarThemeToggle} from "@/components/sidebar-theme-toggle"
import {BrandDetails} from "@/components/team-switcher"
import {Sidebar, SidebarContent, SidebarFooter, SidebarHeader,} from "@/components/ui/sidebar"
import {ScrollArea} from "@/components/ui/scroll-area";
import {NavSecondary} from "@/components/nav-secondary";
import {signOut, useSession} from "next-auth/react";
import {useParams} from "next/navigation";
import {useCheckedLocale} from "@/lib/client-utils";
import {useTranslations} from "use-intl";

export const getNavigationData = (
  role: "admin" | "moderator" | "employee" | "client"
) => {
  const { id: projectId } = useParams();
  const t = useTranslations();

  return {
    navMain: [
      {
        title: t("Dashboard"),
        url: "/",
        icon: LayoutDashboardIcon,
        isActive: true,
      },

      ...(["admin", "moderator", "employee"].includes(role)
        ? [
          {
            title: t("Projects"),
            url: "/projects",
            icon: FolderOpenDotIcon,
          },
          {
            title: t("activityCenterTitle"),
            url: "/?tab=activity",
            icon: ActivityIcon,
          },
          {
            title: t("Tasks"),
            url: "/?tab=tasks",
            icon: ClipboardListIcon,
          },
        ]
        : []),

      ...(role === "admin"
        ? [
          {
            title: t("Users"),
            url: "/users",
            icon: UsersIcon,
          },
        ]
        : []),

      ...(role === "client"
        ? [
          {
            title: t("Tasks"),
            url: `/projects/${projectId}/tasks`,
            icon: ClipboardListIcon,
          },
          {
            title: t("Contracts"),
            url: `/projects/${projectId}/contracts`,
            icon: FileTextIcon,
          },
        ]
        : []),

      {
        title: t("Profile"),
        url: "/profile",
        icon: SquareUserIcon,
      },
      ...(["admin", "moderator", "employee"].includes(role)
        ? [
          {
            title: t("Settings"),
            url: "/profile",
            icon: SettingsIcon,
          },
        ]
        : []),
    ],
    navSecondary: [
      {
        title: t("Logout"),
        onClick: () => signOut(),
        icon: LogOutIcon,
      },
    ],
  };
};
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const {data: session} = useSession();
  // @ts-ignore
  const data = getNavigationData(session?.user?.role ?? "client");

  const {dir} = useCheckedLocale();
  return (
    <Sidebar collapsible="icon" {...props} >
      <SidebarHeader>
        <BrandDetails />
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea dir={dir}>
          <NavMain items={data.navMain} />
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        <NavSecondary items={data.navSecondary} className="mt-auto p-0" />
        <SidebarThemeToggle />
        <NavUser />
      </SidebarFooter>
      {/*<SidebarRail />*/}
    </Sidebar>
  )
}
