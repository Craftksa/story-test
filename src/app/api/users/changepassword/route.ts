import {NextRequest, NextResponse} from 'next/server';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {eq} from 'drizzle-orm';
import {authenticate} from "@/lib/authenticate";
import {users} from "@/drizzle/schema";
import {db} from "@/drizzle/db";

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, 'Current password is required'),
	newPassword: z.string()
		.min(6, 'Password must be at least 6 characters')
});

export async function PUT(req: NextRequest) {
	try {
		const { user } = await authenticate(req);

		if (!user || !user.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await req.json();

		const parsed = changePasswordSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json({
				error: "Invalid data",
				issues: parsed.error.errors
			}, { status: 400 });
		}

		const { currentPassword, newPassword } = parsed.data;

		const [currentUser] = await db
			.select()
			.from(users)
			.where(eq(users.id, user.id))
			.limit(1);

		if (!currentUser) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		// @ts-expect-error - currentUser.password is typed string | null; bcrypt.compare requires string
		const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password);

		if (!isCurrentPasswordValid) {
			return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
		}

		// @ts-expect-error - currentUser.password is typed string | null; bcrypt.compare requires string
		const isSamePassword = await bcrypt.compare(newPassword, currentUser.password);

		if (isSamePassword) {
			return NextResponse.json({ error: "New password must be different from current password" }, { status: 400 });
		}

		const hashedNewPassword = await bcrypt.hash(newPassword, 10);

		await db
			.update(users)
			.set({
				password: hashedNewPassword,
				updatedAt: new Date()
			})
			.where(eq(users.id, user.id));

		return NextResponse.json({ message: "Password changed successfully" });

	} catch (error) {
		console.error('Change password error:', error);
		return NextResponse.json({
			error: "Internal server error"
		}, { status: 500 });
	}
}