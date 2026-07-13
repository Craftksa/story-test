'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {useEffect, useState} from 'react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/Spinner';
import { useProjectStore } from '@/store/projectStore';
import { createProjectSchema, updateProjectSchema } from '@/schemas/projectsSchema';
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
import { Textarea } from '@/components/ui/textarea';
import { CustomDatePicker } from '../CustomDatePicker';
import {useUserStore} from "@/store/userStore";
import { UserCombobox } from '../CustomUserComboBox';
import { UserMultiSelector } from '../CustomFancyMultiSelector';
import { useTranslations } from 'next-intl';

export type ProjectFormData = z.infer<ReturnType<typeof createProjectSchema>>;

export type ProjectInput = {
	id?: string;
	name?: string;
	status?: string;
	city?: string;
	district?: string;
	projectType?: string;
	startDate?: string | Date | null;
	endDate?: string | Date | null;
	description?: string | null;
	clientId?: string | null;
	designer?: string | null;
	assignedTo?: string[];
};

const statusOptions = ['not_started', 'in_progress', 'completed', 'on_hold', 'needs_review'] as const;
const cityDistrictMap: Record<string, string[]> = {
	Riyadh: ['Al Olaya', 'Al Malqa', 'Al Murabba', 'Al Malaz'],
	Jeddah: ['Al Hamra', 'Al Rawdah', 'Al Salamah', 'Al Faisaliyah'],
	'Al Qasim': ['City Center', 'Al Nairyah'],
	Dammam: ['Al Faisaliyah', 'Al Khalij', 'Al Shate’a'],
	Khobar: ['Al Nakheel', 'Al Huwailah', 'Al Jubail'],
	Mecca: ['Ajyad', 'Al Faisaliah', 'Al Aziziyah'],
	Medina: ['Al Haram', 'Al Ansar', 'Al Noor'],
	Tabuk: ['Al Rabi', 'Al Amal', 'Al Khalidiyah'],
	Abha: ['Al Muheet', 'Al Andalus', 'Al Sharq'],
	Hail: ['Al Shifa', 'Al Amir', 'Al Aziziyah'],
};

const cities = Object.keys(cityDistrictMap);

const ProjectForm = ({ project }: { project?: ProjectInput }) => {
	const router = useRouter();
	const { createProject, updateProject, checkDuplicate, error } = useProjectStore();
	const { fetchUsers, users } = useUserStore();
	const isUpdate = Boolean(project?.id);
	const [, setSelectedCity] = useState(project?.city ?? '');

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers])

	const clients = users.filter((user) => user.role === "client").map((user) => ({
		label: user.name,
		value: user.id,
	}))

	const employees = users
		.filter((user) => user.role === "employee" || user.role === "moderator")
		.map((user) => ({
			label: user.name,
			value: user.id,
		}))

	const schema = isUpdate
		? updateProjectSchema(checkDuplicate, project?.id)
		: createProjectSchema(checkDuplicate);

	const form = useForm<ProjectFormData>({
		resolver: zodResolver(schema),
		defaultValues: {
			name: project?.name ?? '',
			status: (project?.status ?? 'not_started') as ProjectFormData['status'],
			city: project?.city ?? '',
			district: project?.district ?? '',
			projectType: project?.projectType ?? '',
			startDate: project?.startDate ? new Date(project.startDate) : undefined,
			endDate: project?.endDate ? new Date(project.endDate) : undefined,
			description: project?.description ?? '',
			clientId: project?.clientId ?? '',
			designer: project?.designer ?? '',
			assignedTo: project?.assignedTo ?? [],
		},
		mode: 'onChange'
	});

	const onSubmit = async (data: ProjectFormData) => {
		try {
			if (isUpdate) {
				await updateProject(project!.id!, data);
			} else {
				await createProject(data);
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

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<div className="grid md:grid-cols-4 gap-2">
					<div className="col-span-2">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('Project Name')}</FormLabel>
									<FormControl>
										<Input placeholder={t('Project Name')} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
					<FormField
						control={form.control}
						name="status"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('Status')}</FormLabel>
								<Select onValueChange={field.onChange} value={field.value}>
									<FormControl>
										<SelectTrigger className="w-full">
											<SelectValue placeholder={t('Select status')} />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{statusOptions.map(status => (
											<SelectItem key={status} value={status}>
												{t(status)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="projectType"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('Project Type')}</FormLabel>
								<FormControl>
									<Input placeholder={t('Project Type')} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2">
					<FormField
						control={form.control}
						name="city"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("City")}</FormLabel>
								<Select
									onValueChange={(value) => {
										field.onChange(value);
										setSelectedCity(value); // update selected city
										form.setValue('district', ''); // reset district when city changes
									}}
									value={field.value}
								>
									<FormControl>
										<SelectTrigger className="w-full">
											<SelectValue placeholder={t('Select city')} />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{cities.map(city => (
											<SelectItem key={city} value={city}>
												{t(city)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="district"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('District')}</FormLabel>
								<FormControl>
									<Input placeholder={t('District')} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
							// <FormItem>
							// 	<FormLabel>{t('District')}</FormLabel>
							// 	<Select onValueChange={field.onChange} value={field.value}>
							// 		<FormControl>
							// 			<SelectTrigger className="w-full">
							// 				<SelectValue placeholder={t("Select district")} />
							// 			</SelectTrigger>
							// 		</FormControl>
							// 		<SelectContent>
							// 			{selectedCity ?
							// 				cityDistrictMap[selectedCity]?.map((district) => (
							// 					<SelectItem key={district} value={district}>
							// 						{t(district)}
							// 					</SelectItem>
							// 				)) : <div className="p-2 text-center text-sm">{t('Select a city')}</div>}
							// 		</SelectContent>
							// 	</Select>
							// 	<FormMessage />
							// </FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="startDate"
						render={({field}) => (
							<FormItem>
								<FormLabel>{t("Start Date")}</FormLabel>
								<FormControl>
									<CustomDatePicker
										value={field.value}
										onChange={(date: Date | undefined) => field.onChange(date)}
										label={t('Start Date')}
										placeholder={t('Select start date')}
									/>
								</FormControl>
								<FormMessage/>
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="endDate"
						render={({field}) => (
							<FormItem>
								<FormLabel>{t("End Date")}</FormLabel>
								<FormControl>
									<CustomDatePicker
										value={field.value}
										onChange={(date: Date | undefined) => field.onChange(date)}
										label={t("End Date")}
										placeholder={t("Select end date")}
									/>
								</FormControl>
								<FormMessage/>
							</FormItem>
						)}
					/>
				</div>

				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t('Description')}</FormLabel>
							<FormControl>
								<Textarea placeholder={t('Project description')} rows={4} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="grid md:grid-cols-2 gap-2">
					<FormField
						control={form.control}
						name="clientId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Client")}</FormLabel>
								<FormControl>
									<UserCombobox
										title={t("Client")}
										options={clients}
										selectedValue={field.value}
										onChange={field.onChange}
										placeholder={t("Select client")}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="designer"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Designer")}</FormLabel>
								<FormControl>
									<Input placeholder={t("Designer")} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
				<FormField
					control={form.control}
					name="assignedTo"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("Assigned Employees")}</FormLabel>
							<FormControl>
								<UserMultiSelector
									title={t("users")}
									options={employees}
									selectedValues={field.value || []}
									onChange={(values) => {
										field.onChange(values);
									}}
									placeholder={t("Select employees")}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
					{isUpdate ? `${t("Update Project")}` : `${t("Create Project")}`}
					{form.formState.isSubmitting && <Spinner className="mx-2" />}
				</Button>
			</form>
		</Form>
	);
};

export default ProjectForm;
