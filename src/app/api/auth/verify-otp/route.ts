import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '@/drizzle/db';
import { passwordResetTokens, users } from '@/drizzle/schema';

const verifyOtpSchema = z.object({
	email: z.string().email('Please enter a valid email address'),
	otp: z.string().length(6, 'OTP must be 6 digits'),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = verifyOtpSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json({
				error: "Invalid data",
				issues: parsed.error.errors
			}, { status: 400 });
		}

		const { email, otp } = parsed.data;

		// Find user by email
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);

		if (!user) {
			return NextResponse.json({
				error: "Invalid email or OTP"
			}, { status: 400 });
		}

		// Find valid token
		const [resetToken] = await db
			.select()
			.from(passwordResetTokens)
			.where(
				and(
					eq(passwordResetTokens.userId, user.id),
					eq(passwordResetTokens.token, otp),
					eq(passwordResetTokens.used, false),
					gt(passwordResetTokens.expiresAt, new Date())
				)
			)
			.limit(1);

		if (!resetToken) {
			return NextResponse.json({
				error: "Invalid or expired OTP"
			}, { status: 400 });
		}

		return NextResponse.json({
			message: "OTP verified successfully",
			tokenId: resetToken.id
		});

	} catch (error) {
		console.error('Verify OTP error:', error);
		return NextResponse.json({
			error: "Internal server error"
		}, { status: 500 });
	}
}