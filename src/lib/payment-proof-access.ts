/**
 * Pure authorization / validation helpers for the installment payment-proof feature.
 *
 * This module has NO database or SDK imports on purpose so it can be unit-tested
 * with `node --test` without a database. The DB queries are injected as `deps`.
 *
 * Rule enforced here (backend, end to end): a payment proof can only be
 * uploaded, replaced, viewed or downloaded by an *employee assigned to the
 * project that owns the installment*. admin / moderator / client have no access.
 */

export const PAYMENT_PROOF_MAX_BYTES = 8 * 1024 * 1024;
export const PAYMENT_PROOF_MIME = "application/pdf";
export const PDF_MAGIC = "%PDF-";

export type ProofActor = { id?: string | null; role?: string | null } | null | undefined;

export type InstallmentChain = {
	installmentId: string;
	contractId: string;
	projectId: string;
};

export type ProofAccessDeps = {
	getInstallmentChain: (installmentId: string) => Promise<InstallmentChain | null>;
	isAssignedToProject: (projectId: string, userId: string) => Promise<boolean>;
};

export type ProofAccessResult =
	| { ok: true; chain: InstallmentChain; userId: string }
	| { ok: false; status: 401 | 403 | 404; error: string };

export async function resolvePaymentProofAccess(
	actor: ProofActor,
	installmentId: string,
	deps: ProofAccessDeps
): Promise<ProofAccessResult> {
	if (!actor?.id) {
		return { ok: false, status: 401, error: "Unauthorized" };
	}

	// Employee-only, no exceptions (segregation of duties).
	if (actor.role !== "employee") {
		return { ok: false, status: 403, error: "Only employees can access payment proofs" };
	}

	if (!installmentId) {
		return { ok: false, status: 404, error: "Installment not found" };
	}

	// The client only ever supplies an installment id. Its contract + project are
	// resolved from the database (IDOR guard).
	const chain = await deps.getInstallmentChain(installmentId);
	if (!chain) {
		return { ok: false, status: 404, error: "Installment not found" };
	}

	const assigned = await deps.isAssignedToProject(chain.projectId, actor.id);
	if (!assigned) {
		return { ok: false, status: 403, error: "Forbidden" };
	}

	return { ok: true, chain, userId: actor.id };
}

/**
 * Guards against an IDOR where a valid installment id is combined with a
 * contract/project id from a different contract in the request path.
 */
export function chainMatchesPath(
	chain: InstallmentChain,
	path: { contractId: string; projectId: string }
): boolean {
	return chain.contractId === path.contractId && chain.projectId === path.projectId;
}

export function isAcceptablePaymentProofMeta(file: { type: string; size: number }): boolean {
	return (
		file.type === PAYMENT_PROOF_MIME &&
		Number.isFinite(file.size) &&
		file.size > 0 &&
		file.size <= PAYMENT_PROOF_MAX_BYTES
	);
}

export function hasPdfMagic(head: Uint8Array): boolean {
	if (head.length < 5) return false;
	return Buffer.from(head.subarray(0, 5)).toString("latin1") === PDF_MAGIC;
}

/**
 * On replace, the previous stored file must be removed only *after* the DB
 * transaction commits, and never if it is the same key we just wrote.
 */
export function keyToDeleteAfterCommit(
	previousKey: string | null | undefined,
	newKey: string
): string | null {
	return previousKey && previousKey !== newKey ? previousKey : null;
}
