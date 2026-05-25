"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type PrintReport = {
	id: string;
	projectId: string;
	reportType: "client" | "internal" | "shared";
	title: string;
	summary: string | null;
	details: string;
	workDetails: string | null;
	authorName: string;
	createdAt: string | null;
};

type ProjectDetailsResponse = {
	project: {
		id: string;
		name: string;
	};
};

const reportTypeLabel: Record<PrintReport["reportType"], string> = {
	client: "تقرير للعميل",
	internal: "تقرير داخلي",
	shared: "تقرير مشترك",
};

const formatDate = (value?: string | null) => {
	if (!value) return "غير محدد";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "غير محدد";
	return date.toLocaleString("ar-SA", {
		dateStyle: "medium",
		timeStyle: "short",
	});
};

export default function ActivityReportPrintPage() {
	const params = useParams<{ reportId: string }>();
	const reportId = typeof params?.reportId === "string" ? params.reportId : "";
	const [report, setReport] = useState<PrintReport | null>(null);
	const [projectName, setProjectName] = useState("غير محدد");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!reportId) {
			setError("تعذر تحديد التقرير المطلوب.");
			setLoading(false);
			return;
		}

		let cancelled = false;

		const load = async () => {
			setLoading(true);
			setError(null);

			try {
				const reportResponse = await fetch(`/api/activity/reports/${reportId}`, {
					cache: "no-store",
				});

				if (!reportResponse.ok) {
					throw new Error("تعذر تحميل بيانات التقرير.");
				}

				const nextReport = (await reportResponse.json()) as PrintReport;
				if (cancelled) return;

				setReport(nextReport);

				const projectResponse = await fetch(
					`/api/activity/projects/${nextReport.projectId}`,
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
	}, [reportId]);

	const summaryText = useMemo(() => {
		return report?.summary?.trim() || "لا يوجد ملخص مضاف لهذا التقرير.";
	}, [report]);

	const completedWorkText = useMemo(() => {
		const workDetails = report?.workDetails?.trim();
		const details = report?.details?.trim();
		return workDetails || details || "لا توجد أعمال منجزة مضافة لهذا التقرير.";
	}, [report]);

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

				.report-print-shell {
					padding: 16px;
					background: #ffffff;
				}

				.report-page {
					max-width: 210mm;
					min-height: 297mm;
					margin: 0 auto;
					padding: 24mm 22mm;
					box-sizing: border-box;
					background: white;
					color: black;
				}

				h1 {
					text-align: center;
					font-size: 26px;
					margin: 0 0 18mm;
					font-weight: 700;
				}

				.meta {
					margin-bottom: 14mm;
					line-height: 1.9;
				}

				section {
					margin-bottom: 10mm;
				}

				h2 {
					font-size: 18px;
					margin: 0 0 5mm;
					font-weight: 700;
				}

				p {
					font-size: 15px;
					line-height: 2;
					margin: 0 0 5mm;
					white-space: pre-line;
				}

				.print-button {
					border: 1px solid #000;
					background: #fff;
					color: #000;
					padding: 10px 18px;
					font: inherit;
					cursor: pointer;
				}

				.print-toolbar {
					max-width: 210mm;
					margin: 0 auto 16px;
					text-align: left;
				}
			`}</style>

			<div className="report-print-shell">
				<div className="print-toolbar no-print">
					<button type="button" className="print-button" onClick={() => window.print()}>
						طباعة / حفظ PDF
					</button>
				</div>

				<div className="report-page">
					{loading ? (
						<p>جاري تحميل التقرير...</p>
					) : error ? (
						<p>{error}</p>
					) : !report ? (
						<p>تعذر العثور على التقرير المطلوب.</p>
					) : (
						<>
							<h1>تقرير أعمال الموقع</h1>

							<section className="meta">
								<p>اسم المشروع: {projectName}</p>
								<p>عنوان التقرير: {report.title?.trim() || "غير محدد"}</p>
								<p>نوع التقرير: {reportTypeLabel[report.reportType] || "غير محدد"}</p>
								<p>التاريخ: {formatDate(report.createdAt)}</p>
								<p>إعداد: {report.authorName?.trim() || "غير محدد"}</p>
							</section>

							<section>
								<p>السلام عليكم ورحمة الله وبركاته،</p>
							</section>

							<section>
								<p>
									نقدم لكم هذا التقرير الذي يوضح الأعمال التي تم إنجازها في الموقع خلال الفترة
									المحددة، مع توضيح أبرز التحديثات والتحسينات التي تم تنفيذها، وذلك بهدف توثيق
									سير العمل ومتابعة تقدم المشروع بشكل واضح ومنظم.
								</p>
							</section>

							<section>
								<h2>ملخص التقرير</h2>
								<p>{summaryText}</p>
							</section>

							<section>
								<h2>الأعمال المنجزة</h2>
								<p>{completedWorkText}</p>
							</section>

							<section>
								<p>
									نؤكد أن الأعمال المذكورة أعلاه تم تنفيذها ضمن خطة تطوير الموقع، وسيتم استكمال
									بقية التحسينات والاختبارات لضمان استقرار النظام ورفع جودة تجربة المستخدم.
								</p>
							</section>

							<section>
								<p>أطيب التحيات،</p>
								<p>فريق شركة كرافت</p>
							</section>
						</>
					)}
				</div>
			</div>
		</>
	);
}
