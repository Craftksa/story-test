import {createUploadthing, type FileRouter} from "uploadthing/next";
import {UploadThingError} from "uploadthing/server";
import {auth} from "@/auth";
import {contracts, taskImages, tasks} from "@/drizzle/schema"; // your actual auth import
import {db} from "@/drizzle/db";
import {z} from "zod";
import {eq} from "drizzle-orm";
import { hasRole } from "@/lib/utils";
import { authorizeProjectAccess } from "@/lib/project-permissions";
import type { AuthenticatedUser } from "@/lib/authenticate";

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
				contractId: z.string(),
			})
		)
		.middleware(async ({ input }) => {
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
