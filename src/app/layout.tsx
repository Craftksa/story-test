import type {Metadata} from "next";
import {Noto_Nastaliq_Urdu, Tajawal} from "next/font/google";
import "./globals.css";
import localFont from "next/font/local";
import {ThemeProvider} from "next-themes";
import AppLayout from "@/components/layout/AppLayout";
import {SessionProvider} from "next-auth/react";
import {Toaster} from "sonner";
import {auth} from "@/auth";
import {getLocale, getMessages, getTranslations} from 'next-intl/server';
import {LocaleSwitcher} from "@/components/LocaleSwitcher";
import {getCheckedLocale} from "@/lib/server-utils";
import {IntlProviderWrapper} from "@/components/providers/intl-provider-wrapper";
import Footer from "@/components/Footer";

const tajawal = Tajawal({
	subsets: ['arabic'],
	weight: ['300', '400', '700'],
	variable: '--font-tajawal',
});

const urdu = Noto_Nastaliq_Urdu({
	subsets: ['arabic'],
	weight: ['400', '700'],
	variable: '--font-urdu',
});

const metropolis = localFont({
	src: [
		{
			path: './fonts/metropolis.light.woff2',
			weight: '300',
			style: 'light',
		},
		{
			path: './fonts/metropolis.regular.woff2',
			weight: '400',
			style: 'normal',
		},
		{
			path: './fonts/metropolis.bold.woff2',
			weight: '700',
			style: 'bold',
		},
	],
	variable: '--font-metropolis',
});

// const geistSans = Geist({
// 	variable: "--font-geist-sans",
// 	subsets: ["latin"],
// });
//
// const geistMono = Geist_Mono({
// 	variable: "--font-geist-mono",
// 	subsets: ["latin"],
// });

export const metadata: Metadata = {
	title: "Craft",
	description: "Redefining Excellence in Construction"
};

export default async function RootLayout({
	                                         children,
                                         }: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await auth();

	const locale = await getLocale();
	const messages = await getMessages();
	const {dir} = await getCheckedLocale();

	return (
		<html lang={locale} dir={dir} suppressHydrationWarning>
		<body
			className={`
				${tajawal.variable}
		    ${metropolis.variable}
		    antialiased
		  `}
			dir={dir}
		>
		<SessionProvider>
				<ThemeProvider
					attribute="class"
					defaultTheme="light"
					enableSystem
					disableTransitionOnChange
				>
					{!session &&
              <div className={`auth-locale-switcher absolute top-6 z-50 ${dir === 'rtl' ? 'left-8' : 'right-8'}`}>
                  <LocaleSwitcher/>
              </div>
					}
					{session ?
						<IntlProviderWrapper locale={locale} messages={messages}>
							<AppLayout>
								{children}
							</AppLayout>
						</IntlProviderWrapper>
						:
						<IntlProviderWrapper locale={locale} messages={messages}>
							{children}
						</IntlProviderWrapper>
					}
				</ThemeProvider>
			<Toaster dir={dir} position={'top-center'} richColors closeButton/>
		</SessionProvider>
		</body>
		</html>
	);
}
