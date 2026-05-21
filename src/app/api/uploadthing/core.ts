import {createUploadthing, type FileRouter} from "uploadthing/next";
import {UploadThingError} from "uploadthing/server";
import {auth} from "@/auth";
import {contracts, taskImages} from "@/drizzle/schema"; // your actual auth import
import {db} from "@/drizzle/db";
import {z} from "zod";
import {eq} from "drizzle-orm";
import { hasRole } from "@/lib/utils";

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
				taskId: z.string(),
				description: z.string().optional(),
				uploadedAt: z.string().optional(), // ISO string from client
			})
		)

		.middleware(async ({ req, input }) => {
			const session = await auth(); // next-auth session
			if (!session?.user?.id) throw new UploadThingError("Unauthorized");

			console.log(input.taskId);
			console.log("Datedddd", input.uploadedAt)

			return {
				userId: session.user.id,
				taskId: input.taskId,
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
				contractId: z.string(),
			})
		)
		.middleware(async ({ req, input }) => {
			const session = await auth();
			if (!session?.user?.id) throw new UploadThingError("Unauthorized");

			return {
				userId: session.user.id,
				contractId: input.contractId,
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
