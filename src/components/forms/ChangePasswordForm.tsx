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
import { Eye, EyeOff } from 'lucide-react';

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, 'Current password is required'),
	newPassword: z.string()
		.min(6, 'Password must be at least 6 characters'),
	confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
	message: "Passwords don't match",
	path: ["confirmPassword"]
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

const ChangePasswordForm = () => {
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<ChangePasswordFormData>({
		resolver: zodResolver(changePasswordSchema),
		defaultValues: {
			currentPassword: '',
			newPassword: '',
			confirmPassword: ''
		},
		mode: 'onChange'
	});

	const t = useTranslations();
	const { dir } = useCheckedLocale();

	const onSubmit = async (data: ChangePasswordFormData) => {
		setIsSubmitting(true);

		try {
			const response = await axios.put('/api/users/changepassword', {
				currentPassword: data.currentPassword,
				newPassword: data.newPassword,
			});

			const result = response.data;

			toast.success(t('Password changed successfully!'));
			form.reset();
		} catch (error) {
			toast.error(
				error instanceof Error
					? t((error as any).response?.data?.error) || t(error.message)
					: t('Something went wrong!')
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className=" mx-auto space-y-4">
			<div className="text-center">
				<h2 className="text-2xl font-bold">{t("Change Password")}</h2>
				<p className="text-muted-foreground mt-2">{t("Update your account password")}</p>
			</div>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="currentPassword"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Current Password")}</FormLabel>
								<FormControl>
									<div className="relative">
										<Input
											type={showCurrentPassword ? 'text' : 'password'}
											placeholder={t("Enter your current password")}
											{...field}
										/>
										<span
											className={`absolute top-1/2 transform -translate-y-1/2 cursor-pointer text-muted-foreground ${
												dir === 'rtl' ? 'left-2' : 'right-2'
											}`}
											onClick={() => setShowCurrentPassword(prev => !prev)}
										>
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </span>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

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
						{t("Change Password")}
						{isSubmitting && <Spinner className="mx-2" />}
					</Button>
				</form>
			</Form>
		</div>
	);
};

export default ChangePasswordForm;