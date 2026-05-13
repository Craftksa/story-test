'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'use-intl';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import ForgotPasswordForm from "@/components/forms/ForgetPasswordForm";
import VerifyOtpForm from "@/components/forms/VerifyOtpForm";
import ResetPasswordForm from "@/components/forms/ResetPasswordForm";
import Image from "next/image";

type Step = 'forgot' | 'verify' | 'reset' | 'success';

const PasswordResetContainer = () => {
	const [currentStep, setCurrentStep] = useState<Step>('forgot');
	const [email, setEmail] = useState('');
	const [tokenId, setTokenId] = useState('');
	const router = useRouter();
	const t = useTranslations();

	const handleForgotPasswordSuccess = (userEmail: string) => {
		setEmail(userEmail);
		setCurrentStep('verify');
	};

	const handleVerifyOtpSuccess = (verificationTokenId: string) => {
		setTokenId(verificationTokenId);
		setCurrentStep('reset');
	};

	const handleResetPasswordSuccess = () => {
		setCurrentStep('success');
	};

	const handleBackToForgot = () => {
		setCurrentStep('forgot');
		setEmail('');
		setTokenId('');
	};

	const handleGoToLogin = () => {
		router.push('/login');
	};

	const renderStep = () => {
		switch (currentStep) {
			case 'forgot':
				return <ForgotPasswordForm onSuccess={handleForgotPasswordSuccess} />;
			case 'verify':
				return (
					<VerifyOtpForm
						email={email}
						onSuccess={handleVerifyOtpSuccess}
						onBack={handleBackToForgot}
					/>
				);
			case 'reset':
				return (
					<ResetPasswordForm
						tokenId={tokenId}
						onSuccess={handleResetPasswordSuccess}
					/>
				);
			case 'success':
				return (
					<div className="mx-auto space-y-4 text-center">
						<div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
							<CheckCircle className="w-6 h-6 text-green-600" />
						</div>
						<h2 className="text-2xl font-bold text-green-600">{t("Password Reset Complete!")}</h2>
						<p className="text-muted-foreground">
							{t("Your password has been successfully reset You can now sign in with your new password")}
						</p>
						<button
							onClick={handleGoToLogin}
							className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md font-medium transition-colors"
						>
							{t("Go to Sign In")}
						</button>
					</div>
				);
			default:
				return null;
		}
	};

	return (
		<div className="relative min-h-screen flex items-center justify-center  p-4">
			<Card className="w-full bg-card/90 max-w-md">
				<CardHeader className="pb-0">
					<div className="flex justify-center space-x-2 mb-4">
						{['forgot', 'verify', 'reset', 'success'].map((step, index) => (
							<div
								key={step}
								className={`w-3 h-3 rounded-full ${
									['forgot', 'verify', 'reset', 'success'].indexOf(currentStep) >= index
										? 'bg-primary'
										: 'bg-muted'
								}`}
							/>
						))}
					</div>
				</CardHeader>
				<CardContent>
					{renderStep()}
				</CardContent>
			</Card>
			<Image
				width={2000}
				height={2000}
				src="/craft-building.png"
				alt="Image"
				className="absolute -z-10 inset-0 h-screen w-screen object-cover brightness-[0.5] grayscale"
			/>
		</div>
	);
};

export default PasswordResetContainer;