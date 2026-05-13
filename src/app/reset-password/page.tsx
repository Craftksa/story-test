import {Metadata} from 'next';
import PasswordResetContainer from "@/components/PasswordResetContainer";

export const metadata: Metadata = {
	title: 'Reset Password',
	description: 'Reset your account password',
};

export default function ResetPasswordPage() {
	return <PasswordResetContainer />;
}