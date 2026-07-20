'use client';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import Spinner from '@/components/Spinner';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage
} from '@/components/ui/form';
import { Shield, ArrowLeft } from 'lucide-react';
import {REGEXP_ONLY_DIGITS} from "input-otp";
import {InputOTP, InputOTPGroup, InputOTPSlot} from "@/components/ui/input-otp";

const verifyOtpSchema = z.object({
	otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only numbers')
});

type VerifyOtpFormData = z.infer<typeof verifyOtpSchema>;

interface VerifyOtpFormProps {
	email: string;
	onSuccess: (tokenId: string) => void;
	onBack: () => void;
}

const COOLDOWN_KEY = 'forgot-password-cooldown';
const COOLDOWN_MINUTES = 5;

const VerifyOtpForm = ({ email, onSuccess, onBack }: VerifyOtpFormProps) => {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isResending, setIsResending] = useState(false);
	const [cooldown, setCooldown] = useState<number>(0);

	const form = useForm<VerifyOtpFormData>({
		resolver: zodResolver(verifyOtpSchema),
		defaultValues: {
			otp: ''
		},
		mode: 'onChange'
	});

	const t = useTranslations();

	// Load cooldown from localStorage
	useEffect(() => {
		const stored = localStorage.getItem(COOLDOWN_KEY);
		if (stored) {
			const expireAt = parseInt(stored);
			const remaining = expireAt - Date.now();
			if (remaining > 0) {
				setCooldown(Math.floor(remaining / 1000));
			} else {
				localStorage.removeItem(COOLDOWN_KEY);
			}
		}
	}, []);

	// Countdown timer
	useEffect(() => {
		if (cooldown <= 0) return;

		const interval = setInterval(() => {
			setCooldown((prev) => {
				if (prev <= 1) {
					localStorage.removeItem(COOLDOWN_KEY);
					clearInterval(interval);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(interval);
	}, [cooldown]);

	const onSubmit = async (data: VerifyOtpFormData) => {
		setIsSubmitting(true);

		try {
			const response = await axios.post('/api/auth/verify-otp', {
				email,
				otp: data.otp,
			});

			const result = response.data;
			toast.success(t('OTP verified successfully!'));
			onSuccess(result.tokenId);
		} catch (error) {
			toast.error(
				axios.isAxiosError(error)
					? t(error.response?.data?.error) || t(error.message)
					: t('Something went wrong!')
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleResendOtp = async () => {
		if (cooldown > 0) return;

		setIsResending(true);
		try {
			await axios.post('/api/auth/forgot-password', { email });

			// Reset cooldown
			const expireAt = Date.now() + COOLDOWN_MINUTES * 60 * 1000;
			localStorage.setItem(COOLDOWN_KEY, expireAt.toString());
			setCooldown(COOLDOWN_MINUTES * 60);

			toast.success(t('New OTP sent to your email!'));
			form.reset();
		} catch {
			toast.error(t('Failed to resend OTP Please try again'));
		} finally {
			setIsResending(false);
		}
	};

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	};

	return (
		<div className="mx-auto space-y-4">
			<div className="text-center">
				<div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
					<Shield className="w-6 h-6 text-green-600" />
				</div>
				<h2 className="text-xl font-bold">{t("Verify OTP")}</h2>
				<p className="text-muted-foreground mt-2 text-sm">
					{t("Enter the 6-digit code sent to")} <span className="font-medium">{email}</span>
				</p>
			</div>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex flex-col w-full items-center ">
					<FormField
						control={form.control}
						name="otp"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Verification Code")}</FormLabel>
								<FormControl>
									<InputOTP
										maxLength={6}
										pattern={REGEXP_ONLY_DIGITS}
										value={field.value}
										onChange={(value) => field.onChange(value)}
									>
										<InputOTPGroup>
											{Array.from({ length: 6 }, (_, index) => (
												<InputOTPSlot key={index} index={index} />
											))}
										</InputOTPGroup>
									</InputOTP>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>


					<Button
						type="submit"
						className="w-full"
						disabled={isSubmitting || !form.formState.isValid}
					>
						{t("Verify Code")}
						{isSubmitting && <Spinner className="mx-2" />}
					</Button>

					<div className="flex flex-col space-y-2 w-full">
						<Button
							type="button"
							variant="ghost"
							onClick={handleResendOtp}
							disabled={isResending || cooldown > 0}
							className="w-full"
						>
							{isResending ? (
								<>
									<Spinner className="mr-2" />
									{t("Resending")}
								</>
							) : cooldown > 0 ? (
								`${t("Resend Code in")} ${formatTime(cooldown)}`
							) : (
								t("Resend Code")
							)}
						</Button>

						<Button
							type="button"
							variant="ghost"
							onClick={onBack}
							className="w-full"
						>
							<ArrowLeft className="w-4 h-4 mr-2" />
							{t("Back to Email")}
						</Button>
					</div>
				</form>
			</Form>
		</div>
	);
};

export default VerifyOtpForm;
