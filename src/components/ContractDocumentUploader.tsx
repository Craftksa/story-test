"use client";

import React, { useState } from "react";
import { uploadFiles } from "@/utils/uploadthing";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, FileText, Plus, UploadCloud, X } from "lucide-react";
import Spinner from "@/components/Spinner";
import { useTranslations } from "use-intl";

type DocumentItem = {
	file: File;
	progress: number;
	status: "pending" | "uploading" | "uploaded" | "error";
};

type Props = {
	contractId: string;
	onUploadComplete?: () => void;
	buttonText?: string;
	disabled?: boolean;
};

export default function ContractDocumentUploader({
	                                                 contractId,
	                                                 onUploadComplete,
	                                                 buttonText,
	                                                 disabled = false
                                                 }: Props) {
	const [documentFile, setDocumentFile] = useState<DocumentItem | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const t = useTranslations();

	const addFile = (selectedFile: File) => {
		if (!selectedFile.type.includes("pdf")) {
			alert("Only PDF files are allowed.");
			return;
		}

		if (selectedFile.size > 16 * 1024 * 1024) {
			alert("File size must be less than 16MB.");
			return;
		}

		const newDocument: DocumentItem = {
			file: selectedFile,
			progress: 0,
			status: "pending",
		};

		setDocumentFile(newDocument);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		if (isUploading || disabled) return;

		const files = Array.from(e.dataTransfer.files);
		if (files.length > 0) {
			addFile(files[0]);
		}
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (isUploading || disabled) return;

		const selectedFile = e.target.files?.[0];
		if (selectedFile) {
			addFile(selectedFile);
		}
		e.target.value = ""; // reset input
	};

	const handleUpload = async () => {
		if (!documentFile || isUploading) return;

		setIsUploading(true);
		const updatedDocument = { ...documentFile, status: "uploading" as const };
		setDocumentFile(updatedDocument);

		try {
			await uploadFiles("contractUploader", {
				files: [documentFile.file],
				onUploadProgress: ({ totalProgress }) => {
					const progress = Math.round(totalProgress * 100);
					setDocumentFile(prev => prev ? { ...prev, progress } : null);
				},
				input: {
					contractId,
				},
			});

			setDocumentFile(prev => prev ? { ...prev, status: "uploaded" } : null);
			onUploadComplete?.();
		} catch (err) {
			console.error("Upload failed:", err);
			setDocumentFile(prev => prev ? { ...prev, status: "error" } : null);
		}

		setIsUploading(false);
	};

	const removeDocument = () => {
		if (isUploading) return;
		setDocumentFile(null);
	};

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	};

	return (
		<div className="space-y-4">
			{/* Upload Button or Drop Zone */}
			{buttonText ? (
				<>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={disabled || isUploading || (documentFile?.status === "uploaded")}
						className="flex text-xs items-center gap-2"
						onClick={() => documentFile?.status !== "uploaded" && document?.getElementById("contractFileInput")?.click()}
					>
						<Plus className="w-4 h-4" />
						{documentFile?.status === "uploaded" ? t("Document Uploaded") : t(buttonText || "Upload Contract")}
					</Button>
					<input
						id="contractFileInput"
						type="file"
						accept=".pdf"
						className="hidden"
						onChange={handleFileSelect}
						disabled={disabled || isUploading}
					/>
				</>
			) : (
				<div
					onDrop={handleDrop}
					onDragOver={(e) => e.preventDefault()}
					className={`border-dashed border-2 p-6 text-center cursor-pointer hover:bg-background ${
						isUploading || disabled ? "opacity-50 pointer-events-none" : ""
					}`}
					onClick={() => !isUploading && !disabled && document.getElementById("contractFileInput")?.click()}
				>
					<UploadCloud className="mx-auto w-6 h-6 text-muted-foreground" />
					<p className="mt-2 text-sm text-muted-foreground">
						{t("Click or drag PDF file to upload (max 16MB)")}
					</p>
					<input
						id="contractFileInput"
						type="file"
						accept=".pdf"
						className="hidden"
						onChange={handleFileSelect}
						disabled={disabled || isUploading}
					/>
				</div>
			)}

			{/* Document Preview */}
			{documentFile && (
				<div className="relative border shadow p-4 rounded-md">
					{/* Remove Button */}
					<Button
						variant="outline"
						size="icon"
						disabled={isUploading}
						onClick={removeDocument}
						className="absolute top-2 right-2 h-8 w-8"
					>
						<X className="w-4 h-4 text-destructive" />
					</Button>

					<div className="flex items-center gap-3 pr-10">
						<div className="flex-shrink-0">
							<FileText className="w-10 h-10 text-red-500" />
						</div>

						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium truncate">
								{documentFile.file.name}
							</p>
							<p className="text-xs text-muted-foreground">
								{formatFileSize(documentFile.file.size)}
							</p>
						</div>
					</div>

					{/* Progress Bar */}
					{documentFile.status === "uploading" && (
						<div className="mt-3">
							<Progress value={documentFile.progress} />
							<p className="text-xs text-muted-foreground mt-1">
								{t("Uploading")}... {documentFile.progress}%
							</p>
						</div>
					)}

					{/* Success State */}
					{documentFile.status === "uploaded" && (
						<div className="absolute inset-0 bg-background/90 flex flex-col gap-2 items-center justify-center rounded-md">
							<CheckCircle2 className="w-12 h-12 p-2 rounded-full bg-muted text-green-500" />
							<span className="text-sm font-medium">{t("Upload Complete")}</span>
						</div>
					)}

					{/* Error State */}
					{documentFile.status === "error" && (
						<div className="absolute inset-0 bg-background/90 flex flex-col gap-2 items-center justify-center rounded-md">
							<X className="w-12 h-12 p-2 rounded-full bg-muted text-red-500" />
							<span className="text-sm font-medium">{t("Upload Failed")}</span>
							<Button
								size="sm"
								variant="outline"
								onClick={handleUpload}
								className="mt-2"
							>
								{t("Retry")}
							</Button>
						</div>
					)}
				</div>
			)}

			{/* Upload Button */}
			{documentFile && documentFile.status === "pending" && (
				<Button
					onClick={handleUpload}
					className="w-full flex justify-center items-center gap-2"
					disabled={isUploading || disabled}
				>
					{isUploading ? <Spinner /> : <UploadCloud className="w-4 h-4" />}
					{isUploading ? `${t("Uploading")}...` : t("Upload Document")}
				</Button>
			)}
		</div>
	);
}