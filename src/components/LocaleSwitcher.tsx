'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {Button} from "@/components/ui/button";

export function LocaleSwitcher() {
	const router = useRouter();
	const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>('ar');

	useEffect(() => {
		const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]*)/);
		const locale = match?.[1] === 'en' ? 'en' : 'ar';
		setCurrentLocale(locale);
	}, []);

	const nextLocale = currentLocale === 'ar' ? 'en' : 'ar';

	const changeLanguage = (locale: string) => {
		document.cookie = `NEXT_LOCALE=${locale}; path=/`;
		setCurrentLocale(locale === 'en' ? 'en' : 'ar');
		router.refresh(); // force re-render with new locale
	};

	return (
		<div
			className="z-50 flex gap-3 text-base leading-none font-medium">
			<Button
				variant="simple"
				size="simple"
				onClick={() => changeLanguage(nextLocale)}
				className="text-primary font-semibold leading-none"
			>
				{nextLocale.toUpperCase()}
			</Button>
		</div>
	);
}
