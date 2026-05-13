'use client'

import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import UserForm from "@/components/forms/UserForm";
import {useTranslations} from "use-intl";


const NewUserPage = () => {
	const t = useTranslations();

	return (
		<div className="flex justify-center">
			<Card className="w-full rounded-none">
				<CardHeader>
					<CardTitle className="relative">
						{t("Create a New User")}
					</CardTitle>
					<CardDescription>
						{t("Add a new user to your team")}.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<UserForm />
				</CardContent>
			</Card>
		</div>
	)
}

export default NewUserPage
