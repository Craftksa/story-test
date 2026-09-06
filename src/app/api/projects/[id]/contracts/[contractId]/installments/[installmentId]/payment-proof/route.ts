import { NextRequest, NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { authenticate } from "@/lib/authenticate";
import { isValidId } from "@/lib/utils";
import { isAssignedToProject } from "@/lib/project-permissions";
import { chainMatchesPath, resolvePaymentProofAccess } from "@/lib/payment-proof-access";
import { getInstallmentChain, getPaymentProof } from "@/lib/payment-proof-db";

// GET: return a short-lived signed URL for the installment's private payment proof.
// Employee-only, end to end: same access rule as upload/replace. admin / moderator
// / client cannot reach this endpoint. Upload / replace is handled exclusively by
// the `paymentProofUploader` route.
export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string; contractId: string; installmentId: string }> }
) {
	const { id: projectId, contractId, installmentId } = await params;

	if (![projectId, contractId, installmentId].every(isValidId)) {
		return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
	}

	const { user } = await authenticate(req);

	const access = await resolvePaymentProofAccess(user, installmentId, {
		getInstallmentChain,
		isAssignedToProject,
	});
	if (!access.ok) {
		return NextResponse.json({ error: access.error }, { status: access.status });
	}

	// Reject a valid installment id combined with a mismatched contract/project
	// in the URL path (IDOR).
	if (!chainMatchesPath(access.chain, { contractId, projectId })) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const proof = await getPaymentProof(installmentId);
	if (!proof) {
		return NextResponse.json({ exists: false }, { status: 404 });
	}

	try {
		const utapi = new UTApi();
		const { ufsUrl } = await utapi.generateSignedURL(proof.fileKey, { expiresIn: 60 * 5 });

		return NextResponse.json({
			exists: true,
			url: ufsUrl,
			fileName: proof.fileName,
			fileSize: proof.fileSize,
			mimeType: proof.mimeType,
			uploadedAt: proof.uploadedAt,
			uploadedBy: proof.uploadedBy,
		});
	} catch (error) {
		console.error("GET /payment-proof error:", error);
		return NextResponse.json({ error: "Failed to generate download link" }, { status: 500 });
	}
}
