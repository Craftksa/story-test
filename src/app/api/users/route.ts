import { users } from "@/drizzle/schema";
import {NextRequest, NextResponse} from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import {auth} from "@/auth";
import {authenticate} from "@/lib/authenticate";
import {hasRole} from "@/lib/utils";

// Define user creation schema
const createUserSchema = z.object({
	name: z.string(),
	username: z.string(),
	email: z.string().email(),
	password: z.string(),
	role: z.enum(["admin", "moderator", "employee", "client"]),
});

export async function GET(req: NextRequest) {
	const { user } = await authenticate(req);

	if (!hasRole(user, ["admin", "moderator"])) {
		return NextResponse.json({ error: "Forbidden 403" }, { status: 403 });
	}

	const result = await db
		.select({
			id: users.id,
			name: users.name,
			username: users.username,
			email: users.email,
			image: users.image,
			role: users.role,
			createdAt: users.createdAt,
		})
		.from(users)
		.orderBy(desc(users.createdAt));
	return NextResponse.json(result);
}
export async function POST(req: NextRequest) {
	const { user } = await authenticate(req);

	if (!hasRole(user, ["admin"])) {
		return NextResponse.json({ error: "Forbidden 403" }, { status: 403 });
	}

	const body = await req.json();
	const parsed = createUserSchema.safeParse(body);

	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid data", issues: parsed.error.errors }, { status: 400 });
	}

	const { name, username, email, password, role } = parsed.data;

	const userExists = await db.query.users.findFirst({
		where: eq(users.email, email),
	});
	const usernameExists = await db.query.users.findFirst({
		where: eq(users.username, username),
	});

	if (usernameExists) {
		return NextResponse.json({ error: "Username already exists" }, { status: 409 });
	}
	if (userExists) {
		return NextResponse.json({ error: "User already exists" }, { status: 409 });
	}

	const newUser = await db.insert(users).values({
		name,
		username,
		email,
		password, // Hash in production!
		role,
	}).returning();

	return NextResponse.json(newUser[0]);
}
