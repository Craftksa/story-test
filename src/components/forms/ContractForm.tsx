'use client';

import {useRouter} from 'next/navigation';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {useEffect} from 'react';
import {toast} from 'sonner';

import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import Spinner from '@/components/Spinner';
import {useContractStore} from '@/store/contractStore';
import {createContractSchema, updateContractSchema} from '@/schemas/contractsSchema';

import {Form, FormControl, FormField, FormItem, FormLabel, FormMessage} from '@/components/ui/form';
import {useTranslations} from "use-intl";
import { Textarea } from '../ui/textarea';

export type ContractFormData = z.infer<ReturnType<typeof createContractSchema>>;

const ContractForm = ({
	                  contract,
	                  projectId
                  }: {
	contract?: {
		id?: string;
		contractorName?: string;
		contractedAmount?: string | number;
		description?: string | null;
	};
	projectId: string;
}) => {
	const router = useRouter();
	const {
		createContract,
		updateContract,
		checkDuplicate,
		error,
		setProjectId
	} = useContractStore();

	const isUpdate = Boolean(contract?.id);

	useEffect(() => {
		setProjectId(projectId);
	}, [projectId, setProjectId]);

	const schema = isUpdate
		? updateContractSchema(checkDuplicate, contract?.id)
		: createContractSchema(checkDuplicate);

	const form = useForm<ContractFormData>({
		resolver: zodResolver(schema),
		defaultValues: {
			contractorName: contract?.contractorName ?? '',
			description: contract?.description ?? '',
			contractedAmount: contract?.contractedAmount ? Number(contract.contractedAmount) : undefined,
		},
		mode: 'onChange'
	});

	const onSubmit = async (data: ContractFormData) => {
		try {
			if (isUpdate) {
				await updateContract(contract!.id!, data);
				if (!error) {
					router.back();
					// router.push(`/projects/${projectId}/contracts/${contract?.id}`);
					router.refresh();
				}
			} else {
				const createdContract = await createContract(data);
				if (createdContract && createdContract.id) {
					router.back();
					// router.push(`/projects/${projectId}/contracts/${createdContract.id}`);
					router.refresh();
				}
			}
		} catch {
			toast.error('Something went wrong!');
		}
	};

	const t = useTranslations();
	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<div className="grid md:grid-cols-2 gap-2">

				<FormField
					control={form.control}
					name="contractorName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("Contractor Name")}</FormLabel>
							<FormControl>
								<Input placeholder={t("Enter contractor name")} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

					<FormField
						control={form.control}
						name="contractedAmount"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Contracted Amount")}</FormLabel>
								<FormControl>
									<Input placeholder={t("Enter contracted amount")} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<div className="md:col-span-2">
						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("Description")}</FormLabel>
									<FormControl>
										<Textarea placeholder={t("Write a description")} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

				</div>

				<Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
					{isUpdate ? `${t("Update Contract")}` : `${t("Create Contract")}`}
					{form.formState.isSubmitting && <Spinner className="mx-2" />}
				</Button>
			</form>
		</Form>
	);
};

export default ContractForm;
