'use client';

import {LoginForm} from "@/components/login-form"
import Link from "next/link";
import Image from "next/image";
import CraftLogo from "@/components/craft-logo";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {useTranslations} from "use-intl";
import {LocaleSwitcher} from "@/components/LocaleSwitcher";
import {useCheckedLocale} from "@/lib/client-utils";

export default function LoginPage() {
  const t = useTranslations();
  const {dir} = useCheckedLocale();
  return (
      <div
        className="relative min-h-screen"
        style={{
          background:
            "radial-gradient(circle at center, rgba(70, 70, 70, 0.28) 0%, rgba(38, 38, 38, 0.18) 24%, rgba(15, 15, 15, 0.96) 58%, rgba(0, 0, 0, 1) 100%), linear-gradient(180deg, #161616 0%, #050505 100%)",
          boxShadow: "inset 0 0 180px rgba(0, 0, 0, 0.55)",
        }}
      >
        <div className={`absolute top-6 z-50 text-white ${dir === 'rtl' ? 'left-8' : 'right-8'}`}>
          <LocaleSwitcher />
        </div>
        <div className="flex z-20 flex-col gap-4 p-6 md:p-8">
          <div className="flex justify-start gap-2 z-20">
            <Link href="/" className="flex items-center size-28 gap-2 -mt-[22px] font-medium">
              <CraftLogo />
            </Link>
          </div>
          <div className="flex flex-1 items-center mt-10 justify-center">
            <Card
              className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-white/[0.14] text-white transition-all before:pointer-events-none before:absolute before:inset-0 before:rounded-[28px] before:bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_80%_90%,rgba(216,199,163,0.10),transparent_32%)] before:opacity-75 before:content-[''] after:pointer-events-none after:absolute after:inset-[1px] after:rounded-[27px] after:border after:border-white/[0.06] after:content-['']"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.045) 35%, rgba(0,0,0,0.35) 100%)",
                backdropFilter: "blur(28px) saturate(140%)",
                WebkitBackdropFilter: "blur(28px) saturate(140%)",
                boxShadow:
                  "0 35px 100px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <CardHeader className="relative z-[1]">
                <CardTitle className="text-center text-xl text-white">{t("Welcome Back")}</CardTitle>
                <CardDescription className="text-center text-white/65 ">{t("Enter your email below to login to your Craft account")}</CardDescription>
              </CardHeader>
              <CardContent className="relative z-[1] [&_a]:text-[#D8C7A3] [&_a:hover]:text-[#D8C7A3] [&_button]:rounded-[14px] [&_button]:border [&_button]:border-[rgba(216,199,163,0.45)] [&_button]:bg-transparent [&_button]:text-[#D8C7A3] [&_button]:shadow-[0_0_25px_rgba(216,199,163,0.18),inset_0_0_10px_rgba(216,199,163,0.05)] [&_button]:transition-all [&_button]:duration-300 [&_button:hover]:bg-[rgba(216,199,163,0.12)] [&_button:hover]:shadow-[0_0_35px_rgba(216,199,163,0.28),inset_0_0_12px_rgba(216,199,163,0.08)] [&_input]:rounded-[14px] [&_input]:border [&_input]:border-white/[0.08] [&_input]:bg-[rgba(255,255,255,0.04)] [&_input]:text-white [&_input]:placeholder:text-white/35 [&_input]:shadow-none [&_input]:focus-visible:border-white/[0.12] [&_input]:focus-visible:ring-white/[0.08] [&_label]:text-white">
                <LoginForm />
              </CardContent>
            </Card>
          </div>
        </div>
          <Image
            width={2000}
            height={2000}
            src="/craft-building.png"
            alt="Image"
            className="hidden"
          />
        <style jsx global>{`
          .auth-locale-switcher {
            display: none;
          }
        `}</style>
      </div>
  )
}
