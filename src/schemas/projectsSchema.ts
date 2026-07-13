import { z } from 'zod';

const statusEnum = z.enum(['not_started', 'in_progress', 'completed', 'on_hold', 'needs_review']);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const createProjectSchema = (getOne: unknown) =>
	z.object({
		name: z.string().min(2, 'Project name is required'),
		status: statusEnum,
		city: z.string().min(1, 'City is required'),
		district: z.string().min(1, 'District is required'),
		projectType: z.string().min(1, "Project Type is required"),
		startDate: z.date().optional(),
		endDate: z.date().optional(),
		description: z.string().optional(),
		clientId: z.string().min(1, 'Client is required'),
		designer: z.string().min(1, 'Designer is required'),
		assignedTo: z.array(z.string()).optional(),
	});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const updateProjectSchema = (getOne: unknown, id: string | undefined) =>
	z.object({
		name: z.string().min(2, 'Project name is required'),
		status: statusEnum,
		city: z.string().min(1, 'City is required'),
		district: z.string().min(1, 'District is required'),
		projectType: z.string().min(1, "Project Type is required"),
		startDate: z.date().optional(),
		endDate: z.date().optional(),
		description: z.string().optional(),
		clientId: z.string().min(1, 'Client is required'),
		designer: z.string().min(1, 'Designer is required'),
		assignedTo: z.array(z.string()).optional(),
	});
