'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

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
import { useTranslations } from 'use-intl';

import { useInstallmentStore } from '@/store/installmentStore';
import {
	createInstallmentSchema,
	updateInstallmentSchema
} from '@/schemas/installmentSchema';
import {CustomDatePicker} from "@/components/CustomDatePicker";

export type InstallmentFormData = z.infer<typeof createInstallmentSchema>;

type InstallmentInput = {
	id?: string;
	installmentAmount?: string;
	paidAmount?: string;
	paymentDate?: string | Date | null;
	notes?: string | null;
};

const InstallmentForm = ({
	                         installment,
	                         projectId,
	                         contractId
                         }: {
	installment?: InstallmentInput;
	projectId: string;
	contractId: string;
}) => {
	const router = useRouter();
	const {
		createInstallment,
		updateInstallment,
		error,
		setProjectId,
		setContractId
	} = useInstallmentStore();

	const isUpdate = Boolean(installment?.id);

	useEffect(() => {
		setProjectId(projectId);
		setContractId(contractId);
	}, [projectId, contractId, setProjectId, setContractId]);

	const schema = isUpdate
		? updateInstallmentSchema
		: createInstallmentSchema;

	const form = useForm<InstallmentFormData>({
		resolver: zodResolver(schema),
		defaultValues: {
			installmentAmount: installment?.installmentAmount ?? '',
			paidAmount: installment?.paidAmount ?? '',
			paymentDate: installment?.paymentDate
				? (installment.paymentDate instanceof Date ? installment.paymentDate : new Date(installment.paymentDate))
				: undefined,
			notes: installment?.notes ?? ''
		},
		mode: 'onChange'
	});

	const onSubmit = async (data: InstallmentFormData) => {
		try {
			if (isUpdate && installment?.id) {
				await updateInstallment(installment.id, data);
			} else {
				await createInstallment(data);
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
				<div className="grid md:grid-cols-2 gap-2">
					<FormField
						control={form.control}
						name="installmentAmount"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('Installment Amount')}</FormLabel>
								<FormControl>
									<Input type="number" placeholder={t('Enter installment amount')} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="paidAmount"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('Paid Amount')}</FormLabel>
								<FormControl>
									<Input type="number" placeholder={t('Enter paid amount')} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="paymentDate"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('Payment Date')}</FormLabel>
								<FormControl>
									<CustomDatePicker
										value={field.value}
										onChange={(date: Date | undefined) => field.onChange(date)}
										label={t('Payment Date')}
										placeholder={t('Select payment date')}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="notes"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('Notes')}</FormLabel>
								<FormControl>
									<Input placeholder={t('Write a note')} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
					{isUpdate ? t('Update Installment') : t('Create Installment')}
					{form.formState.isSubmitting && <Spinner className="mx-2" />}
				</Button>
			</form>
		</Form>
	);
};

export default InstallmentForm;
