import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/drizzle/db';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { AUTH_SECRET, HAS_DATABASE_URL, USE_DEV_AUTH_FALLBACK } from '@/lib/auth-config';
import { getLocalDevAuthUser } from '@/lib/dev-auth-users';

export const { handlers, auth, signIn, signOut } = NextAuth({
	secret: AUTH_SECRET,
	trustHost: true,
	adapter: HAS_DATABASE_URL ? DrizzleAdapter(db) : undefined,
	session: {
		strategy: 'jwt',
		maxAge: 60 * 60 * 24,
	},
	jwt: {
		maxAge: 60 * 60 * 24,
	},
	providers: [
		Credentials({
			name: 'Credentials',
			credentials: {
				username: { label: 'Username', type: 'text' },
				password: { label: 'Password', type: 'password' },
			},
			async authorize(credentials) {
				if (!credentials?.username || !credentials?.password) return null;

				if (USE_DEV_AUTH_FALLBACK) {
					const username = String(credentials.username).trim();
					const password = String(credentials.password);
					if (!username) return null;

					const localDevUser = getLocalDevAuthUser(username, password);
					if (localDevUser) {
						return localDevUser;
					}
					return null;
				}

				try {
					const user = await db
						.select()
						.from(users)
						.where(eq(users.username, credentials.username))
						.then((res) => res[0]);

					if (!user || !user.password) return null;

					// @ts-ignore
					const isValid = await bcrypt.compare(credentials.password, user.password);
					if (!isValid) return null;

					return {
						id: user.id,
						username: user.username,
						email: user.email,
						name: user.name,
						role: user.role,
						image: user.image ?? null,
					};
				} catch (error) {
					console.error('Credentials authorize failed:', error);
					return null;
				}
			},
		}),
	],
	pages: {
		signIn: '/login',
		error: '/login',
	},
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id;
				// @ts-ignore
				token.role = user.role;
				token.name = user.name;
				// @ts-ignore
				token.username = user.username;
				token.email = user.email;
				token.image = user.image;
			}
			return token;
		},
		async session({ session, token }) {
			if (token) {
				session.user.id = token.id as string;
				// @ts-ignore
				session.user.role = token.role;
				session.user.name = token.name;
				// @ts-ignore
				session.user.username = token.username;
				session.user.email = token.email as string;
				session.user.image = token.image;
			}
			return session;
		},
	},
});
