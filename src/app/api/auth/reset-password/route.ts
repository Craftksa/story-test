import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '@/drizzle/db';
import { users, passwordResetTokens } from '@/drizzle/schema';

const resetPasswordSchema = z.object({
	tokenId: z.string().min(1, 'Token ID is required'),
	newPassword: z.string().min(6, 'Password must be at least 6 characters'),
	confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
	message: "Passwords don't match",
	path: ["confirmPassword"]
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = resetPasswordSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json({
				error: "Invalid data",
				issues: parsed.error.errors
			}, { status: 400 });
		}

		const { tokenId, newPassword } = parsed.data;

		// Find valid token
		const [resetToken] = await db
			.select({
				id: passwordResetTokens.id,
				userId: passwordResetTokens.userId,
				used: passwordResetTokens.used,
				expiresAt: passwordResetTokens.expiresAt,
			})
			.from(passwordResetTokens)
			.where(
				and(
					eq(passwordResetTokens.id, tokenId),
					eq(passwordResetTokens.used, false),
					gt(passwordResetTokens.expiresAt, new Date())
				)
			)
			.limit(1);

		if (!resetToken) {
			return NextResponse.json({
				error: "Invalid or expired reset token"
			}, { status: 400 });
		}

		// Get user
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, resetToken.userId))
			.limit(1);

		if (!user) {
			return NextResponse.json({
				error: "User not found"
			}, { status: 404 });
		}

		// Check if new password is different from current password
		// @ts-expect-error - user.password is typed string | null; bcrypt.compare requires string
		const isSamePassword = await bcrypt.compare(newPassword, user.password);
		if (isSamePassword) {
			return NextResponse.json({
				error: "New password must be different from current password"
			}, { status: 400 });
		}

		// Hash new password
		const hashedPassword = await bcrypt.hash(newPassword, 10);

		// Update password and mark token as used
		await Promise.all([
			db
				.update(users)
				.set({
					password: hashedPassword,
					updatedAt: new Date()
				})
				.where(eq(users.id, user.id)),

			db
				.update(passwordResetTokens)
				.set({ used: true })
				.where(eq(passwordResetTokens.id, tokenId))
		]);

		return NextResponse.json({
			message: "Password reset successfully"
		});

	} catch (error) {
		console.error('Reset password error:', error);
		return NextResponse.json({
			error: "Internal server error"
		}, { status: 500 });
	}
}