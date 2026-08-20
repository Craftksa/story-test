'use client';

import {useRouter} from 'next/navigation';
import {useForm, type Resolver} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {toast} from 'sonner';

import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import Spinner from '@/components/Spinner';
import {useUserStore} from '@/store/userStore';
import {createUserSchema, updateUserSchema} from '@/schemas/usersSchema';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage
} from '@/components/ui/form';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import {Eye, EyeOff} from "lucide-react";
import {useState} from "react";
import {useTranslations} from "use-intl";
import {useCheckedLocale} from "@/lib/client-utils";

export type UserFormData = z.infer<ReturnType<typeof createUserSchema>>;
const roles = ['admin', 'moderator', 'employee', 'client'];

export type UserInput = {
	id?: string;
	name?: string;
	username?: string;
	email?: string;
	role?: string;
};

const UserForm = ({user}: { user?: UserInput }) => {
	const router = useRouter();
	const {createUser, updateUser, checkDuplicate, error} = useUserStore();
	const isUpdate = Boolean(user?.id);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const schema = isUpdate
		? updateUserSchema(checkDuplicate, user?.id)
		: createUserSchema(checkDuplicate);

	const form = useForm<UserFormData>({
		resolver: zodResolver(schema) as Resolver<UserFormData>,
		defaultValues: {
			name: user?.name ?? '',
			username: user?.username ?? '',
			email: user?.email ?? '',
			role: (user?.role ?? 'employee') as UserFormData['role'],
			password: '',
			confirmPassword: ''
		},
		mode: 'onChange'
	});

	const onSubmit = async (data: UserFormData) => {
		try {
			// Password is sent as plain text over HTTPS and hashed server-side
			// (see /api/users). Do not hash it here — hashing twice breaks login.
			const payload = {
				...data,
				password: data.password ? data.password : undefined
			};

			if (isUpdate) {
				await updateUser(user!.id!, payload);
			} else {
				await createUser(payload);
			}

			if (!error) {
				router.back();
				router.refresh();
			}
		} catch {
			toast.error('Something went wrong!');
		}
	};

	const t = useTranslations();
	const {dir} = useCheckedLocale();

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<div className="grid md:grid-cols-2 gap-2">
					<FormField
						control={form.control}
						name="name"
						render={({field}) => (
							<FormItem>
								<FormLabel>{t("Name")}</FormLabel>
								<FormControl>
									<Input placeholder={t("Full Name")} {...field} />
								</FormControl>
								<FormMessage/>
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="role"
						render={({field}) => (
							<FormItem>
								<FormLabel>{t("Role")}</FormLabel>
								<Select onValueChange={field.onChange} value={field.value}>
									<FormControl>
										<SelectTrigger className="w-full">
											<SelectValue placeholder={t("Select role")}/>
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{roles.map(role => (
											<SelectItem key={role} value={role}>
												{t(role)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage/>
							</FormItem>
						)}
					/>
				</div>
				<div className="grid md:grid-cols-2 gap-2">
					<FormField
						control={form.control}
						name="username"
						render={({field}) => (
							<FormItem>
								<FormLabel>{t("Username")}</FormLabel>
								<FormControl>
									<Input type="text" placeholder={t("Username")} {...field} />
								</FormControl>
								<FormMessage/>
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="email"
						render={({field}) => (
							<FormItem>
								<FormLabel>{t("Email")}</FormLabel>
								<FormControl>
									<Input type="email" placeholder={t("Email address")} {...field} />
								</FormControl>
								<FormMessage/>
							</FormItem>
						)}
					/>
				</div>
				<div className="grid md:grid-cols-2 gap-2">
					<FormField
						control={form.control}
						name="password"
						render={({field}) => (
							<FormItem>
								<FormLabel>{t("Password")}</FormLabel>
								<FormControl>
									<div className="relative">
										<Input
											type={showPassword ? 'text' : 'password'}
											placeholder="......"
											{...field}
										/>
										<span
											className={`absolute top-1/2 transform -translate-y-1/2 cursor-pointer text-muted-foreground ${dir === 'rtl'? 'left-2': 'right-2'}`}
											onClick={() => setShowPassword(prev => !prev)}
										>
								{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
							</span>
									</div>
								</FormControl>
								<FormMessage/>
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="confirmPassword"
						render={({field}) => (
							<FormItem>
								<FormLabel>{t("Confirm Password")}</FormLabel>
								<FormControl>
									<div className="relative ">
										<Input
											type={showConfirmPassword ? 'text' : 'password'}
											placeholder="......"
											{...field}
										/>
										<span
											className={`absolute top-1/2 transform -translate-y-1/2 cursor-pointer text-muted-foreground ${dir === 'rtl'? 'left-2': 'right-2'}`}
											onClick={() => setShowConfirmPassword(prev => !prev)}
										>
								{showConfirmPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
							</span>
									</div>
								</FormControl>
								<FormMessage/>
							</FormItem>
						)}
					/>
				</div>

				<Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
					{isUpdate ? `${t("Update User")}` : `${t("Create User")}`}
					{form.formState.isSubmitting && <Spinner className="mx-2"/>}
				</Button>
			</form>
		</Form>
	);
};

export default UserForm;
