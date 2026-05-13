import { z } from 'zod';

export const createInstallmentSchema = z.object({
	installmentAmount: z
		.string({ required_error: 'Installment amount is required' })
		.min(1, 'Installment amount cannot be empty'),
	paidAmount: z
		.string({ required_error: 'Paid amount is required' })
		.min(1, 'Paid amount cannot be empty'),
	notes: z.string().optional(),
	paymentDate: z.date().optional(), // ✅ fixed type
});

export const updateInstallmentSchema = createInstallmentSchema.extend({
	// you can optionally add stricter checks or required `id` here if needed
});

export type CreateInstallmentInput = z.infer<typeof createInstallmentSchema>;
export type UpdateInstallmentInput = z.infer<typeof updateInstallmentSchema>;
