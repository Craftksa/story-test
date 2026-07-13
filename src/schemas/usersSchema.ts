import {z} from "zod";

type CheckDuplicate = (field: string, value: string, excludeId?: string) => unknown;

const passwordSchema = z
	.string()
	.min(6, 'Password must be at least 6 characters long')
	.refine((val) => !/\s/.test(val), {
		message: 'Password cannot contain spaces',
	});

const passwordUpdateSchema = z
	.string()
	.optional()
	.refine((val) => !val || val.length >= 6, {
		message: 'Password must be at least 6 characters long',
	})
	.refine((val) => !val || !/\s/.test(val), {
		message: 'Password cannot contain spaces',
	});


export const createUserSchema = (getOne: CheckDuplicate) =>
	z
		.object({
			name: z.string().min(2),
			username: z
				.string()
				.min(5, 'Username must be at least 5 characters long')
				.refine((val) => !/\s/.test(val), {
					message: 'Username cannot contain spaces',
				})
				.refine(async (username) => !(await getOne("username", username)), {
					message: 'Username already exists',
				}),
			email: z
				.string()
				.email()
				.refine(async (email) => !(await getOne("email", email)), {
					message: 'Email already exists'
				}),
			role: z.enum(['admin', 'moderator', 'employee', 'client']),
			password: passwordSchema,
			confirmPassword: passwordSchema
		})
		.refine((data) => data.password === data.confirmPassword, {
			message: 'Passwords do not match',
			path: ['confirmPassword']
		})

export const updateUserSchema = (getOne: CheckDuplicate, id: string | undefined) =>
	z.object({
		name: z.string().min(2),
			username: z
				.string()
				.min(5, 'Username must be at least 5 characters long')
				.refine((val) => !/\s/.test(val), {
					message: 'Username cannot contain spaces',
				})
				.refine(async (username) => {
					const existing = await getOne("username", username, id);
					return !existing;
				}, { message: 'Username already exists' }),
		email: z
			.string()
			.email()
			.refine(async (email) => {
				const existing = await getOne("email", email, id)
				return !existing
			}, {message: 'Email already exists'}),

		role: z.enum(['admin', 'moderator', 'employee', 'client']),
		password: passwordUpdateSchema,
		confirmPassword: passwordUpdateSchema
	}).refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	})
