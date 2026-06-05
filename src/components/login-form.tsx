'use client'

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {useTranslations, useLocale} from "use-intl";
import {useCheckedLocale} from "@/lib/client-utils";
import Link from "next/link"

export function LoginForm({
                            className,
                            ...props
                          }: React.ComponentProps<"form">) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await signIn("credentials", {
      username, // 👈 changed from email to username
      password,
      redirect: false,
    })

    setLoading(false)

    if (res?.error) {
      setError(t('Invalid username or password'))
      toast.error(res?.error)
    } else {
      router.push("/")
      toast.success(t('Successfully logged in'))
      router.refresh()
    }
  }
  const t = useTranslations();
  const {dir} = useCheckedLocale();
  return (
    <form dir={dir}  onSubmit={handleSubmit} className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="username" className="text-[#111]">{t('Username')}</Label>
          <Input
            id="username"
            type="text"
            placeholder={t("Your username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border-black/15 bg-[rgba(245,238,220,0.38)] text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] placeholder:text-[#111]/45 focus-visible:border-black/25 focus-visible:ring-black/10"
            required
          />
        </div>
        <div className="grid gap-3">
          <div className="flex justify-between items-center">
            <Label htmlFor="password" className="text-[#111]">{t("Password")}</Label>
            <Link
              href="/reset-password"
              className=" text-sm text-[#111]/65 underline-offset-4 hover:text-[#111] hover:underline"
            >
              {t("Forgot your password?")}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                "border-black/15 bg-[rgba(245,238,220,0.38)] text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] placeholder:text-[#111]/45 focus-visible:border-black/25 focus-visible:ring-black/10",
                dir === "rtl" ? "ps-11" : "pe-11"
              )}
              required
            />
            <span
              role="button"
              tabIndex={0}
              onClick={() => setShowPassword((current) => !current)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  setShowPassword((current) => !current)
                }
              }}
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 appearance-none border-0 bg-transparent p-0 shadow-none outline-none ring-0 text-[#111]/60 transition hover:text-[#111] focus:outline-none focus-visible:text-[#111] focus-visible:ring-0 h-auto w-auto leading-none",
                dir === "rtl" ? "left-2" : "right-2"
              )}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </span>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full border border-black/10 bg-[#111] text-[#f5eedc] shadow-[0_12px_28px_rgba(17,17,17,0.20)] hover:bg-[#2a2823] focus-visible:ring-black/20" disabled={loading}>
          {loading ? `${t("Logging in")}` : `${t("Login")}`}
        </Button>
      </div>
    </form>
  )
}
