'use client';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { useCheckedLocale } from '@/lib/client-utils';

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
import { Eye, EyeOff, KeyRound } from 'lucide-react';

const resetPasswordSchema = z.object({
	newPassword: z.string().min(6, 'Password must be at least 6 characters'),
	confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
	message: "Passwords don't match",
	path: ["confirmPassword"]
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
	tokenId: string;
	onSuccess: () => void;
}

const ResetPasswordForm = ({ tokenId, onSuccess }: ResetPasswordFormProps) => {
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<ResetPasswordFormData>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: {
			newPassword: '',
			confirmPassword: ''
		},
		mode: 'onChange'
	});

	const t = useTranslations();
	const { dir } = useCheckedLocale();

	const onSubmit = async (data: ResetPasswordFormData) => {
		setIsSubmitting(true);

		try {
			await axios.post('/api/auth/reset-password', {
				tokenId,
				newPassword: data.newPassword,
				confirmPassword: data.confirmPassword,
			});

			toast.success(t('Password reset successfully!'));
			form.reset();
			onSuccess();
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

	return (
		<div className="mx-auto space-y-4">
			<div className="text-center">
				<div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
					<KeyRound className="w-6 h-6 text-purple-600" />
				</div>
				<h2 className="text-xl font-bold">{t("Reset Password")}</h2>
				<p className="text-muted-foreground mt-2 text-sm">{t("Enter your new password")}</p>
			</div>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="newPassword"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("New Password")}</FormLabel>
								<FormControl>
									<div className="relative">
										<Input
											type={showNewPassword ? 'text' : 'password'}
											placeholder={t("Enter your new password")}
											{...field}
										/>
										<span
											className={`absolute top-1/2 transform -translate-y-1/2 cursor-pointer text-muted-foreground ${
												dir === 'rtl' ? 'left-2' : 'right-2'
											}`}
											onClick={() => setShowNewPassword(prev => !prev)}
										>
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </span>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="confirmPassword"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Confirm New Password")}</FormLabel>
								<FormControl>
									<div className="relative">
										<Input
											type={showConfirmPassword ? 'text' : 'password'}
											placeholder={t("Confirm your new password")}
											{...field}
										/>
										<span
											className={`absolute top-1/2 transform -translate-y-1/2 cursor-pointer text-muted-foreground ${
												dir === 'rtl' ? 'left-2' : 'right-2'
											}`}
											onClick={() => setShowConfirmPassword(prev => !prev)}
										>
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </span>
									</div>
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
						{t("Reset Password")}
						{isSubmitting && <Spinner className="mx-2" />}
					</Button>
				</form>
			</Form>
		</div>
	);
};

export default ResetPasswordForm;