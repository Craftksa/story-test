export const MAX_OTP_ATTEMPTS = 5;

const attemptCounts = new Map<string, number>();

export function recordFailedOtpAttempt(tokenId: string): number {
	const attempts = (attemptCounts.get(tokenId) ?? 0) + 1;
	attemptCounts.set(tokenId, attempts);
	return attempts;
}

export function clearOtpAttempts(tokenId: string): void {
	attemptCounts.delete(tokenId);
}
