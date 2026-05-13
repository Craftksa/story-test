import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/drizzle/db';
import { users, passwordResetTokens } from '@/drizzle/schema';
import { sendPasswordResetEmail, generateOTP } from '@/lib/email';

const forgotPasswordSchema = z.object({
	email: z.string().email('Please enter a valid email address'),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = forgotPasswordSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json({
				error: "Invalid email address",
				issues: parsed.error.errors
			}, { status: 400 });
		}

		const { email } = parsed.data;

		// Check if user exists
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);

		if (!user) {
			return NextResponse.json({
				error: "No account found with this email address"
			}, { status: 404 });
		}

		await db
			.delete(passwordResetTokens)
			.where(eq(passwordResetTokens.userId, user.id));

		// Generate OTP and create token
		const otp = generateOTP();
		const tokenId = uuidv4();
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

		await db.insert(passwordResetTokens).values({
			id: tokenId,
			userId: user.id,
			token: otp,
			expiresAt,
			used: false,
		});

		// Send email
		await sendPasswordResetEmail(email, otp);

		return NextResponse.json({
			message: "Password reset code has been sent to your email."
		});

	} catch (error) {
		console.error('Forgot password error:', error);
		return NextResponse.json({
			error: "Internal server error"
		}, { status: 500 });
	}
}
