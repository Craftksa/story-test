import {getToken} from "next-auth/jwt";
import type {JWT} from "next-auth/jwt";
import type {NextRequest} from "next/server";
import {AUTH_SECRET, IS_SECURE_COOKIE} from "@/lib/auth-config";

export interface AuthenticatedUser {
	id?: string;
	email: string;
	role: string;
	name?: string;
	image?: string;

	[key: string]: unknown;
}

export async function authenticate(req: NextRequest): Promise<{
	user: AuthenticatedUser | null;
	token: JWT | null;
}> {
	const token = await getToken({
		req,
		secret: AUTH_SECRET,
		secureCookie: IS_SECURE_COOKIE,
	});

	if (!token) {
		return {user: null, token: null};
	}

	// `...token` is spread last so real token fields win over these defaults; that means
	// the casts below only apply when token itself lacks the field, so the merged result
	// is cast to AuthenticatedUser rather than typed field-by-field.
	const user = {
		id: token.id as string | undefined,
		email: token.email as string,
		role: token.role as string,
		name: token.name as string | undefined,
		image: token.picture as string | undefined,
		...token,
	} as AuthenticatedUser;

	return {user, token};
}
