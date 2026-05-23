import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
	typescript: {
		ignoreBuildErrors: true,
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
	serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
	outputFileTracingIncludes: {
		"/api/activity/reports/*/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
		"/api/activity/reports/*/approval": ["./node_modules/@sparticuz/chromium/bin/**"],
		"/api/activity/reports/*/send": ["./node_modules/@sparticuz/chromium/bin/**"],
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**.ufs.sh",
			},
			{
				protocol: "https",
				hostname: "uploadthing.com",
			},
		],
	},
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
