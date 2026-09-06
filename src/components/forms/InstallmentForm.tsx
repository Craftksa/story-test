'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { FileText, Paperclip, X } from 'lucide-react';

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

import { hasRole } from '@/lib/utils';
import { uploadFiles } from '@/utils/uploadthing';
import { useInstallmentStore } from '@/store/installmentStore';
import {
	createInstallmentSchema,
	updateInstallmentSchema
} from '@/schemas/installmentSchema';
import {CustomDatePicker} from "@/components/CustomDatePicker";

export type InstallmentFormData = z.infer<typeof createInstallmentSchema>;

// Payment proof: PDF only, 8MB (mirrors the `paymentProofUploader` route limits).
const PROOF_MAX_BYTES = 8 * 1024 * 1024;
const PROOF_MIME = 'application/pdf';

type InstallmentInput = {
	id?: string;
	installmentAmount?: string;
	paidAmount?: string;
	paymentDate?: string | Date | null;
	notes?: string | null;
};

type SubmitPhase = 'idle' | 'creating' | 'uploading';

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
	const t = useTranslations();
	const {
		createInstallment,
		updateInstallment,
		error,
		setProjectId,
		setContractId
	} = useInstallmentStore();

	const { data: session } = useSession();
	// Same rule as the payment-proof route: admin / moderator / employee, never client.
	const canAttachProof = hasRole(session?.user, ['admin', 'moderator', 'employee']);

	const isUpdate = Boolean(installment?.id);

	const proofInputRef = useRef<HTMLInputElement>(null);
	const [proofFile, setProofFile] = useState<File | null>(null);
	const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('idle');
	const isBusy = submitPhase !== 'idle';

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

	const handleProofSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;

		if (file.type !== PROOF_MIME) {
			toast.error(t('Only PDF files are allowed'));
			return;
		}
		if (file.size > PROOF_MAX_BYTES) {
			toast.error(t('File size must be less than 8MB'));
			return;
		}
		setProofFile(file);
	};

	const removeProof = () => {
		if (isBusy) return;
		setProofFile(null);
	};

	const onSubmit = async (data: InstallmentFormData) => {
		// Update keeps the existing behaviour untouched.
		if (isUpdate && installment?.id) {
			try {
				await updateInstallment(installment.id, data);
				if (!error) {
					router.back();
					router.refresh();
				}
			} catch {
				toast.error(t('Something went wrong'));
			}
			return;
		}

		// 1) Create the installment first. Only touch the proof after it succeeds.
		setSubmitPhase('creating');
		let newInstallmentId: string | undefined;
		try {
			const created = await createInstallment(data);
			newInstallmentId = created ? created.id : undefined;
		} catch {
			setSubmitPhase('idle');
			toast.error(t('Something went wrong'));
			return;
		}

		if (!newInstallmentId) {
			// createInstallment already surfaced the failure toast.
			setSubmitPhase('idle');
			return;
		}

		// 2) Optional proof — reuse the existing paymentProofUploader route.
		if (proofFile) {
			setSubmitPhase('uploading');
			try {
				await uploadFiles('paymentProofUploader', {
					files: [proofFile],
					input: { installmentId: newInstallmentId },
				});
			} catch (err) {
				console.error('Payment proof upload failed:', err);
				// The installment stays; the proof can be added later from its row.
				toast.error(t('Installment created, but the payment proof could not be uploaded'));
			}
		}

		setSubmitPhase('idle');
		router.back();
		router.refresh();
	};

	const submitLabel = isUpdate
		? t('Update Installment')
		: submitPhase === 'creating'
			? t('Creating installment')
			: submitPhase === 'uploading'
				? t('Uploading payment proof')
				: t('Create Installment');

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

				{canAttachProof && !isUpdate && (
					<div className="space-y-2">
						<p className="text-sm font-medium leading-none">
							{t('Attach payment proof (PDF)')}{' '}
							<span className="text-xs font-normal text-muted-foreground">({t('Optional')})</span>
						</p>

						{proofFile ? (
							<div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
								<span className="flex min-w-0 items-center gap-2">
									<FileText className="h-4 w-4 shrink-0 text-red-500" />
									<span className="truncate">{proofFile.name}</span>
								</span>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-7 w-7 shrink-0"
									disabled={isBusy}
									onClick={removeProof}
									aria-label={t('Remove')}
								>
									<X className="h-4 w-4 text-destructive" />
								</Button>
							</div>
						) : (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="flex items-center gap-2"
								disabled={isBusy}
								onClick={() => proofInputRef.current?.click()}
							>
								<Paperclip className="h-4 w-4" />
								{t('Choose PDF file')}
							</Button>
						)}

						<input
							ref={proofInputRef}
							type="file"
							accept="application/pdf"
							className="hidden"
							onChange={handleProofSelect}
							disabled={isBusy}
						/>
					</div>
				)}

				<Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
					{submitLabel}
					{form.formState.isSubmitting && <Spinner className="mx-2" />}
				</Button>
			</form>
		</Form>
	);
};

export default InstallmentForm;
