import { getLocale } from "next-intl/server";

export async function getCheckedLocale() {
	const locale = await getLocale();
	const rtlLocales = ["ar", "he", "fa", "ur"];
	const isRTL = rtlLocales.includes(locale);

	return {
		lang: locale,
		dir: (isRTL ? "rtl" : "ltr") as "rtl" | "ltr",
		isRTL ,
	};
}