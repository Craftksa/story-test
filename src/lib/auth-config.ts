const DEV_FALLBACK_AUTH_SECRET = "craft-flow-dev-secret";
const DATABASE_URL = process.env.DATABASE_URL?.trim() || "";

export const AUTH_SECRET =
	process.env.AUTH_SECRET ||
	(process.env.NODE_ENV === "development" ? DEV_FALLBACK_AUTH_SECRET : undefined);

export const HAS_DATABASE_URL = DATABASE_URL.length > 0;
export const USE_DEV_AUTH_FALLBACK =
	process.env.NODE_ENV === "development" && !HAS_DATABASE_URL;

const AUTH_URL = process.env.AUTH_URL?.trim() || "";

export const IS_SECURE_COOKIE = AUTH_URL
	? AUTH_URL.startsWith("https://")
	: process.env.NODE_ENV === "production";
