import {getToken} from "next-auth/jwt";
import type {NextRequest} from "next/server";
import {AUTH_SECRET, IS_SECURE_COOKIE} from "@/lib/auth-config";

export interface AuthenticatedUser {
	id?: string;
	email: string;
	role: string;
	name?: string;
	image?: string;

	[key: string]: any;
}

export async function authenticate(req: NextRequest): Promise<{
	user: AuthenticatedUser | null;
	token: any;
}> {
	const token = await getToken({
		req,
		secret: AUTH_SECRET,
		secureCookie: IS_SECURE_COOKIE,
	});

	if (!token) {
		return {user: null, token: null};
	}

	const user: any = {
		id: token.id,
		email: token.email,
		role: token.role,
		name: token.name,
		image: token.picture,
		...token,
	};

	return {user, token};
}
