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
