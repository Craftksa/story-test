import { db } from "@/drizzle/db";
import { users } from "@/drizzle/schema";
import {NextRequest, NextResponse} from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {authenticate} from "@/lib/authenticate";
import {hasRole} from "@/lib/utils";

const updateUserSchema = z.object({
	name: z.string().optional(),
	username: z.string().optional(),
	email: z.string().email().optional(),
	password: z.string().optional(),
	role: z.enum(["admin", "moderator", "employee", "client"]).optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
	const { user } = await authenticate(req);

	if (!hasRole(user, ["admin"])) {
		return NextResponse.json({ error: "Forbidden 403" }, { status: 403 });
	}

	const userDetails = await db
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
		.where(eq(users.id, params.id))
		.then((res) => res[0]);

	if (!userDetails) {
		return NextResponse.json({ error: "User not found" }, { status: 404 });
	}

	return NextResponse.json(userDetails);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
	const { user } = await authenticate(req);

	if (!hasRole(user, ["admin"])) {
		return NextResponse.json({ error: "Forbidden 403" }, { status: 403 });
	}

	const body = await req.json();
	const parsed = updateUserSchema.safeParse(body);

	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid data", issues: parsed.error.errors }, { status: 400 });
	}

	await db.update(users).set(parsed.data).where(eq(users.id, params.id));

	return NextResponse.json({ message: "User updated" });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
	const { user } = await authenticate(req);

	if (!hasRole(user, ["admin"])) {
		return NextResponse.json({ error: "Forbidden 403" }, { status: 403 });
	}

	await db.delete(users).where(eq(users.id, params.id));
	return NextResponse.json({ message: "User deleted" });
}
