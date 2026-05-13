'use client';

import React from 'react';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import ImageUploaderWithPreview from "@/components/UploadThingButton";
import {useParams} from "next/navigation";
import {useTranslations} from "use-intl";

const UploadImages = () => {
	const {id: projectId, taskId} = useParams();

	const t = useTranslations();

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
						<ImageUploaderWithPreview projectId={projectId} id={taskId} />
					</CardContent>
				</Card>
		</div>
	);
};

export default UploadImages;