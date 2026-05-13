'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'use-intl';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
	User,
	Mail,
	Shield,
	Settings,
	LogOut,
	Edit,
	Key,
	UserCircle
} from 'lucide-react';
import ChangePasswordForm from '@/components/forms/ChangePasswordForm';
import {getFirstInitial, getInitials} from "@/lib/utils";
import Spinner from "@/components/Spinner";
import StatusBadge from "@/components/StatusBadgeSystem";

const UserProfile = () => {
	const { data: session, status } = useSession();
	const t = useTranslations();
	const router = useRouter();
	const [showChangePassword, setShowChangePassword] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	if (status === 'loading') {
		return (
			<div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
				<Spinner className="h-6 w-6 text-muted-foreground" />
				<span className="mx-2 text-muted-foreground">{t("Loading your profile")}...</span>
			</div>
		);
	}

	if (!session?.user) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Card className="w-full max-w-md">
					<CardContent className="flex flex-col items-center space-y-4 p-6">
						<UserCircle className="h-16 w-16 text-muted-foreground" />
						<p className="text-lg font-medium">{t('Not authenticated')}</p>
						<Button onClick={() => router.push('/login')}>
							{t('Go to Login')}
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const user = session.user;

	const handleLogout = async () => {
		setIsLoggingOut(true);
		try {
			await signOut({ callbackUrl: '/login' });
		} catch (error) {
			console.error('Logout error:', error);
			setIsLoggingOut(false);
		}
	};


	if (showChangePassword) {
		return (
			<div className="container sm:mt-4 mt-0 mx-auto max-w-4xl">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
				>
					<div className="flex items-center gap-4 mb-6">
						<Button
							size="sm"
							variant="outline"
							onClick={() => setShowChangePassword(false)}
						>
							← {t('Back to Profile')}
						</Button>
					</div>
					<ChangePasswordForm />
				</motion.div>
			</div>
		);
	}

	return (
		<div className="">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className="space-y-4"
			>
				{/* Profile Card */}
				<Card className="overflow-hidden">
					<CardHeader className="border-b">
						<div className="flex items-center space-x-4">
							<motion.div
								whileHover={{ scale: 1.05 }}
								transition={{ type: "spring", stiffness: 300 }}
							>
								<Avatar className="size-20 border-4 shadow-lg">
									<AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
									<AvatarFallback className="text-2xl font-bold">
										{getFirstInitial(user.name || user.username || 'U')}
									</AvatarFallback>
								</Avatar>
							</motion.div>
							<div className="space-y-3">
								<CardTitle className="text-xl leading-none">{user.name || user.username}</CardTitle>
								<div className="flex items-center gap-2">
									<StatusBadge status={user.role} />
								</div>
							</div>
						</div>
					</CardHeader>

					<CardContent className="">
						<div className="grid md:grid-cols-2 gap-6">
							{/* User Details */}
							<div className="space-y-4">
								<h3 className="text-lg font-semibold flex items-center gap-2">
									<User className="h-5 w-5" />
									{t('Personal Information')}
								</h3>

								<div className="space-y-3">
									<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
										<User className="h-4 w-4 text-muted-foreground" />
										<div>
											<p className="text-sm font-medium text-muted-foreground">{t('Full Name')}</p>
											<p className="font-medium">{user.name || t('Not provided')}</p>
										</div>
									</div>

									<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
										<UserCircle className="h-4 w-4 text-muted-foreground" />
										<div>
											<p className="text-sm font-medium text-muted-foreground">{t('Username')}</p>
											<p className="font-medium">{user.username}</p>
										</div>
									</div>

									<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
										<Mail className="h-4 w-4 text-muted-foreground" />
										<div>
											<p className="text-sm font-medium text-muted-foreground">{t('Email')}</p>
											<p className="font-medium">{user.email}</p>
										</div>
									</div>

									<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
										<Shield className="h-4 w-4 text-muted-foreground" />
										<div>
											<p className="text-sm font-medium text-muted-foreground">{t('Role')}</p>
											<StatusBadge status={user.role} />
										</div>
									</div>

									<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
										<User className="h-4 w-4 text-muted-foreground" />
										<div>
											<p className="text-sm font-medium text-muted-foreground">{t('User ID')}</p>
											<p className="font-mono text-sm">{user.id}</p>
										</div>
									</div>
								</div>
							</div>

							{/* Actions */}
							<div className="space-y-4">
								<h3 className="text-lg font-semibold flex items-center gap-2">
									<Settings className="h-5 w-5" />
									{t('Account Actions')}
								</h3>

								<div className="space-y-3">
									<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
										<Button
											onClick={() => setShowChangePassword(true)}
											className="w-full justify-start"
											variant="outline"
										>
											<Key className="h-4 w-4 mx-2" />
											{t('Change Password')}
										</Button>
									</motion.div>

									<Separator />

									<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
										<Button
											onClick={handleLogout}
											disabled={isLoggingOut}
											className="w-full justify-start"
										>
											<LogOut className="h-4 w-4 mx-2" />
											{isLoggingOut ? t('Logging out') : t('Logout')}
										</Button>
									</motion.div>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Quick Stats or Additional Info */}
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">{t('Account Summary')}</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="text-center p-4 rounded-lg bg-primary/20">
								<Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
								<p className="font-semibold">{t('Role')}</p>
								<p className="text-sm text-primary">{t(user.role)}</p>
							</div>
							<div className="text-center p-4 rounded-lg bg-green-500/20">
								<User className="h-8 w-8 mx-auto mb-2 text-green-600 dark:text-green-200" />
								<p className="font-semibold">{t('Account Status')}</p>
								<p className="text-sm text-green-600 dark:text-green-200">{t('Active')}</p>
							</div>
							<div className="text-center p-4 rounded-lg bg-blue-500/20">
								<Mail className="h-8 w-8 mx-auto mb-2 text-blue-600" />
								<p className="font-semibold">{t('Email Status')}</p>
								<p className="text-sm text-blue-600">{t('Verified')}</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</motion.div>
		</div>
	);
};

export default UserProfile;