"use client";

import React, { useRef, useState } from "react";
import { uploadFiles } from "@/utils/uploadthing";
import { Button } from "@/components/ui/button";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

const MAX_BYTES = 8 * 1024 * 1024;

type Props = {
	installmentId: string;
	hasExisting?: boolean;
	onUploaded?: () => void;
};

/**
 * Employee-only control for attaching / replacing the single private PDF payment
 * proof of a contract installment. All authorization is enforced server-side by
 * the `paymentProofUploader` route; this component is just the trigger.
 */
export default function PaymentProofUploader({ installmentId, hasExisting = false, onUploaded }: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);
	const t = useTranslations();

	const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;

		if (file.type !== "application/pdf") {
			toast.error(t("Only PDF files are allowed"));
			return;
		}
		if (file.size > MAX_BYTES) {
			toast.error(t("File size must be less than 8MB"));
			return;
		}

		setIsUploading(true);
		try {
			await uploadFiles("paymentProofUploader", {
				files: [file],
				input: { installmentId },
			});
			toast.success(t("Payment proof uploaded"));
			onUploaded?.();
		} catch (err) {
			console.error("Payment proof upload failed:", err);
			toast.error(err instanceof Error ? err.message : t("Upload Failed"));
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<>
			<Button
				type="button"
				size="sm"
				variant="outline"
				disabled={isUploading}
				className="flex text-xs items-center gap-2"
				onClick={() => inputRef.current?.click()}
			>
				{isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
				{hasExisting ? t("Replace Payment Proof") : t("Upload Payment Proof")}
			</Button>
			<input
				ref={inputRef}
				type="file"
				accept="application/pdf"
				className="hidden"
				onChange={handleFile}
				disabled={isUploading}
			/>
		</>
	);
}
