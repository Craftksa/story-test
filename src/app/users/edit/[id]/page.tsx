'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import UserForm, {type UserInput} from '@/components/forms/UserForm'
import { useUserStore } from '@/store/userStore'
import Spinner from '@/components/Spinner'
import {useTranslations} from "use-intl";

const EditUserPage = () => {
	const { id } = useParams()
	const { fetchOneUser, selectedUser, loading} = useUserStore()

	useEffect(() => {
		const fetchUser = () => {
			if (typeof id !== 'string') return
			fetchOneUser(id)
		}

		fetchUser()
	}, [id, fetchOneUser])

	const t = useTranslations();

	if (loading) {
		return (
			<div className="flex justify-center items-center h-64">
				<Spinner />
			</div>
		)
	}

	if (!selectedUser) {
		return (
			<div className="text-center mt-10 text-destructive font-medium">
				{t("User not found")}.
			</div>
		)
	}

	return (
		<div className="flex justify-center">
			<Card className="w-full rounded-none">
				<CardHeader>
					<CardTitle className="relative">
						{t("Update user")}
					</CardTitle>
					<CardDescription>
						{t("Update the user details")}.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<UserForm user={selectedUser as unknown as UserInput} />
				</CardContent>
			</Card>
		</div>
	)
}

export default EditUserPage
