import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '@/drizzle/db';
import { passwordResetTokens, users } from '@/drizzle/schema';
import { MAX_OTP_ATTEMPTS, recordFailedOtpAttempt, clearOtpAttempts } from '@/lib/otp-rate-limit';

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

		// Find the active (unused, unexpired) reset token for this user
		const [activeToken] = await db
			.select()
			.from(passwordResetTokens)
			.where(
				and(
					eq(passwordResetTokens.userId, user.id),
					eq(passwordResetTokens.used, false),
					gt(passwordResetTokens.expiresAt, new Date())
				)
			)
			.limit(1);

		if (!activeToken) {
			return NextResponse.json({
				error: "Invalid or expired OTP"
			}, { status: 400 });
		}

		if (activeToken.token !== otp) {
			const attempts = recordFailedOtpAttempt(activeToken.id);

			if (attempts >= MAX_OTP_ATTEMPTS) {
				await db
					.update(passwordResetTokens)
					.set({ used: true })
					.where(eq(passwordResetTokens.id, activeToken.id));
				clearOtpAttempts(activeToken.id);

				return NextResponse.json({
					error: "Too many attempts. Please request a new code."
				}, { status: 429 });
			}

			return NextResponse.json({
				error: "Invalid or expired OTP"
			}, { status: 400 });
		}

		clearOtpAttempts(activeToken.id);

		return NextResponse.json({
			message: "OTP verified successfully",
			tokenId: activeToken.id
		});

	} catch (error) {
		console.error('Verify OTP error:', error);
		return NextResponse.json({
			error: "Internal server error"
		}, { status: 500 });
	}
}