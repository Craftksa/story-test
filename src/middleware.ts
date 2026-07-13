import type {NextRequest} from "next/server";
import {NextResponse} from "next/server";
import {getToken} from "next-auth/jwt";
import {AUTH_SECRET, IS_SECURE_COOKIE} from "@/lib/auth-config";

const PUBLIC_PATHS = ["/login", "/reset-password"];
const AUTH_API_PATH = "/api/auth";

// Define a type for role access rules
type AccessRule = {
	allow: string[];
	deny?: string[];
};

// More fine-grained access control per role
const ROLE_ACCESS_MAP: Record<string, AccessRule> = {
	admin: {
		allow: ["/", "/projects", "/projects/new", "/projects/edit", "/users", "/profile", "/projects/:id/contracts/new"],
	},
	moderator: {
		allow: ["/", "/projects", "/projects/new", "/projects/edit", "/profile"],
		deny: ["/projects/:id/contracts/new"],
	},
	employee: {
		allow: ["/", "/projects", "/profile"],
		deny: ["/projects/new", "/projects/edit", "/projects/:id/contracts/new"],
	},
	client: {
		allow: ["/", "/projects", "/profile"],
		deny: ["/projects/new", "/projects/edit", "/projects/:id/contracts/new"],
	},
};

// Combine all known paths from all roles and public paths
const ALL_KNOWN_PATHS = Array.from(
	new Set(
		Object.values(ROLE_ACCESS_MAP)
			.flatMap((r) => [...r.allow, ...(r.deny || [])])
			.concat(PUBLIC_PATHS)
	)
);

// Check if a path matches a rule path or its subpaths
function isPathMatch(path: string, rulePath: string): boolean {
	return path === rulePath || path.startsWith(rulePath + "/");
}

// Check if a path is allowed based on role access rules
function isAccessAllowed(path: string, rules: AccessRule): boolean {
	const isDenied = rules.deny?.some((denyPath) => isPathMatch(path, denyPath));
	if (isDenied) return false;

	const isAllowed = rules.allow.some((allowPath) => isPathMatch(path, allowPath));
	return isAllowed;
}

// Check if a path is public or registered
function isKnownPath(path: string): boolean {
	return ALL_KNOWN_PATHS.some((known) => path === known || path.startsWith(known + "/"));
}

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// ✅ Locale Detection and Cookie (injected block here)
	const SUPPORTED_LOCALES = ['ar', 'en'];
	const DEFAULT_LOCALE = 'ar';

	let locale = req.cookies.get('NEXT_LOCALE')?.value;

	if (!locale || !SUPPORTED_LOCALES.includes(locale)) {
		locale = DEFAULT_LOCALE;

		const res = NextResponse.next();
		res.cookies.set('NEXT_LOCALE', locale, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
		});
		return res;
	}

	// Let static files and internal Next.js requests through
	if (
		pathname.startsWith("/_next") ||
		pathname.match(/\.(?:png|svg|jpg|jpeg|css|js|ico|woff2?)$/)
	) {
		return NextResponse.next();
	}

	const isApiRoute = pathname.startsWith("/api");
	const isAuthApi = pathname.startsWith(AUTH_API_PATH);

	const token = await getToken({
		req,
		secret: AUTH_SECRET,
		secureCookie: IS_SECURE_COOKIE,
	});

	const isAuth = !!token;

	// Allow NextAuth API routes
	if (isApiRoute && isAuthApi) {
		return NextResponse.next();
	}

	if (isApiRoute && pathname.startsWith("/api/uploadthing")) {
		console.log("[Middleware] Allowing UploadThing callback through");
		return NextResponse.next();
	}

	// Defense-in-depth: any other /api/* route requires a valid token
	if (isApiRoute && !isAuth) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Public pages (e.g. /login)
	if (PUBLIC_PATHS.includes(pathname)) {
		if (isAuth) {
			return NextResponse.redirect(new URL("/", req.url));
		}
		return NextResponse.next();
	}

	// Unauthenticated user accessing a known protected route
	if (!isAuth && isKnownPath(pathname)) {
		const loginUrl = new URL("/login", req.url);
		loginUrl.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(loginUrl);
	}

	// Authenticated user with role-based access control
	if (isAuth && token?.role && isKnownPath(pathname)) {
		const accessRule = ROLE_ACCESS_MAP[token.role as string];
		if (!accessRule || !isAccessAllowed(pathname, accessRule)) {
			const unauthorizedUrl = new URL("/unauthorized", req.url);
			unauthorizedUrl.searchParams.set("reason", "access_denied");
			unauthorizedUrl.searchParams.set("requiredRole", token.role as string);
			unauthorizedUrl.searchParams.set("attemptedPath", pathname);
			return NextResponse.redirect(unauthorizedUrl);
		}
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!_next|_next/image|favicon.ico|static|.*\\.(?:png|svg|jpg|jpeg|css|js|ico|woff2?)).*)",
		"/api/:path*",
	],
};
