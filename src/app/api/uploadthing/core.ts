import {createUploadthing, type FileRouter} from "uploadthing/next";
import {UploadThingError, UTApi} from "uploadthing/server";
import {auth} from "@/auth";
import {contractInstallments, contracts, installmentPaymentProofs, taskImages, tasks} from "@/drizzle/schema"; // your actual auth import
import {db} from "@/drizzle/db";
import {z} from "zod";
import {eq} from "drizzle-orm";
import { hasRole } from "@/lib/utils";
import { authorizeProjectAccess, isAssignedToProject } from "@/lib/project-permissions";
import type { AuthenticatedUser } from "@/lib/authenticate";
import { getInstallmentChain } from "@/lib/payment-proof-db";
import {
	hasPdfMagic,
	isAcceptablePaymentProofMeta,
	keyToDeleteAfterCommit,
	resolvePaymentProofAccess,
} from "@/lib/payment-proof-access";

const f = createUploadthing();

export const ourFileRouter = {
	imageUploader: f({
		image: {
			maxFileSize: "4MB",
			maxFileCount: 50,
		},
	})
		.input(
			z.object({
				taskId: z.string().min(1),
				description: z.string().optional(),
				uploadedAt: z.string().optional(), // ISO string from client
			})
		)

		.middleware(async ({ input }) => {
			const session = await auth(); // next-auth session
			if (!session?.user?.id) throw new UploadThingError("Unauthorized");

			const task = await db
				.select({ id: tasks.id, projectId: tasks.projectId })
				.from(tasks)
				.where(eq(tasks.id, input.taskId))
				.limit(1);

			if (!task[0]) throw new UploadThingError("Task not found");

			const access = await authorizeProjectAccess({
				user: session.user as unknown as AuthenticatedUser,
				projectId: task[0].projectId,
				action: "upload",
			});

			if (!access.ok) throw new UploadThingError(access.error);

			return {
				userId: session.user.id,
				taskId: task[0].id,
				projectId: task[0].projectId,
				description: input.description ?? "",
				uploadedAt: input.uploadedAt
			};
		})
		.onUploadComplete(async ({ metadata, file }) => {
			await db.insert(taskImages).values({
				taskId: metadata.taskId,
				url: file.ufsUrl,
				description: metadata.description,
				uploadedBy: metadata.userId,
				uploadedAt: new Date(Number(metadata.uploadedAt))
			});
			return {
				uploadedBy: metadata.userId,
			};
		}),

	contractUploader: f({
		pdf: {
			maxFileSize: "16MB",
			maxFileCount: 1,
		},
	})
		.input(
			z.object({
				contractId: z.string().min(1),
			})
		)
		.middleware(async ({ input }) => {
			const session = await auth();
			if (!session?.user?.id) throw new UploadThingError("Unauthorized");

			// The contract document is managed only by project managers. Employees and
			// clients must never be able to attach or replace it (segregation of duties).
			if (!hasRole(session.user, ["admin", "moderator"])) {
				throw new UploadThingError("Forbidden");
			}

			// Confirm the contract exists; do not trust anything else from the client.
			const [contract] = await db
				.select({ id: contracts.id })
				.from(contracts)
				.where(eq(contracts.id, input.contractId))
				.limit(1);

			if (!contract) throw new UploadThingError("Contract not found");

			return {
				userId: session.user.id,
				contractId: contract.id,
			};
		})
		.onUploadComplete(async ({ metadata, file }) => {
			// Update the contract with the file URL
			await db
				.update(contracts)
				.set({
					fileUrl: file.ufsUrl,
					updatedAt: new Date(),
				})
				.where(eq(contracts.id, metadata.contractId));

			return {
				uploadedBy: metadata.userId,
				contractId: metadata.contractId,
			};
		}),

	/**
	 * Independent from `contractUploader`. Attaches / replaces the single private
	 * PDF payment proof for one contract installment. Allowed for admin, moderator,
	 * and employees assigned to the owning project (not clients).
	 */
	paymentProofUploader: f({
		pdf: {
			maxFileSize: "8MB",
			maxFileCount: 1,
			acl: "private",
		},
	})
		.input(
			z.object({
				installmentId: z.string().min(1),
			})
		)
		.middleware(async ({ input }) => {
			const session = await auth();

			// role gate (admin / moderator / assigned employee, never client) +
			// IDOR resolution, enforced in one place shared with the GET route
			// (see @/lib/payment-proof-access).
			const access = await resolvePaymentProofAccess(
				session?.user,
				input.installmentId,
				{ getInstallmentChain, isAssignedToProject }
			);
			if (!access.ok) throw new UploadThingError(access.error);

			return {
				userId: access.userId,
				installmentId: access.chain.installmentId,
				projectId: access.chain.projectId,
			};
		})
		.onUploadComplete(async ({ metadata, file }) => {
			const utapi = new UTApi();

			const discardUpload = async (message: string): Promise<never> => {
				await utapi.deleteFiles([file.key]).catch(() => undefined);
				throw new UploadThingError(message);
			};

			// MIME + size re-check on the server side (never rely on the client).
			if (!isAcceptablePaymentProofMeta(file)) {
				await discardUpload("Invalid payment proof file");
			}

			// Magic-header check: pull the first bytes of the freshly stored private
			// file through a short-lived signed URL and require a "%PDF-" prefix.
			let magicOk = false;
			try {
				const { ufsUrl } = await utapi.generateSignedURL(file.key, { expiresIn: 60 });
				const res = await fetch(ufsUrl, { headers: { Range: "bytes=0-4" } });
				if (res.ok) {
					magicOk = hasPdfMagic(new Uint8Array(await res.arrayBuffer()));
				}
			} catch {
				magicOk = false;
			}
			if (!magicOk) {
				await discardUpload("File is not a valid PDF");
			}

			// Swap the proof under a row lock on the installment itself, then delete
			// the previous stored file only after the transaction has committed.
			let previousKey: string | null = null;
			await db.transaction(async (tx) => {
				const [locked] = await tx
					.select({ id: contractInstallments.id })
					.from(contractInstallments)
					.where(eq(contractInstallments.id, metadata.installmentId))
					.for("update")
					.limit(1);

				if (!locked) throw new UploadThingError("Installment not found");

				const [existing] = await tx
					.select({ fileKey: installmentPaymentProofs.fileKey })
					.from(installmentPaymentProofs)
					.where(eq(installmentPaymentProofs.installmentId, metadata.installmentId))
					.limit(1);

				previousKey = existing?.fileKey ?? null;

				await tx
					.insert(installmentPaymentProofs)
					.values({
						installmentId: metadata.installmentId,
						fileKey: file.key,
						mimeType: file.type,
						fileName: file.name,
						fileSize: file.size,
						uploadedBy: metadata.userId,
						uploadedAt: new Date(),
						updatedAt: new Date(),
					})
					.onConflictDoUpdate({
						target: installmentPaymentProofs.installmentId,
						set: {
							fileKey: file.key,
							mimeType: file.type,
							fileName: file.name,
							fileSize: file.size,
							uploadedBy: metadata.userId,
							updatedAt: new Date(),
						},
					});
			});

			const staleKey = keyToDeleteAfterCommit(previousKey, file.key);
			if (staleKey) {
				await utapi.deleteFiles([staleKey]).catch(() => undefined);
			}

			return { installmentId: metadata.installmentId };
		}),

	reportAttachmentUploader: f({
		image: {
			maxFileSize: "8MB",
			maxFileCount: 10,
		},
		pdf: {
			maxFileSize: "16MB",
			maxFileCount: 5,
		},
		text: {
			maxFileSize: "4MB",
			maxFileCount: 5,
		},
	})
		.middleware(async () => {
			const session = await auth();
			if (!hasRole(session?.user, ["admin", "moderator", "employee"])) {
				throw new UploadThingError("Unauthorized");
			}

			return {
				userId: session?.user?.id,
			};
		})
		.onUploadComplete(async ({ file }) => ({
			url: file.ufsUrl,
			name: file.name,
			type: file.type,
		})),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
