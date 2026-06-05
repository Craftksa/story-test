"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslations } from "use-intl"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function SidebarThemeToggle() {
  const t = useTranslations()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = mounted ? resolvedTheme ?? "light" : "light"
  const isDark = activeTheme === "dark"
  const label = isDark ? t("Dark mode") : t("Light mode")

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-[15px] size-8 w-full"
              tooltip={mounted ? label : t("Appearance")}
              onClick={() => setTheme(isDark ? "light" : "dark")}
              type="button"
            >
              {isDark ? <Moon /> : <Sun />}
              <span>{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
