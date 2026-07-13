"use client";

import { useUploadThing } from "@/utils/uploadthing"; // your utils wrapper
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type UploadProps = {
	taskId: string;
	description: string;
};

export function SimpleUploadButton({ taskId, description }: UploadProps) {
	const router = useRouter();

	const { startUpload } = useUploadThing("imageUploader", {
		onUploadBegin() {
			toast(
				<div className="flex items-center gap-2 text-white">
					<UploadSpinnerSVG />
					<span>Uploading...</span>
				</div>,
				{ duration: Infinity, id: "uploading" }
			);
		},
		onUploadError() {
			toast.dismiss("uploading");
			toast.error("Upload failed");
		},
		onClientUploadComplete() {
			toast.dismiss("uploading");
			toast.success("Upload Complete!");
			router.refresh();
		},
	});

	const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!e.target.files) return;

		const selectedFiles = Array.from(e.target.files);
		await startUpload(selectedFiles, { taskId, description });
	};

	return (
		<div>
			<label htmlFor="upload-button" className="cursor-pointer">
				<UploadSVG />
			</label>
			<input
				id="upload-button"
				type="file"
				className="sr-only"
				onChange={onChange}
				accept="image/*"
				multiple
			/>
		</div>
	);
}

function UploadSVG() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
		     strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
			<path strokeLinecap="round" strokeLinejoin="round"
			      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
		</svg>
	);
}

function UploadSpinnerSVG() {
	return (
		<div className="text-white">
			<svg width="24" height="24" stroke="white" viewBox="0 0 24 24"
			     xmlns="http://www.w3.org/2000/svg">
				<circle cx="12" cy="12" r="9.5" fill="none" strokeWidth="3" />
			</svg>
		</div>
	);
}
