import { db } from "@/drizzle/db";
import { contractInstallments, installmentPaymentProofs } from "@/drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { hasRole, isValidId } from "@/lib/utils";
import { z } from "zod";
import { authorizeProjectAccess } from "@/lib/project-permissions";

// ✅ Schema for creation
const createInstallmentSchema = z.object({
	installmentAmount: z.string(), // Use string to preserve decimal precision
	paidAmount: z.string().default("0.00"),
	paymentDate: z.string().optional(), // ISO date string
	notes: z.string().optional().default(""),
});

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string; contractId: string }> }
) {
	const { user } = await authenticate(req);
	const { id: projectId, contractId } = await params;

	if (!isValidId(projectId) || !isValidId(contractId)) {
		return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
	}

	if (!hasRole(user, ["admin", "moderator", "client", "employee"])) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const access = await authorizeProjectAccess({ user, projectId, action: "read" });
	if (!access.ok) {
		return NextResponse.json({ error: access.error }, { status: access.status });
	}

	try {
		// The payment-proof status is only meaningful to the employee who can act
		// on it; managers and the client do not see it (they cannot view the file).
		const isEmployeeViewer = user?.role === "employee";

		if (!isEmployeeViewer) {
			const installments = await db
				.select()
				.from(contractInstallments)
				.where(eq(contractInstallments.contractId, contractId));

			return NextResponse.json(installments);
		}

		const rows = await db
			.select({
				installment: contractInstallments,
				proofUploadedAt: installmentPaymentProofs.uploadedAt,
			})
			.from(contractInstallments)
			.leftJoin(
				installmentPaymentProofs,
				eq(installmentPaymentProofs.installmentId, contractInstallments.id)
			)
			.where(eq(contractInstallments.contractId, contractId));

		const installments = rows.map((row) => ({
			...row.installment,
			hasPaymentProof: row.proofUploadedAt !== null,
			paymentProofUploadedAt: row.proofUploadedAt,
		}));

		return NextResponse.json(installments);
	} catch (error) {
		console.error("GET /installments error:", error);
		return NextResponse.json({ error: "Failed to fetch installments" }, { status: 500 });
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string; contractId: string }> }
) {
	const { id: projectId, contractId } = await params;

	if (!isValidId(projectId) || !isValidId(contractId)) {
		return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	if (!hasRole(user, ["admin", "moderator"])) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = await req.json();
		const parsed = createInstallmentSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json({ error: "Invalid installment data", issues: parsed.error.errors }, { status: 400 });
		}
		const getNextInstallmentNo = async (contractId: string) => {
			const result = await db
				.select({ maxNo: sql<number>`MAX(${contractInstallments.installmentNo})` })
				.from(contractInstallments)
				.where(eq(contractInstallments.contractId, contractId))
				.limit(1);

			return (result[0]?.maxNo ?? 0) + 1;
		};

		const { installmentAmount, paidAmount, paymentDate, notes } = parsed.data;

		const installmentNo = await getNextInstallmentNo(contractId);

		const [inserted] = await db
			.insert(contractInstallments)
			.values({
				contractId,
				installmentNo,
				installmentAmount,
				paidAmount,
				paymentDate: paymentDate ? new Date(paymentDate) : null,
				notes: notes || null,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		return NextResponse.json(inserted);
	} catch (error) {
		console.error("POST /installments error:", error);
		return NextResponse.json({ error: "Failed to create installment" }, { status: 500 });
	}
}
