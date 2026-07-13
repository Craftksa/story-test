import { db } from "@/drizzle/db";
import { contractInstallments } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { isValidId, hasRole } from "@/lib/utils";

// ✅ GET: Get single installment by ID
export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string; contractId: string; installmentId: string }> }
) {
	const { id: projectId, contractId, installmentId } = await params;

	if (![projectId, contractId, installmentId].every(isValidId)) {
		return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	if (!hasRole(user, ["admin", "moderator", "client"])) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const [installment] = await db
			.select()
			.from(contractInstallments)
			.where(and(
				eq(contractInstallments.id, installmentId),
				eq(contractInstallments.contractId, contractId)
			));

		if (!installment) {
			return NextResponse.json({ error: "Installment not found" }, { status: 404 });
		}

		return NextResponse.json(installment);
	} catch (error) {
		console.error("GET /installment error:", error);
		return NextResponse.json({ error: "Failed to fetch installment" }, { status: 500 });
	}
}

// ✅ PUT: Update single installment
export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string; contractId: string; installmentId: string }> }
) {
	const { id: projectId, contractId, installmentId } = await params;

	if (![projectId, contractId, installmentId].every(isValidId)) {
		return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	if (!hasRole(user, ["admin", "moderator"])) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = await req.json();

		const updates: Partial<typeof contractInstallments.$inferInsert> = {
			installmentNo: body.installmentNo,
			installmentAmount: body.installmentAmount,
			paidAmount: body.paidAmount,
			paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
			notes: body.notes || null,
			updatedAt: new Date(),
		};

		await db
			.update(contractInstallments)
			.set(updates)
			.where(and(
				eq(contractInstallments.id, installmentId),
				eq(contractInstallments.contractId, contractId)
			));

		return NextResponse.json({ message: "Installment updated" });
	} catch (error) {
		console.error("PUT /installment error:", error);
		return NextResponse.json({ error: "Failed to update installment" }, { status: 500 });
	}
}

// ✅ DELETE: Remove installment
export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string; contractId: string; installmentId: string }> }
) {
	const { id: projectId, contractId, installmentId } = await params;

	if (![projectId, contractId, installmentId].every(isValidId)) {
		return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	if (!hasRole(user, ["admin", "moderator"])) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const deleted = await db
			.delete(contractInstallments)
			.where(and(
				eq(contractInstallments.id, installmentId),
				eq(contractInstallments.contractId, contractId)
			));

		return NextResponse.json({ message: "Installment deleted", deleted });
	} catch (error) {
		console.error("DELETE /installment error:", error);
		return NextResponse.json({ error: "Failed to delete installment" }, { status: 500 });
	}
}
