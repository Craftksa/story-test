/**
 * Runnable locally with: `npm test`  (uses the Node built-in test runner + type stripping).
 *
 * Covers the authorization / validation decisions for the installment
 * payment-proof feature. The DB and UploadThing SDK are not involved — the DB
 * lookups are injected, so every branch runs without a database.
 *
 * NOT covered here (needs a live Postgres + a private-ACL UploadThing app):
 *  - the `SELECT ... FOR UPDATE` row lock and the replace transaction in
 *    `onUploadComplete`
 *  - a real private upload + signed-URL round-trip
 * The decision that drives the replace ("which key to delete, and when") is
 * covered via `keyToDeleteAfterCommit`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
	PAYMENT_PROOF_MAX_BYTES,
	chainMatchesPath,
	hasPdfMagic,
	isAcceptablePaymentProofMeta,
	keyToDeleteAfterCommit,
	resolvePaymentProofAccess,
	type InstallmentChain,
	type ProofAccessDeps,
} from "./payment-proof-access.ts";

const CHAIN: InstallmentChain = {
	installmentId: "inst_1",
	contractId: "con_1",
	projectId: "proj_1",
};

const ASSIGNED_EMPLOYEE = "emp_assigned";

function deps(over: Partial<ProofAccessDeps> = {}): ProofAccessDeps {
	return {
		getInstallmentChain: async (id) => (id === CHAIN.installmentId ? CHAIN : null),
		isAssignedToProject: async (_projectId, userId) => userId === ASSIGNED_EMPLOYEE,
		...over,
	};
}

test("assigned employee → granted", async () => {
	const res = await resolvePaymentProofAccess(
		{ id: ASSIGNED_EMPLOYEE, role: "employee" },
		"inst_1",
		deps()
	);
	assert.equal(res.ok, true);
	assert.deepEqual(res.ok && res.chain, CHAIN);
	assert.equal(res.ok && res.userId, ASSIGNED_EMPLOYEE);
});

test("employee not assigned to the project → 403", async () => {
	const res = await resolvePaymentProofAccess(
		{ id: "emp_other", role: "employee" },
		"inst_1",
		deps()
	);
	assert.deepEqual(res, { ok: false, status: 403, error: "Forbidden" });
});

for (const role of ["admin", "moderator"] as const) {
	test(`${role} → granted without a project_assignment (global manager)`, async () => {
		const res = await resolvePaymentProofAccess(
			{ id: `u_${role}`, role },
			"inst_1",
			// isAssignedToProject only returns true for ASSIGNED_EMPLOYEE, so passing
			// here proves no assignment row is required for admin / moderator.
			deps()
		);
		assert.equal(res.ok, true);
		assert.deepEqual(res.ok && res.chain, CHAIN);
		assert.equal(res.ok && res.userId, `u_${role}`);
	});
}

test("client → 403", async () => {
	const res = await resolvePaymentProofAccess({ id: "u_client", role: "client" }, "inst_1", deps());
	assert.deepEqual(res, { ok: false, status: 403, error: "Forbidden" });
});

test("unknown / missing role → 403", async () => {
	const res = await resolvePaymentProofAccess({ id: "u_x", role: null }, "inst_1", deps());
	assert.equal(res.ok === false && res.status, 403);
});

test("unauthenticated (null user) → 401", async () => {
	const res = await resolvePaymentProofAccess(null, "inst_1", deps());
	assert.deepEqual(res, { ok: false, status: 401, error: "Unauthorized" });
});

test("authenticated but no id → 401", async () => {
	const res = await resolvePaymentProofAccess({ role: "employee" }, "inst_1", deps());
	assert.equal(res.ok === false && res.status, 401);
});

test("installment does not exist → 404", async () => {
	const res = await resolvePaymentProofAccess(
		{ id: ASSIGNED_EMPLOYEE, role: "employee" },
		"missing",
		deps()
	);
	assert.deepEqual(res, { ok: false, status: 404, error: "Installment not found" });
});

test("empty installment id → 404 (no DB call)", async () => {
	let called = false;
	const res = await resolvePaymentProofAccess(
		{ id: ASSIGNED_EMPLOYEE, role: "employee" },
		"",
		deps({
			getInstallmentChain: async () => {
				called = true;
				return CHAIN;
			},
		})
	);
	assert.equal(res.ok, false);
	assert.equal(called, false);
});

test("IDOR: valid installment id + wrong contract/project in path → rejected", () => {
	assert.equal(chainMatchesPath(CHAIN, { contractId: "con_1", projectId: "proj_1" }), true);
	assert.equal(chainMatchesPath(CHAIN, { contractId: "con_OTHER", projectId: "proj_1" }), false);
	assert.equal(chainMatchesPath(CHAIN, { contractId: "con_1", projectId: "proj_OTHER" }), false);
});

test("file meta: valid PDF under 8MB accepted", () => {
	assert.equal(isAcceptablePaymentProofMeta({ type: "application/pdf", size: 1024 }), true);
	assert.equal(
		isAcceptablePaymentProofMeta({ type: "application/pdf", size: PAYMENT_PROOF_MAX_BYTES }),
		true
	);
});

test("file meta: wrong MIME rejected", () => {
	assert.equal(isAcceptablePaymentProofMeta({ type: "image/png", size: 1024 }), false);
	assert.equal(isAcceptablePaymentProofMeta({ type: "application/octet-stream", size: 1024 }), false);
});

test("file meta: over 8MB rejected", () => {
	assert.equal(
		isAcceptablePaymentProofMeta({ type: "application/pdf", size: PAYMENT_PROOF_MAX_BYTES + 1 }),
		false
	);
});

test("file meta: empty file rejected", () => {
	assert.equal(isAcceptablePaymentProofMeta({ type: "application/pdf", size: 0 }), false);
});

test("magic header: real %PDF- prefix accepted, spoofed content rejected", () => {
	const enc = new TextEncoder();
	assert.equal(hasPdfMagic(enc.encode("%PDF-1.7\n...")), true);
	// A PNG / ZIP (docx) renamed to .pdf with a forced application/pdf MIME:
	assert.equal(hasPdfMagic(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), false);
	assert.equal(hasPdfMagic(enc.encode("PK")), false);
	assert.equal(hasPdfMagic(enc.encode("%PD")), false); // too short
});

test("replace: previous file deleted only when it differs from the new key", () => {
	assert.equal(keyToDeleteAfterCommit("old_key", "new_key"), "old_key");
	assert.equal(keyToDeleteAfterCommit(null, "new_key"), null); // first upload, nothing to delete
	assert.equal(keyToDeleteAfterCommit("same_key", "same_key"), null);
	assert.equal(keyToDeleteAfterCommit(undefined, "new_key"), null);
});
