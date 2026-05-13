"use client";

import React, {useEffect, useState} from "react";
import {uploadFiles} from "@/utils/uploadthing";
import {Button} from "@/components/ui/button";
import {Progress} from "@/components/ui/progress";
import {Textarea} from "@/components/ui/textarea";
import {CheckCircle2, HardDriveUpload, Plus, Trash2, UploadCloud, X} from "lucide-react";
import Image from "next/image";
import Spinner from "@/components/Spinner";
import {useTaskStore} from "@/store/taskStore";
import {useRouter} from "next/navigation";
import {useTranslations} from "use-intl";

type FileItem = {
	file: File;
	previewUrl: string;
	description: string;
	progress: number;
	status: "pending" | "uploading" | "uploaded" | "error";
};

type Props = {
	id?: any;
	projectId?: any;
	button?: string;
};

const IMAGES_PER_PAGE = 6;

export default function ImageUploaderWithPreview({ id, projectId, button}: Props) {
	const [files, setFiles] = useState<FileItem[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [isUploading, setIsUploading] = useState(false);
	const { fetchOneTask, setProjectId} = useTaskStore();
	const router = useRouter();
	const t = useTranslations();

	useEffect(() => {
		setProjectId(projectId);
	}, [projectId]);

	const paginatedFiles = files.slice(
		(currentPage - 1) * IMAGES_PER_PAGE,
		currentPage * IMAGES_PER_PAGE
	);
	const totalPages = Math.ceil(files.length / IMAGES_PER_PAGE);

	const isDuplicate = (newFile: File) =>
		files.some((f) => f.file.name === newFile.name && f.file.size === newFile.size);

	const addFiles = (selected: File[]) => {
		const filtered = selected.filter(
			(f) => f.type.startsWith("image/") && !isDuplicate(f)
		);

		if (files.length + filtered.length > 50) {
			alert("You can upload up to 50 images only.");
			return;
		}

		const newItems = filtered.map((file) => ({
			file,
			previewUrl: URL.createObjectURL(file),
			description: "",
			progress: 0,
			status: "pending" as const,
		}));

		if (newItems.length === 0) {
			alert("No new images added (might be duplicates).");
			return;
		}

		setFiles((prev) => [...newItems, ...prev]);
		setCurrentPage(1);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		if (isUploading) return;
		addFiles(Array.from(e.dataTransfer.files));
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (isUploading) return;
		const selected = e.target.files ? Array.from(e.target.files) : [];
		addFiles(selected);
		e.target.value = ""; // reset input
	};

	const updateDescription = (index: number, value: string) => {
		const globalIndex = (currentPage - 1) * IMAGES_PER_PAGE + index;
		setFiles((prev) =>
			prev.map((f, i) => (i === globalIndex ? { ...f, description: value } : f))
		);
	};

	const removeFile = (index: number) => {
		if (isUploading) return;
		const globalIndex = (currentPage - 1) * IMAGES_PER_PAGE + index;
		setFiles((prev) => prev.filter((_, i) => i !== globalIndex));
	};

	const handleUpload = async () => {
		setIsUploading(true);
		const updated = [...files];

		for (let i = 0; i < updated.length; i++) {
			if (updated[i].status === "uploaded") continue;

			updated[i].status = "uploading";
			setFiles([...updated]);

			try {
				await uploadFiles("imageUploader", {
					files: [updated[i].file],
					onUploadProgress: ({ totalProgress }) => {
						updated[i].progress = Math.round(totalProgress * 100);
						setFiles([...updated]);
					},
					input: {
						taskId: id,
						description: updated[i].description || "",
						uploadedAt: Date.now().toString()
					},
				});
				updated[i].status = "uploaded";
			} catch (err) {
				console.error("Upload failed:", err);
				updated[i].status = "error";
			}
			setFiles([...updated]);
		}
		router.push(`/projects/${projectId}/tasks/${id}`)
		setIsUploading(false);
	};

	const clearFiles = () => {
		if (isUploading) return;
		setFiles([]);
		setCurrentPage(1);
	};

	return (
		<div className="space-y-4">
			{/* Drop zone */}
			{button ? (
				<>
					<Button
						type="button"
						size="sm"
						variant="outline"
						className={`flex text-xs items-center gap-2 ${
							isUploading ? "opacity-50 pointer-events-none" : ""
						}`}
						onClick={() => !isUploading && document.getElementById("fileInput")?.click()}
					>
						<Plus className="w-4 h-4" />
						{t(button || 'Add Images')}
					</Button>
					<input
						id="fileInput"
						type="file"
						accept="image/*"
						multiple
						className="hidden"
						onChange={handleFileSelect}
					/>
				</>
			) : (
				<div
					onDrop={handleDrop}
					onDragOver={(e) => e.preventDefault()}
					className={`border-dashed border-2 p-6 text-center cursor-pointer hover:bg-background ${
						isUploading ? "opacity-50 pointer-events-none" : ""
					}`}
					onClick={() => !isUploading && document.getElementById("fileInput")?.click()}
				>
					<UploadCloud className="mx-auto w-6 h-6 text-muted-foreground" />
					<p className="mt-2 text-sm text-muted-foreground">
						{t("Click or drag images to upload (max 50)")}
					</p>
					<input
						id="fileInput"
						type="file"
						accept="image/*"
						multiple
						className="hidden"
						onChange={handleFileSelect}
					/>
				</div>
			)}

			{/* Preview List */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{paginatedFiles.map((file, index) => {
					const globalIndex = (currentPage - 1) * IMAGES_PER_PAGE + index;
					return (
						<div key={globalIndex} className="relative border shadow p-2">
							{/* Index */}
							<div className="absolute top-3 left-3 bg-muted px-2 py-0.5 text-xs rounded-full z-10">
								#{files.length - globalIndex}
							</div>

							{/* Remove */}
							<Button
								variant="rounded"
								size="icon"
								disabled={isUploading}
								onClick={() => removeFile(index)}
								className="absolute top-3 right-3 z-20"
							>
								<X className="w-4 h-4 text-destructive" />
							</Button>

							<Image
								width={500}
								height={500}
								src={file.previewUrl}
								alt="preview"
								className="w-full h-60 object-cover rounded-md"
							/>

							<Textarea
								placeholder={t("Optional description")}
								className="mt-2 text-xs"
								value={file.description}
								disabled={isUploading}
								onChange={(e) => updateDescription(index, e.target.value)}
							/>

							{file.status === "uploading" && (
								<div className="mt-2">
									<Progress value={file.progress} />
								</div>
							)}

							{file.status === "uploaded" && (
								<div className="absolute inset-0 bg-background/80 flex flex-col gap-2 items-center justify-center rounded-md">
									<CheckCircle2 className="w-12 h-12 p-2 -mt-4 rounded-full bg-muted text-green-500" />
									<span className="">{t("Completed")}</span>
								</div>
							)}

							{file.status === "error" && (
								<div className="absolute inset-0 bg-background/80 flex flex-col gap-2 items-center justify-center rounded-md">
									<X className="w-12 h-12 p-2 -mt-4 rounded-full bg-muted text-red-500" />
									<span className="">{t("Upload Failed")}</span>
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Pagination Controls */}
			{totalPages > 1 && (
				<div className="flex justify-center gap-2 mt-2">
					{Array.from({ length: totalPages }, (_, i) => (
						<Button
							size="icon"
							variant="outline"
							key={i}
							disabled={isUploading}
							onClick={() => setCurrentPage(i + 1)}
							className={currentPage === i + 1 ? "bg-primary text-white" : ""}
						>
							{i + 1}
						</Button>
					))}
				</div>
			)}

			{/* Upload and Clear Buttons */}
			{files.length > 0 && (
				<div className="flex gap-2">
					<Button
						onClick={handleUpload}
						className="w-full flex justify-center items-center gap-2"
						disabled={isUploading || files.every((f) => f.status === "uploaded")}
					>
						{isUploading ? <Spinner /> : <HardDriveUpload className="w-4 h-4 " />}
						{isUploading ? `${t("Uploading")}...` : t("Upload All Images")}
					</Button>
					<Button
						onClick={clearFiles}
						className="flex justify-center items-center gap-2"
						disabled={isUploading}
					>
						<Trash2 className="w-4 h-4 " />
						{t("Clear")}
					</Button>
				</div>
			)}
		</div>
	);
}
