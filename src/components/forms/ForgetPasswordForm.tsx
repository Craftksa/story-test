'use client';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {useEffect, useState} from 'react';
import { useTranslations } from 'use-intl';

import { Input } from '@/components/ui/input';
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
import { Mail } from 'lucide-react';

const forgotPasswordSchema = z.object({
	email: z.string().email('Please enter a valid email address')
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
	onSuccess: (email: string) => void;
}

const COOLDOWN_KEY = 'forgot-password-cooldown';
const COOLDOWN_MINUTES = 5;

const ForgotPasswordForm = ({ onSuccess }: ForgotPasswordFormProps) => {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [cooldown, setCooldown] = useState<number>(0);

	const form = useForm<ForgotPasswordFormData>({
		resolver: zodResolver(forgotPasswordSchema),
		defaultValues: {
			email: ''
		},
		mode: 'onChange'
	});

	const t = useTranslations();

	// Check cooldown on load
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

	const onSubmit = async (data: ForgotPasswordFormData) => {
		setIsSubmitting(true);

		try {
			await axios.post('/api/auth/forgot-password', {
				email: data.email,
			});

			// Set 5-minute cooldown
			const expireAt = Date.now() + COOLDOWN_MINUTES * 60 * 1000;
			localStorage.setItem(COOLDOWN_KEY, expireAt.toString());
			setCooldown(COOLDOWN_MINUTES * 60);

			toast.success(t('Password reset code sent to your email!'));
			onSuccess(data.email);
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
				<div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
					<Mail className="w-6 h-6 text-blue-600" />
				</div>
				<h2 className="text-xl font-bold">{t('Forgot Password')}</h2>
				<p className="text-muted-foreground mt-2 text-sm">
					{t("Enter your email address and we'll send you a code to reset your password")}
				</p>
			</div>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('Email Address')}</FormLabel>
								<FormControl>
									<Input
										type="email"
										placeholder={t('Enter your email address')}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{cooldown > 0 ? (
						<Button disabled className="w-full">
							{t('Wait')} ({formatTime(cooldown)})
						</Button>
					) : (
						<Button
							type="submit"
							className="w-full"
							disabled={isSubmitting || !form.formState.isValid}
						>
							{t('Send Reset Code')}
							{isSubmitting && <Spinner className="mx-2" />}
						</Button>
					)}
				</form>
			</Form>
		</div>
	);
};

export default ForgotPasswordForm;