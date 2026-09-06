"use client"

import * as React from "react"
import {
  ClipboardListIcon,
  FileTextIcon,
  FilesIcon,
  FolderOpenDotIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  SquareUserIcon,
  UsersIcon,
} from "lucide-react"

import {NavMain} from "@/components/nav-main"
import {NavUser} from "@/components/nav-user"
import {BrandDetails} from "@/components/team-switcher"
import {Sidebar, SidebarContent, SidebarFooter, SidebarHeader,} from "@/components/ui/sidebar"
import {ScrollArea} from "@/components/ui/scroll-area";
import {useSession} from "next-auth/react";
import {useParams, usePathname, useRouter, useSearchParams} from "next/navigation";
import {useCheckedLocale} from "@/lib/client-utils";
import {useTranslations} from "use-intl";
import {useProjectStore} from "@/store/projectStore";

export const useNavigationData = (
  role: "admin" | "moderator" | "employee" | "client",
  {
    projectId,
    clientProjectId,
    pathname,
    currentTab,
  }: {
    projectId?: string | string[];
    clientProjectId?: string;
    pathname: string;
    currentTab: string | null;
  }
) => {
  const t = useTranslations();
  const normalizedProjectId =
    typeof projectId === "string" ? projectId : Array.isArray(projectId) ? projectId[0] : undefined;
  const clientProjectsHref = (suffix: string) => (clientProjectId ? `/projects/${clientProjectId}/${suffix}` : "/projects");
  const isRootPath = pathname === "/";
  const isProjectsPath = pathname === "/projects" || pathname.startsWith("/projects/");
  const isUsersPath = pathname === "/users" || pathname.startsWith("/users/");
  const isProfilePath = pathname === "/profile";
  const isClientTasksPath = !!normalizedProjectId && pathname.startsWith(`/projects/${normalizedProjectId}/tasks`);
  const isClientContractsPath =
    !!normalizedProjectId && pathname.startsWith(`/projects/${normalizedProjectId}/contracts`);

  return {
    navMain: [
      {
        title: t("Dashboard"),
        url: "/",
        icon: LayoutDashboardIcon,
        isActive: isRootPath && !currentTab,
      },

      {
        title: "التقارير والمراسلات",
        url: "/correspondence",
        icon: FilesIcon,
        isActive: pathname === "/correspondence" || pathname.startsWith("/correspondence/"),
      },

      ...(["admin", "moderator", "employee"].includes(role)
        ? [
          {
            title: t("Projects"),
            url: "/projects",
            icon: FolderOpenDotIcon,
            isActive: isProjectsPath,
          },
          {
            title: t("Tasks"),
            url: "/?tab=tasks",
            icon: ClipboardListIcon,
            isActive: isRootPath && currentTab === "tasks",
          },
        ]
        : []),

      ...(role === "admin"
        ? [
          {
            title: t("Users"),
            url: "/users",
            icon: UsersIcon,
            isActive: isUsersPath,
          },
        ]
        : []),

      ...(role === "client"
        ? [
          {
            title: t("Tasks"),
            url: clientProjectsHref("tasks"),
            icon: ClipboardListIcon,
            isActive: isClientTasksPath,
          },
          {
            title: t("Contracts"),
            url: clientProjectsHref("contracts"),
            icon: FileTextIcon,
            isActive: isClientContractsPath,
          },
        ]
        : []),

      {
        title: t("Profile"),
        url: "/profile",
        icon: SquareUserIcon,
        isActive: isProfilePath && currentTab !== "settings",
      },
      ...(["admin", "moderator", "employee"].includes(role)
        ? [
          {
            title: t("Settings"),
            url: "/profile?tab=settings",
            icon: SettingsIcon,
            isActive: isProfilePath && currentTab === "settings",
          },
        ]
        : []),
    ],
  };
};
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const {data: session} = useSession();
  const role = session?.user?.role ?? "client";
  const { id: projectId } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  React.useEffect(() => {
    if (pathname === "/" && currentTab === "activity") router.replace("/correspondence");
  }, [currentTab, pathname, router]);

  const {projects, fetchProjects} = useProjectStore();
  React.useEffect(() => {
    if (role === "client") {
      fetchProjects();
    }
  }, [role, fetchProjects]);
  const clientProjectId = role === "client" && projects.length === 1 ? projects[0].id : undefined;

  const data = useNavigationData(role, {
    projectId,
    clientProjectId,
    pathname,
    currentTab,
  });

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
        <NavUser />
      </SidebarFooter>
      {/*<SidebarRail />*/}
    </Sidebar>
  )
}
