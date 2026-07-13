type AppUserRole = "admin" | "moderator" | "employee" | "client" | null;

// `next-auth` (v5 beta) re-exports Session/User via `export type { ... } from "@auth/core/types"`
// rather than declaring them locally, so augmentation must target @auth/core/types directly.
//
// Note: JWT is intentionally NOT augmented here. Declaring `interface JWT` on either
// "next-auth/jwt" or "@auth/core/jwt" breaks TypeScript's resolution of the `getToken`
// export from those modules (a reproducible TS quirk with this package's `export *` re-export
// chain) — every caller of getToken() in the app would fail to compile. Call sites that read
// token.role / token.username instead cast explicitly (see auth.ts, lib/authenticate.ts).
declare module "@auth/core/types" {
	interface User {
		role?: AppUserRole;
		username?: string | null;
	}
}
