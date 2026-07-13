import { db } from "@/drizzle/db";
import { contracts, contractInstallments } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { isValidId, hasRole } from "@/lib/utils";

// GET: Fetch contract + installments
export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string; contractId: string }> }
) {
	const { id: projectId, contractId } = await params;

	if (!isValidId(projectId) || !isValidId(contractId)) {
		return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	if (!hasRole(user, ["admin", "moderator", "client"])) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const contract = await db
			.select()
			.from(contracts)
			.where(and(eq(contracts.id, contractId), eq(contracts.projectId, projectId)));

		if (!contract.length) {
			return NextResponse.json({ error: "Contract not found for this project" }, { status: 404 });
		}

		const installments = await db
			.select({
				id: contractInstallments.id,
				installmentNo: contractInstallments.installmentNo,
				installmentAmount: contractInstallments.installmentAmount,
				paidAmount: contractInstallments.paidAmount,
				paymentDate: contractInstallments.paymentDate,
				notes: contractInstallments.notes,
			})
			.from(contractInstallments)
			.where(eq(contractInstallments.contractId, contractId));

		return NextResponse.json({
			...contract[0],
			installments,
		});
	} catch (error) {
		console.error("GET /projects/[id]/contracts/[contractId] error:", error);
		return NextResponse.json({ error: "Failed to fetch contract details" }, { status: 500 });
	}
}

// PUT: Update contract fields
export async function PUT(
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

		const allowedFields = ["contractorName", "contractedAmount", "fileUrl", "description"] as const;
		const updates: Partial<typeof contracts.$inferInsert> = {};

		for (const field of allowedFields) {
			if (field in body) {
				updates[field] = body[field];
			}
		}

		await db
			.update(contracts)
			.set({
				...updates,
				updatedAt: new Date(),
			})
			.where(and(eq(contracts.id, contractId), eq(contracts.projectId, projectId)));

		return NextResponse.json({ message: "Contract updated" });
	} catch (error) {
		console.error("PUT /projects/[id]/contracts/[contractId] error:", error);
		return NextResponse.json({ error: "Failed to update contract" }, { status: 500 });
	}
}

// DELETE: Remove contract (installments cascade if foreign key is set)
export async function DELETE(
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
		const deleted = await db
			.delete(contracts)
			.where(and(eq(contracts.id, contractId), eq(contracts.projectId, projectId)));

		return NextResponse.json({ message: "Contract deleted", deleted });
	} catch (error) {
		console.error("DELETE /projects/[id]/contracts/[contractId] error:", error);
		return NextResponse.json({ error: "Failed to delete contract" }, { status: 500 });
	}
}
