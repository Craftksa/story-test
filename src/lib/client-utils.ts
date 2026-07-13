"use client"

import { useLocale } from "next-intl";

export function useCheckedLocale() {
	const locale = useLocale();
	const rtlLocales = ["ar", "he", "fa", "ur"];
	const isRTL = rtlLocales.includes(locale);

	return {
		lang: locale,
		dir: (isRTL ? "rtl" : "ltr") as "rtl" | "ltr",
		isRTL,
	};
}
