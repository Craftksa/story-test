import { db } from "@/drizzle/db";
import { contractInstallments, contracts, installmentPaymentProofs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import type { InstallmentChain } from "@/lib/payment-proof-access";

/**
 * Resolve installment -> contract -> project straight from the database.
 * `contracts.project_id` is NOT NULL so no join to `project` is required.
 */
export async function getInstallmentChain(installmentId: string): Promise<InstallmentChain | null> {
	const [row] = await db
		.select({
			installmentId: contractInstallments.id,
			contractId: contracts.id,
			projectId: contracts.projectId,
		})
		.from(contractInstallments)
		.innerJoin(contracts, eq(contractInstallments.contractId, contracts.id))
		.where(eq(contractInstallments.id, installmentId))
		.limit(1);

	return row ?? null;
}

export async function getPaymentProof(installmentId: string) {
	const [proof] = await db
		.select()
		.from(installmentPaymentProofs)
		.where(eq(installmentPaymentProofs.installmentId, installmentId))
		.limit(1);

	return proof ?? null;
}
