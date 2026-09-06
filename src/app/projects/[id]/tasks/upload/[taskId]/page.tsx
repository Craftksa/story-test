import React from 'react';
import {notFound, redirect} from "next/navigation";
import {getTranslations} from "next-intl/server";
import {eq} from "drizzle-orm";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import ImageUploaderWithPreview from "@/components/UploadThingButton";
import {auth} from "@/auth";
import {db} from "@/drizzle/db";
import {tasks} from "@/drizzle/schema";
import {authorizeProjectAccess} from "@/lib/project-permissions";
import type {AuthenticatedUser} from "@/lib/authenticate";

const UploadImages = async ({
	params,
}: {
	params: Promise<{ id: string; taskId: string }>;
}) => {
	const {id: projectId, taskId} = await params;

	const session = await auth();
	if (!session?.user?.id) {
		redirect("/login");
	}

	const taskRows = await db
		.select({ id: tasks.id, projectId: tasks.projectId })
		.from(tasks)
		.where(eq(tasks.id, taskId))
		.limit(1);

	const task = taskRows[0];
	if (!task || task.projectId !== projectId) {
		notFound();
	}

	const access = await authorizeProjectAccess({
		user: session.user as unknown as AuthenticatedUser,
		projectId: task.projectId,
		action: "upload",
	});

	if (!access.ok) {
		redirect("/unauthorized");
	}

	const t = await getTranslations();

	return (
			<div className="flex justify-center">
				<Card className="w-full rounded-none">
					<CardHeader>
						<CardTitle className="relative">
							{t("Upload Images")}
						</CardTitle>
						<CardDescription>
							{t("Upload images for this selected task")}.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ImageUploaderWithPreview projectId={task.projectId} id={task.id} />
					</CardContent>
				</Card>
		</div>
	);
};

export default UploadImages;
