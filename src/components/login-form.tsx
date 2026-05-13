'use client'

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
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
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-black/15 bg-[rgba(245,238,220,0.38)] text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] placeholder:text-[#111]/45 focus-visible:border-black/25 focus-visible:ring-black/10"
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full border border-black/10 bg-[#111] text-[#f5eedc] shadow-[0_12px_28px_rgba(17,17,17,0.20)] hover:bg-[#2a2823] focus-visible:ring-black/20" disabled={loading}>
          {loading ? `${t("Logging in")}` : `${t("Login")}`}
        </Button>
      </div>
    </form>
  )
}
