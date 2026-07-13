'use client';

import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/Spinner';
import { useTaskStore } from '@/store/taskStore';
import { createTaskSchema, updateTaskSchema } from '@/schemas/tasksSchema';

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
import { CustomDatePicker } from '@/components/CustomDatePicker';
import {useTranslations} from "use-intl";
import {useState} from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

export type TaskFormData = z.infer<ReturnType<typeof createTaskSchema>>;

const statusOptions = ['not_started', 'in_progress', 'completed', 'on_hold', 'needs_review'] as const;
const taskTypeOptions = ['foundations', 'finishes'] as const;
const blockedReasonOptions = ['client_approval', 'client_documents', 'internal', 'external'] as const;
type BlockedReason = (typeof blockedReasonOptions)[number];

export type TaskInput = {
	id?: string;
	name?: string;
	type?: string;
	status?: string;
	startDate?: string | Date | null;
	endDate?: string | Date | null;
	notes?: string | null;
	dependsOnTaskId?: string | null;
	isMilestone?: boolean;
	blockedReason?: BlockedReason | null;
	blockedNote?: string | null;
};

function serializeTaskFormData(data: TaskFormData) {
	return {
		...data,
		startDate: data.startDate?.toISOString(),
		endDate: data.endDate?.toISOString(),
	};
}

const TaskForm = ({
	                  task,
	                  projectId
                  }: {
	task?: TaskInput;
	projectId: string;
}) => {
	const router = useRouter();
	const {
		createTask,
		updateTask,
		checkDuplicate,
		error,
		setProjectId
	} = useTaskStore();

	const isUpdate = Boolean(task?.id);

	const [blockedReason, setBlockedReason] = useState<BlockedReason | ''>(task?.blockedReason ?? '');
	const [blockedNote, setBlockedNote] = useState(task?.blockedNote ?? '');
	const [blockDialogOpen, setBlockDialogOpen] = useState(false);
	const [draftBlockedReason, setDraftBlockedReason] = useState<BlockedReason | ''>('');
	const [draftBlockedNote, setDraftBlockedNote] = useState('');

	useEffect(() => {
		setProjectId(projectId);
	}, [projectId, setProjectId]);

	const schema = isUpdate
		? updateTaskSchema(checkDuplicate, task?.id)
		: createTaskSchema(checkDuplicate);

	const form = useForm<TaskFormData>({
		resolver: zodResolver(schema) as Resolver<TaskFormData>,
		defaultValues: {
			name: task?.name ?? '',
			type: (task?.type ?? 'foundations') as TaskFormData['type'],
			status: (task?.status ?? 'not_started') as TaskFormData['status'],
			startDate: task?.startDate ? (task.startDate instanceof Date ? task.startDate : new Date(task.startDate)) : undefined,
			endDate: task?.endDate ? (task.endDate instanceof Date ? task.endDate : new Date(task.endDate)) : undefined,
			notes: task?.notes ?? ''
		},
		mode: 'onChange'
	});

	const onSubmit = async (data: TaskFormData) => {
		const payload: ReturnType<typeof serializeTaskFormData> & {
			blockedReason?: BlockedReason;
			blockedNote?: string;
		} = serializeTaskFormData(data);

		if (data.status === 'on_hold') {
			payload.blockedReason = blockedReason || undefined;
			payload.blockedNote = blockedNote;
		}

		try {
			if (isUpdate) {
				await updateTask(task!.id!, payload);
				if (!error) {
					router.back();
					// router.push(`/projects/${projectId}/tasks/${task?.id}`);
					router.refresh();
				}
			} else {
				const createdTask = await createTask(payload);
				if (createdTask && createdTask.id) {
					router.back();
					// router.push(`/projects/${projectId}/tasks/${createdTask.id}`);
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
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("Task Name")}</FormLabel>
							<FormControl>
								<Input placeholder={t("Enter task name")} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="grid md:grid-cols-2 gap-2">
					<FormField
						control={form.control}
						name="type"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Task Type")}</FormLabel>
								<Select onValueChange={field.onChange} value={field.value}>
									<FormControl>
										<SelectTrigger className="w-full">
											<SelectValue placeholder={t("Select task type")} />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{taskTypeOptions.map(type => (
											<SelectItem key={type} value={type}>
												{t(type)}
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
						name="status"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Status")}</FormLabel>
								<Select
									onValueChange={(value) => {
										if (value === 'on_hold' && field.value !== 'on_hold') {
											setDraftBlockedReason(blockedReason);
											setDraftBlockedNote(blockedNote);
											setBlockDialogOpen(true);
											return;
										}

										if (value !== 'on_hold') {
											setBlockedReason('');
											setBlockedNote('');
										}

										field.onChange(value);
									}}
									value={field.value}
								>
									<FormControl>
										<SelectTrigger className="w-full">
											<SelectValue placeholder={t("Select status")} />
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

								<Dialog
									open={blockDialogOpen}
									onOpenChange={(open) => {
										if (!open) setBlockDialogOpen(false);
									}}
								>
									<DialogContent>
										<DialogHeader>
											<DialogTitle>{t('Block Task')}</DialogTitle>
											<DialogDescription>
												{t('Provide a reason and note before placing this task on hold')}
											</DialogDescription>
										</DialogHeader>
										<div className="space-y-4">
											<div className="space-y-2">
												<FormLabel>{t('Blocked Reason')}</FormLabel>
												<Select
													value={draftBlockedReason}
													onValueChange={(value) => setDraftBlockedReason(value as BlockedReason)}
												>
													<SelectTrigger className="w-full">
														<SelectValue placeholder={t('Select a reason')} />
													</SelectTrigger>
													<SelectContent>
														{blockedReasonOptions.map((reason) => (
															<SelectItem key={reason} value={reason}>
																{t(reason)}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<div className="space-y-2">
												<FormLabel>{t('Blocked Note')}</FormLabel>
												<Textarea
													value={draftBlockedNote}
													onChange={(e) => setDraftBlockedNote(e.target.value)}
													placeholder={t('Describe why this task is blocked')}
												/>
											</div>
										</div>
										<DialogFooter>
											<Button type="button" variant="outline" onClick={() => setBlockDialogOpen(false)}>
												{t('Cancel')}
											</Button>
											<Button
												type="button"
												disabled={!draftBlockedReason || !draftBlockedNote.trim()}
												onClick={() => {
													setBlockedReason(draftBlockedReason);
													setBlockedNote(draftBlockedNote);
													field.onChange('on_hold');
													setBlockDialogOpen(false);
												}}
											>
												{t('Confirm')}
											</Button>
										</DialogFooter>
									</DialogContent>
								</Dialog>
							</FormItem>
						)}
					/>
				</div>

				<div className="grid md:grid-cols-2 gap-2">
					<FormField
						control={form.control}
						name="startDate"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Start Date")}</FormLabel>
								<FormControl>
									<CustomDatePicker
										value={field.value}
										onChange={(date) => field.onChange(date)}
										label="Start Date"
										placeholder={t("Select start date")}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="endDate"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("End Date")}</FormLabel>
								<FormControl>
									<CustomDatePicker
										value={field.value}
										onChange={(date) => field.onChange(date)}
										label="End Date"
										placeholder={t("Select end date")}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<FormField
					control={form.control}
					name="notes"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("Notes")}</FormLabel>
							<FormControl>
								<Textarea placeholder={t("Task notes (optional)")} rows={4} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
					{isUpdate ? `${t("Update Task")}` : `${t("Create Task")}`}
					{form.formState.isSubmitting && <Spinner className="mx-2" />}
				</Button>
			</form>
		</Form>
	);
};

export default TaskForm;
