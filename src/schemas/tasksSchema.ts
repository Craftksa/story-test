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

// Define the signature of your uniqueness check helper

// Schema for creating a new task
export const createTaskSchema = (getOne: any) =>
	z
		.object({
			name: z
				.string()
				.min(2, "Task name is required"),
			type: taskTypeEnum,
			status: statusEnum,
			startDate: z.date().optional(),
			endDate: z.date().optional(),
			notes: z.string().optional(),
		});

// Schema for updating an existing task
export const updateTaskSchema = (getOne: any, id?: string) =>
	z
		.object({
			name: z
				.string()
				.min(2, "Task name is required"),
			type: taskTypeEnum,
			status: statusEnum,
			startDate: z.date().optional(),
			endDate: z.date().optional(),
			notes: z.string().optional(),
		});
