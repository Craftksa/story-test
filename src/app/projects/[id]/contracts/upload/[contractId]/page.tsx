'use client';

import React from 'react';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import ContractDocumentUploader from "@/components/ContractDocumentUploader";
import {useParams, useRouter} from "next/navigation";
import {useTranslations} from "use-intl";

const UploadContract = () => {
	const {id: projectId, contractId} = useParams();
	const router = useRouter();
	const t = useTranslations();

	const handleUploadComplete = () => {
		// Navigate back to contract details or show success message
		router.push(`/projects/${projectId}/contracts/${contractId}`);
	};

	return (
		<div className="flex justify-center">
			<Card className="w-full rounded-none">
				<CardHeader>
					<CardTitle className="relative">
						{t("Upload Contract Document")}
					</CardTitle>
					<CardDescription>
						{t("Upload PDF document for this contract (max 16MB)")}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ContractDocumentUploader
						contractId={contractId as string}
						onUploadComplete={handleUploadComplete}
					/>
				</CardContent>
			</Card>
		</div>
	);
};

export default UploadContract;