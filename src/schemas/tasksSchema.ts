// /schemas/tasksSchema.ts

import { z } from "zod";

const statusEnum = z.enum([
	"not_started",
	"in_progress",
	"completed",
	"on_hold",
	"needs_review",
]);

const taskTypeEnum = z.enum(["foundations", "finishes"]);

const taskFormFieldsSchema = z
	.object({
		name: z
			.string()
			.min(2, "Task name is required"),
		type: taskTypeEnum,
		status: statusEnum,
		startDate: z.date().optional(),
		endDate: z.date().optional(),
		notes: z.string().optional(),
	})
	.refine(
		(values) =>
			!values.startDate ||
			!values.endDate ||
			values.endDate.getTime() >= values.startDate.getTime(),
		{
			path: ["endDate"],
			message: "End date must be on or after start date",
		}
	);

// Define the signature of your uniqueness check helper

// Schema for creating a new task
export const createTaskSchema = (getOne: any) =>
	taskFormFieldsSchema;

// Schema for updating an existing task
export const updateTaskSchema = (getOne: any, id?: string) =>
	taskFormFieldsSchema;
