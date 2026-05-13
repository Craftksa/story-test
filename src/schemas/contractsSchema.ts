import { z } from "zod";

export const createContractSchema = (getOne: any) =>
	z.object({
		contractorName: z
			.string()
			.min(2, "Contractor name is required"),
		description: z
			.string().optional(),
		contractedAmount: z
			.coerce.number({
				required_error: "Contracted amount is required",
				invalid_type_error: "Contracted amount must be a valid number",
			})
			.nonnegative("Amount must be non-negative")
			.refine(val => /^\d+(\.\d{1,2})?$/.test(val.toFixed(2)), {
				message: "Amount must be a decimal with up to 2 decimal places",
			}),
	});

export const updateContractSchema = (getOne: any, id?: string) =>
	z.object({
		contractorName: z
			.string()
			.min(2, "Contractor name is required"),
		description: z
			.string().optional(),
		contractedAmount: z
			.coerce.number({
				required_error: "Contracted amount is required",
				invalid_type_error: "Contracted amount must be a valid number",
			})
			.nonnegative("Amount must be non-negative")
			.refine(val => /^\d+(\.\d{1,2})?$/.test(val.toFixed(2)), {
				message: "Amount must be a decimal with up to 2 decimal places",
			}),
	});
