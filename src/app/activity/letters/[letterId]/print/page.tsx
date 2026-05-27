"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type LetterAttachment = {
	url: string;
	name?: string | null;
	type?: string | null;
};

type ActivityLetter = {
	id: string;
	projectId: string;
	recipientName: string;
	subject: string;
	body: string;
	letterDate: string | null;
	attachments: LetterAttachment[];
	status: "draft" | "ready";
	authorId: string | null;
	authorName: string;
	createdAt: string | null;
	updatedAt: string | null;
	canEdit: boolean;
};

type ProjectDetailsResponse = {
	project: {
		id: string;
		name: string;
	};
};

const formatDate = (value?: string | null) => {
	if (!value) return "غير محدد";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "غير محدد";
	return date.toLocaleDateString("ar-SA", {
		dateStyle: "medium",
	});
};

export default function ActivityLetterPrintPage() {
	const params = useParams<{ letterId: string }>();
	const letterId = typeof params?.letterId === "string" ? params.letterId : "";
	const [letter, setLetter] = useState<ActivityLetter | null>(null);
	const [projectName, setProjectName] = useState("غير محدد");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!letterId) {
			setError("تعذر تحديد الخطاب المطلوب.");
			setLoading(false);
			return;
		}

		let cancelled = false;

		const load = async () => {
			setLoading(true);
			setError(null);

			try {
				const letterResponse = await fetch(`/api/activity/letters/${letterId}`, {
					cache: "no-store",
				});

				if (!letterResponse.ok) {
					throw new Error("تعذر تحميل بيانات الخطاب.");
				}

				const nextLetter = (await letterResponse.json()) as ActivityLetter;
				if (cancelled) return;
				setLetter(nextLetter);

				const projectResponse = await fetch(
					`/api/activity/projects/${nextLetter.projectId}`,
					{ cache: "no-store" }
				);

				if (!projectResponse.ok) {
					throw new Error("تعذر تحميل بيانات المشروع.");
				}

				const nextProject = (await projectResponse.json()) as ProjectDetailsResponse;
				if (cancelled) return;
				setProjectName(nextProject.project?.name || "غير محدد");
			} catch (loadError) {
				if (cancelled) return;
				setError(loadError instanceof Error ? loadError.message : "تعذر تحميل صفحة الطباعة.");
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [letterId]);

	const letterBody = useMemo(() => {
		return letter?.body?.trim() || "لا يوجد نص مضاف لهذا الخطاب.";
	}, [letter]);

	return (
		<>
			<style jsx global>{`
				@media print {
					.no-print {
						display: none !important;
					}

					body {
						background: white !important;
						color: black !important;
					}

					@page {
						size: A4;
						margin: 24mm 22mm;
					}
				}

				html,
				body {
					margin: 0;
					padding: 0;
					direction: rtl;
					text-align: right;
					background: #ffffff;
					color: #000000;
					font-family: Tahoma, Arial, sans-serif;
				}

				.letter-print-shell {
					padding: 16px;
					background: #ffffff;
				}

				.letter-page {
					max-width: 210mm;
					min-height: 297mm;
					margin: 0 auto;
					padding: 24mm 22mm;
					box-sizing: border-box;
					background: white;
					color: black;
				}

				.print-toolbar {
					max-width: 210mm;
					margin: 0 auto 16px;
					text-align: left;
				}

				.print-button {
					border: 1px solid #000;
					background: #fff;
					color: #000;
					padding: 10px 18px;
					font: inherit;
					cursor: pointer;
				}

				.company-meta {
					margin-bottom: 14mm;
					line-height: 1.9;
					font-size: 14px;
				}

				.letter-meta {
					margin-bottom: 12mm;
					line-height: 1.9;
					font-size: 15px;
				}

				section {
					margin-bottom: 10mm;
				}

				h1 {
					text-align: center;
					font-size: 26px;
					margin: 0 0 18mm;
					font-weight: 700;
				}

				p {
					font-size: 15px;
					line-height: 2;
					margin: 0 0 5mm;
					white-space: pre-line;
				}
			`}</style>

			<div className="letter-print-shell">
				<div className="print-toolbar no-print">
					<button type="button" className="print-button" onClick={() => window.print()}>
						طباعة / حفظ PDF
					</button>
				</div>

				<div className="letter-page">
					{loading ? (
						<p>جاري تحميل الخطاب...</p>
					) : error ? (
						<p>{error}</p>
					) : !letter ? (
						<p>تعذر العثور على الخطاب المطلوب.</p>
					) : (
						<>
							<h1>خطاب رسمي</h1>

							<section className="company-meta">
								<p>+966 55 536 4848</p>
								<p>info@craftksa.com | www.craftksa.com</p>
								<p>RIYADH | SAUDI ARABIA</p>
							</section>

							<section className="letter-meta">
								<p>اسم المشروع / {projectName}</p>
								<p>المكرم / {letter.recipientName?.trim() || "غير محدد"}</p>
								<p>الموضوع / {letter.subject?.trim() || "غير محدد"}</p>
								<p>التاريخ / {formatDate(letter.letterDate || letter.createdAt)}</p>
							</section>

							<section>
								<p>تحية طيبة وبعد،</p>
							</section>

							<section>
								<p>{letterBody}</p>
							</section>

							<section>
								<p>وتفضلوا بقبول فائق التحية والتقدير،</p>
							</section>

							<section>
								<p>فريق شركة كرافت</p>
							</section>
						</>
					)}
				</div>
			</div>
		</>
	);
}
