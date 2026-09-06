import { contracts, contractInstallments } from "@/drizzle/schema";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle/db";
import { z } from "zod";
import { authenticate } from "@/lib/authenticate";
import { hasRole, isValidId } from "@/lib/utils";
import { eq, inArray } from "drizzle-orm";
import { authorizeProjectAccess } from "@/lib/project-permissions";

// ✅ Contract schema validation
const createContractSchema = z.object({
	contractorName: z.string(),
	contractedAmount: z.number(), // Assuming decimal is passed as string
	description: z.string().optional(),
	fileUrl: z.string().url().optional(),
});

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: projectId } = await params;

	if (!isValidId(projectId)) {
		return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
	}

	const { user } = await authenticate(req);
	if (!hasRole(user, ["admin", "moderator"])) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const body = await req.json();
	const parsed = createContractSchema.safeParse(body);

	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid contract data", issues: parsed.error.errors }, { status: 400 });
	}

	const { contractorName, contractedAmount, fileUrl, description } = parsed.data;

	const [contract] = await db.insert(contracts).values({
		projectId,
		contractorName,
		contractedAmount: contractedAmount.toString(),
		description: description || '',
		fileUrl: fileUrl || null,
		createdAt: new Date(),
		updatedAt: new Date(),
	}).returning();

	return NextResponse.json(contract);
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { user } = await authenticate(req);
	const { id: projectId } = await params;

	if (!hasRole(user, ["admin", "moderator", "client", "employee"])) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	if (!isValidId(projectId)) {
		return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
	}

	const access = await authorizeProjectAccess({ user, projectId, action: "read" });
	if (!access.ok) {
		return NextResponse.json({ error: access.error }, { status: access.status });
	}

	const contractList = await db
		.select()
		.from(contracts)
		.where(eq(contracts.projectId, projectId));

	const contractIds = contractList.map((c) => c.id);

	let installments: {
		contractId: string;
		installmentNo: number;
		installmentAmount: string;
		paidAmount: string;
		paymentDate: Date | null;
		notes: string | null;
	}[] = [];

	if (contractIds.length > 0) {
		installments = await db
			.select({
				contractId: contractInstallments.contractId,
				installmentNo: contractInstallments.installmentNo,
				installmentAmount: contractInstallments.installmentAmount,
				paidAmount: contractInstallments.paidAmount,
				paymentDate: contractInstallments.paymentDate,
				notes: contractInstallments.notes,
			})
			.from(contractInstallments)
			.where(inArray(contractInstallments.contractId, contractIds));
	}

	const installmentMap: Record<string, typeof installments> = {};
	for (const item of installments) {
		if (!installmentMap[item.contractId]) {
			installmentMap[item.contractId] = [];
		}
		installmentMap[item.contractId].push(item);
	}

	// Assigned employees only get what the payment-proof workflow needs; contract
	// financials and the contract document stay with managers and the client.
	const isEmployeeViewer = user?.role === "employee";

	const result = contractList.map((contract) => ({
		id: contract.id,
		contractorName: contract.contractorName,
		...(isEmployeeViewer
			? {}
			: {
					contractedAmount: contract.contractedAmount,
					description: contract.description,
					fileUrl: contract.fileUrl,
				}),
		createdAt: contract.createdAt,
		updatedAt: contract.updatedAt,
		installments: installmentMap[contract.id] || [],
	}));

	return NextResponse.json(result);
}
