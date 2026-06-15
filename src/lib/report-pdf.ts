import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import {
	getProjectAndClientById,
	type ActivityLetter,
	getReportById,
	type ActivityReport,
} from "@/lib/activity";

type ReportLookupUser = Parameters<typeof getReportById>[1];

export type ReportProjectPayload = {
	id: string;
	name: string;
	city?: string | null;
	district?: string | null;
	clientName?: string | null;
	clientEmail?: string | null;
	description?: string | null;
};

export type ReportDocumentPayload = {
	project: ReportProjectPayload;
	report: ActivityReport;
	approvedByName?: string | null;
};

export type LetterDocumentPayload = {
	project: ReportProjectPayload;
	letter: ActivityLetter;
};

type ReportPdfLoadSuccess = {
	payload: ReportDocumentPayload;
};

type ReportPdfLoadFailure = {
	error: "report_not_found" | "project_not_found";
};

type ReportPdfDocumentContent = {
	projectName: string;
	clientName: string | null;
	reportTitle: string;
	reportType: string;
	reportDate: string;
	authorName: string;
	summaryText: string | null;
	workText: string | null;
	detailsText: string | null;
	introText: string;
	followUpText: string;
};

type LetterPdfDocumentContent = {
	projectName: string;
	recipientName: string;
	letterSubject: string;
	letterDate: string;
	authorName: string;
	bodyText: string;
	attachments: Array<{ name: string }>;
};

export const PDF_VIEW_FAILURE_MESSAGE = "تعذر توليد ملف PDF، يرجى المحاولة لاحقًا.";
export const PDF_DELIVERY_FAILURE_MESSAGE = "تعذر توليد ملف PDF، لم يتم إرسال التقرير.";
export const PDF_EMPTY_CONTENT_MESSAGE = "لا يمكن إنشاء PDF لأن بيانات التقرير فارغة";
export const PDF_INVALID_OUTPUT_MESSAGE = "تعذر إنشاء ملف PDF صالح للتقرير";
export const PDF_INCOMPLETE_DATA_MESSAGE = "تعذر إنشاء التقرير لأن بياناته غير مكتملة";
export const PDF_ARABIC_FONT_MISSING_MESSAGE = "تعذر إنشاء PDF لأن ملف الخط العربي غير موجود";
export const PDF_ARABIC_FONT_NOT_LOADED_MESSAGE = "تعذر إنشاء PDF لأن الخط العربي لم يتم تحميله";
export const PDF_BRAND_LOGO_MISSING_MESSAGE = "تعذر إنشاء PDF لأن شعار كرافت غير موجود";

const PDF_MIN_BUFFER_SIZE = 1024;
const shouldLogNonProductionDiagnostics = process.env.NODE_ENV !== "production";
const PDF_USER_FACING_MESSAGES = new Set([
	PDF_VIEW_FAILURE_MESSAGE,
	PDF_DELIVERY_FAILURE_MESSAGE,
	PDF_EMPTY_CONTENT_MESSAGE,
	PDF_INVALID_OUTPUT_MESSAGE,
	PDF_INCOMPLETE_DATA_MESSAGE,
	PDF_ARABIC_FONT_MISSING_MESSAGE,
	PDF_ARABIC_FONT_NOT_LOADED_MESSAGE,
	PDF_BRAND_LOGO_MISSING_MESSAGE,
]);

type PdfGenerationDiagnostics = {
	stage:
		| "initializing"
		| "loading_payload"
		| "building_html"
		| "resolving_browser"
		| "launching_browser"
		| "creating_page"
		| "setting_content"
		| "generating_pdf"
		| "closing_browser"
		| "completed";
	browserStrategy: "local" | "serverless_chromium" | "unknown";
	resolvedExecutablePath: string | null;
	chromiumExecutablePath: string | null;
	launchStarted: boolean;
	launchSucceeded: boolean;
	pageCreated: boolean;
	setContentStarted: boolean;
	setContentSucceeded: boolean;
	pdfStarted: boolean;
	pdfSucceeded: boolean;
	userDataDir: string;
	isVercel: boolean;
	nodeEnv: string | null;
	argsCount: number;
};

const formatUnknownError = (error: unknown) => {
	if (error instanceof Error) {
		return {
			message: error.message,
			stack: error.stack || null,
			cause:
				error.cause instanceof Error
					? {
							message: error.cause.message,
							stack: error.cause.stack || null,
							cause: error.cause.cause ?? null,
						}
					: error.cause ?? null,
		};
	}

	return {
		message: String(error),
		stack: null,
		cause: null,
	};
};

const getErrorMessage = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

const getErrorStack = (error: unknown) =>
	error instanceof Error ? error.stack || null : null;

const getErrorCause = (error: unknown) =>
	error instanceof Error ? error.cause ?? null : null;

const logPdfTrace = (message: string) => {
	console.log(`[pdf] ${message}`);
};

const resolveChromiumArgs = async () => {
	const candidateArgs = chromium.args as unknown;

	if (Array.isArray(candidateArgs)) {
		return candidateArgs;
	}

	if (typeof candidateArgs === "function") {
		const resolved = await candidateArgs();
		return Array.isArray(resolved) ? resolved : [];
	}

	return [];
};

export const logPdfErrorDetails = (
	context: string,
	error: unknown,
	extra?: Record<string, unknown>
) => {
	const formatted = formatUnknownError(error);
	console.error(`[pdf] failed context=${context}`);
	console.error(`[pdf] error message=${formatted.message}`);
	console.error(`[pdf] error stack=${formatted.stack || "null"}`);
	console.error(`[pdf] error cause=${formatted.cause ? JSON.stringify(formatted.cause) : "null"}`);
	console.error(`[${context}] PDF generation error`, {
		message: formatted.message,
		stack: formatted.stack,
		cause: formatted.cause,
		...extra,
	});
};

const reportTypeLabel: Record<ActivityReport["reportType"], string> = {
	client: "تقرير للعميل",
	internal: "تقرير داخلي",
	shared: "تقرير مشترك",
};

const candidateBrowserPaths = [
	process.env.REPORT_PDF_BROWSER_PATH,
	process.env.PUPPETEER_EXECUTABLE_PATH,
	process.env.CHROME_EXECUTABLE_PATH,
	"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
	"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
	"/usr/bin/google-chrome",
	"/usr/bin/chromium-browser",
	"/usr/bin/chromium",
].filter(Boolean) as string[];

const bundledChromiumBinPath = path.join(
	process.cwd(),
	"node_modules",
	"@sparticuz",
	"chromium",
	"bin"
);
const embeddedArabicFontFamily = "CraftArabic";
const embeddedArabicFontRegularPath = path.join(
	process.cwd(),
	"public",
	"fonts",
	"Tajawal-Regular.ttf"
);
const embeddedArabicFontBoldPath = path.join(
	process.cwd(),
	"public",
	"fonts",
	"Tajawal-Bold.ttf"
);
const embeddedBrandLogoPath = path.join(
	process.cwd(),
	"public",
	"brand",
	"craft-logo-black.png"
);

const createEmbeddedAssetLoader = ({
	assetPath,
	missingMessage,
	allowMissing = false,
}: {
	assetPath: string;
	missingMessage: string;
	allowMissing?: boolean;
}) => {
	let assetBase64Promise: Promise<string | null> | null = null;

	return async () => {
		if (!assetBase64Promise) {
			assetBase64Promise = (async () => {
				try {
					const assetBuffer = await fs.readFile(assetPath);

					if (assetBuffer.length === 0) {
						if (allowMissing) {
							return null;
						}

						throw new Error(missingMessage);
					}

					return assetBuffer.toString("base64");
				} catch (error) {
					const code =
						typeof error === "object" &&
						error !== null &&
						"code" in error &&
						typeof (error as { code?: unknown }).code === "string"
							? (error as { code: string }).code
							: null;

					if (allowMissing && code === "ENOENT") {
						return null;
					}

					if (error instanceof Error && error.message === missingMessage) {
						throw error;
					}

					throw new Error(missingMessage, { cause: error });
				}
			})();
		}

		try {
			return await assetBase64Promise;
		} catch (error) {
			assetBase64Promise = null;
			throw error;
		}
	};
};

const escapeHtml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

const normalizeText = (value?: string | null) => value?.trim() ?? "";

const hasMeaningfulText = (value?: string | null) => normalizeText(value).length > 0;

const loadEmbeddedArabicFontRegularBase64 = createEmbeddedAssetLoader({
	assetPath: embeddedArabicFontRegularPath,
	missingMessage: PDF_ARABIC_FONT_MISSING_MESSAGE,
});

const loadEmbeddedArabicFontBoldBase64 = createEmbeddedAssetLoader({
	assetPath: embeddedArabicFontBoldPath,
	missingMessage: PDF_ARABIC_FONT_MISSING_MESSAGE,
	allowMissing: true,
});

const loadEmbeddedBrandLogoBase64 = createEmbeddedAssetLoader({
	assetPath: embeddedBrandLogoPath,
	missingMessage: PDF_BRAND_LOGO_MISSING_MESSAGE,
});

export const getReportPdfFileName = (reportId: string) => `report-${reportId}.pdf`;
export const getLetterPdfFileName = (letterId: string) => `letter-${letterId}.pdf`;

const buildReportDocumentContent = ({
	project,
	report,
	approvedByName,
}: ReportDocumentPayload): ReportPdfDocumentContent => {
	const rawProjectName = normalizeText(project.name);
	const rawClientName = normalizeText(project.clientName);
	const rawReportTitle = normalizeText(report.title);
	const rawAuthorName = normalizeText(report.authorName) || normalizeText(approvedByName);
	const rawSummary = normalizeText(report.summary);
	const rawWorkDetails = normalizeText(report.workDetails);
	const rawDetails = normalizeText(report.details);
	const reportType = reportTypeLabel[report.reportType];

	if (!rawProjectName || !rawReportTitle || !reportType) {
		throw new Error(PDF_INCOMPLETE_DATA_MESSAGE);
	}

	if (!rawSummary && !rawWorkDetails && !rawDetails) {
		throw new Error(PDF_EMPTY_CONTENT_MESSAGE);
	}

	const reportDate = report.createdAt
		? new Date(report.createdAt).toLocaleDateString("ar-SA")
		: "غير محدد";

	if (!reportDate) {
		throw new Error(PDF_INCOMPLETE_DATA_MESSAGE);
	}

	return {
		projectName: rawProjectName,
		clientName: rawClientName || null,
		reportTitle: rawReportTitle,
		reportType,
		reportDate,
		authorName: rawAuthorName || "غير محدد",
		summaryText: rawSummary || null,
		workText: rawWorkDetails || null,
		detailsText: rawDetails || null,
		introText:
			"نقدم لكم هذا التقرير الذي يوضح الأعمال التي تم إنجازها في الموقع خلال الفترة المحددة، مع توضيح أبرز التحديثات والتحسينات التي تم تنفيذها، وذلك بهدف توثيق سير العمل ومتابعة تقدم المشروع بشكل واضح ومنظم.",
		followUpText:
			"نؤكد أن الأعمال المذكورة أعلاه تم تنفيذها ضمن خطة تطوير الموقع، وسيتم استكمال بقية التحسينات والاختبارات لضمان استقرار النظام ورفع جودة تجربة المستخدم.",
	};
};

const buildLetterDocumentContent = ({ project, letter }: LetterDocumentPayload): LetterPdfDocumentContent => {
	const projectName = normalizeText(project.name);
	const recipientName = normalizeText(letter.recipientName);
	const letterSubject = normalizeText(letter.subject);
	const bodyText = normalizeText(letter.body);
	const authorName = normalizeText(letter.authorName) || "غير محدد";
	const letterDate = letter.letterDate
		? new Date(letter.letterDate).toLocaleDateString("ar-SA")
		: letter.createdAt
			? new Date(letter.createdAt).toLocaleDateString("ar-SA")
			: "غير محدد";
	const attachments = (letter.attachments ?? [])
		.map((attachment, index) => normalizeText(attachment.name) || `مرفق ${index + 1}`)
		.filter((name) => name.length > 0)
		.map((name) => ({ name }));

	if (!projectName || !recipientName || !letterSubject || !bodyText) {
		throw new Error(PDF_INCOMPLETE_DATA_MESSAGE);
	}

	return {
		projectName,
		recipientName,
		letterSubject,
		letterDate,
		authorName,
		bodyText,
		attachments,
	};
};

export const validateReportDocumentPayload = (payload: ReportDocumentPayload) => {
	const content = buildReportDocumentContent(payload);

	if (shouldLogNonProductionDiagnostics) {
		logPdfTrace(
			[
				`payload.reportId=${payload.report.id}`,
				`hasProjectName=${String(content.projectName.length > 0)}`,
				`hasClientName=${String(Boolean(content.clientName))}`,
				`hasTitle=${String(content.reportTitle.length > 0)}`,
				`hasSummary=${String(hasMeaningfulText(payload.report.summary))}`,
				`hasDetails=${String(hasMeaningfulText(payload.report.details))}`,
				`hasWorkDetails=${String(hasMeaningfulText(payload.report.workDetails))}`,
				`hasAuthor=${String(content.authorName.length > 0)}`,
			].join(" ")
		);
	}

	return content;
};

export const validateGeneratedPdfBuffer = (pdfBuffer: Buffer) => {
	if (pdfBuffer.length <= PDF_MIN_BUFFER_SIZE) {
		throw new Error(PDF_INVALID_OUTPUT_MESSAGE);
	}

	if (pdfBuffer.subarray(0, 4).toString("utf8") !== "%PDF") {
		throw new Error(PDF_INVALID_OUTPUT_MESSAGE);
	}
};

export const getReportPdfUserMessage = (error: unknown, fallbackMessage: string) => {
	if (error instanceof Error && PDF_USER_FACING_MESSAGES.has(error.message)) {
		return error.message;
	}

	return fallbackMessage;
};

export const getReportPdfPayload = async ({
	reportId,
	user,
	approvedByName,
}: {
	reportId: string;
	user: ReportLookupUser;
	approvedByName?: string | null;
}): Promise<ReportPdfLoadSuccess | ReportPdfLoadFailure> => {
	const report = await getReportById(reportId, user);
	if (!report) {
		return { error: "report_not_found" };
	}

	const project = await getProjectAndClientById(report.projectId);
	if (!project) {
		return { error: "project_not_found" };
	}

	const payload: ReportDocumentPayload = {
		project,
		report,
		approvedByName: report.approvedByName || approvedByName || null,
	};

	validateReportDocumentPayload(payload);

	return { payload };
};

export const buildReportHtml = async (payload: ReportDocumentPayload) => {
	const content = validateReportDocumentPayload(payload);
	const embeddedArabicFontRegularBase64 = await loadEmbeddedArabicFontRegularBase64();
	const embeddedArabicFontBoldBase64 =
		(await loadEmbeddedArabicFontBoldBase64()) ?? embeddedArabicFontRegularBase64;
	const embeddedBrandLogoBase64 = await loadEmbeddedBrandLogoBase64();
	const recipientBlock = content.clientName
		? `<section class="recipient-block">
      <p class="recipient-label">الجهة</p>
      <p class="recipient-name">${escapeHtml(content.clientName)}</p>
    </section>`
		: "";
	const summarySection = hasMeaningfulText(content.summaryText)
		? `<section class="content-section">
      <h2>ملخص التقرير</h2>
      <p>${escapeHtml(content.summaryText!)}</p>
    </section>`
		: "";
	const workSection = hasMeaningfulText(content.workText)
		? `<section class="content-section">
      <h2>الأعمال المنجزة</h2>
      <p>${escapeHtml(content.workText!)}</p>
    </section>`
		: "";
	const detailsSection = hasMeaningfulText(content.detailsText)
		? `<section class="content-section">
      <h2>${hasMeaningfulText(content.workText) ? "تفاصيل التقرير" : "محتوى التقرير"}</h2>
      <p>${escapeHtml(content.detailsText!)}</p>
    </section>`
		: "";

	const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.reportTitle)}</title>
  <style>
    @font-face {
      font-family: "${embeddedArabicFontFamily}";
      src: url("data:font/ttf;base64,${embeddedArabicFontRegularBase64}") format("truetype");
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: "${embeddedArabicFontFamily}";
      src: url("data:font/ttf;base64,${embeddedArabicFontBoldBase64}") format("truetype");
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }

    @page {
      size: A4;
      margin: 24mm 18mm 34mm;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      direction: rtl;
      text-align: right;
      unicode-bidi: plaintext;
      background: #ffffff;
      color: #000000;
      font-family: "${embeddedArabicFontFamily}", Arial, Tahoma, sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
      font-synthesis: none;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
      font-family: "${embeddedArabicFontFamily}", Arial, Tahoma, sans-serif;
    }

    body {
      width: 100%;
      min-height: 297mm;
    }

    main {
      position: relative;
      padding: 0 0 28mm;
      box-sizing: border-box;
      background: #ffffff;
    }

    .page-header {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 12mm;
      padding-top: 2mm;
    }

    .page-header img {
      width: 150px;
      height: auto;
      display: block;
    }

    .document-card {
      border: 1px solid #d7d2c8;
      border-radius: 18px;
      padding: 14mm 12mm 16mm;
      background: #ffffff;
    }

    .document-topline {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10mm;
      margin-bottom: 10mm;
      border-bottom: 1px solid #e7e1d5;
      padding-bottom: 6mm;
    }

    .document-date,
    .document-type {
      margin: 0;
      font-size: 13px;
      line-height: 1.8;
      color: #403a32;
    }

    .document-type {
      text-align: left;
    }

    .document-title {
      margin: 0 0 8mm;
      text-align: center;
      font-size: 24px;
      font-weight: 700;
      color: #111111;
      unicode-bidi: plaintext;
    }

    .recipient-block {
      margin-bottom: 8mm;
    }

    .recipient-label {
      margin: 0 0 2mm;
      font-size: 13px;
      color: #6f675b;
    }

    .recipient-name {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #131313;
    }

    .subject-block {
      margin-bottom: 8mm;
      padding: 4mm 5mm;
      background: #f7f4ee;
      border-radius: 12px;
    }

    .subject-label {
      margin: 0 0 1.5mm;
      font-size: 13px;
      color: #6f675b;
    }

    .subject-title {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #111111;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4mm 8mm;
      margin-bottom: 9mm;
      padding: 4mm 5mm;
      border: 1px solid #ece6dc;
      border-radius: 12px;
    }

    .meta-item {
      margin: 0;
    }

    .meta-label {
      display: block;
      margin-bottom: 1mm;
      font-size: 12px;
      color: #7a7368;
    }

    .meta-value {
      display: block;
      font-size: 14px;
      font-weight: 700;
      color: #141414;
    }

    .document-date,
    .document-type,
    .recipient-label,
    .recipient-name,
    .subject-label,
    .subject-title,
    .meta-label,
    .meta-value,
    h2,
    p {
      unicode-bidi: plaintext;
    }

    .salutation,
    .closing-note {
      margin-bottom: 7mm;
    }

    .content-section {
      margin-bottom: 7mm;
      page-break-inside: avoid;
    }

    h2 {
      font-size: 17px;
      margin: 0 0 3mm;
      font-weight: 700;
      color: #151515;
    }

    p {
      font-size: 15px;
      line-height: 2.05;
      margin: 0 0 3mm;
      white-space: pre-line;
      word-break: break-word;
      color: #1f1f1f;
    }

    .signoff {
      margin-top: 10mm;
    }

    .signoff p {
      margin-bottom: 1mm;
    }

    .signoff .signoff-name {
      font-weight: 700;
    }

    .page-footer {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0 18mm 10mm;
      text-align: center;
      background: #ffffff;
    }

    .page-footer::before {
      content: "";
      display: block;
      width: 100%;
      border-top: 1px solid #d9d2c6;
      margin-bottom: 3mm;
    }

    .page-footer p {
      margin: 0;
      font-size: 11px;
      line-height: 1.75;
      color: #49443d;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <main>
    <header class="page-header">
      <img src="data:image/png;base64,${embeddedBrandLogoBase64}" alt="Craft Logo" />
    </header>

    <section class="document-card">
      <div class="document-topline">
        <p class="document-date">التاريخ: ${escapeHtml(content.reportDate)}</p>
        <p class="document-type">${escapeHtml(content.reportType)}</p>
      </div>

      <h1 class="document-title">تقرير أعمال الموقع</h1>

      ${recipientBlock}

      <section class="subject-block">
        <p class="subject-label">عنوان التقرير</p>
        <p class="subject-title">${escapeHtml(content.reportTitle)}</p>
      </section>

      <section class="meta-grid">
        <p class="meta-item">
          <span class="meta-label">اسم المشروع</span>
          <span class="meta-value">${escapeHtml(content.projectName)}</span>
        </p>
        <p class="meta-item">
          <span class="meta-label">إعداد</span>
          <span class="meta-value">${escapeHtml(content.authorName)}</span>
        </p>
      </section>

      <section class="salutation">
        <p>السلام عليكم ورحمة الله وبركاته،</p>
      </section>

      <section class="content-section">
        <p>${escapeHtml(content.introText)}</p>
      </section>

      ${summarySection}
      ${workSection}
      ${detailsSection}

      <section class="closing-note">
        <p>${escapeHtml(content.followUpText)}</p>
      </section>

      <section class="signoff">
        <p>وتفضلوا بقبول فائق الاحترام،</p>
        <p class="signoff-name">شركة كرافت</p>
      </section>
    </section>
  </main>
  <footer class="page-footer">
    <p>+966 55 536 4848</p>
    <p>info@craftksa.com | www.craftksa.com</p>
    <p>RIYADH | SAUDI ARABIA</p>
  </footer>
</body>
</html>`;

	if (shouldLogNonProductionDiagnostics) {
		logPdfTrace(
			[
				`html.reportId=${payload.report.id}`,
				`fontRegularEmbedded=${String(embeddedArabicFontRegularBase64.length > 0)}`,
				`fontBoldEmbedded=${String(embeddedArabicFontBoldBase64.length > 0)}`,
				`logoEmbedded=${String(embeddedBrandLogoBase64.length > 0)}`,
				`hasTitle=${String(html.includes(escapeHtml(content.reportTitle)))}`,
				`hasProject=${String(html.includes(escapeHtml(content.projectName)))}`,
				`hasSummary=${String(
					hasMeaningfulText(content.summaryText)
						? html.includes(escapeHtml(content.summaryText!))
						: true
				)}`,
				`hasWork=${String(
					hasMeaningfulText(content.workText)
						? html.includes(escapeHtml(content.workText!))
						: true
				)}`,
				`hasDetails=${String(
					hasMeaningfulText(content.detailsText)
						? html.includes(escapeHtml(content.detailsText!))
						: true
				)}`,
			].join(" ")
		);
	}

	return html;
};

export const buildLetterHtml = async (payload: LetterDocumentPayload) => {
	const content = buildLetterDocumentContent(payload);
	const embeddedArabicFontRegularBase64 = await loadEmbeddedArabicFontRegularBase64();
	const embeddedArabicFontBoldBase64 =
		(await loadEmbeddedArabicFontBoldBase64()) ?? embeddedArabicFontRegularBase64;
	const embeddedBrandLogoBase64 = await loadEmbeddedBrandLogoBase64();
	const attachmentsSection = content.attachments.length
		? `<section class="attachments-section">
      <h2>المرفقات:</h2>
      ${content.attachments
				.map((attachment) => `<p class="attachment-item">• ${escapeHtml(attachment.name)}</p>`)
				.join("")}
    </section>`
		: "";

	return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.letterSubject)}</title>
  <style>
    @font-face {
      font-family: "${embeddedArabicFontFamily}";
      src: url("data:font/ttf;base64,${embeddedArabicFontRegularBase64}") format("truetype");
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "${embeddedArabicFontFamily}";
      src: url("data:font/ttf;base64,${embeddedArabicFontBoldBase64}") format("truetype");
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @page {
      size: A4;
      margin: 24mm 18mm 34mm;
    }
    html, body {
      margin: 0;
      padding: 0;
      direction: rtl;
      text-align: right;
      unicode-bidi: plaintext;
      background: #ffffff;
      color: #000000;
      font-family: "${embeddedArabicFontFamily}", Arial, Tahoma, sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
      font-synthesis: none;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      font-family: "${embeddedArabicFontFamily}", Arial, Tahoma, sans-serif;
    }
    body {
      width: 100%;
      min-height: 297mm;
    }
    main {
      position: relative;
      padding: 0 0 28mm;
      background: #ffffff;
    }
    .page-header {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 10mm;
      padding-top: 2mm;
    }
    .page-header img {
      width: 150px;
      height: auto;
      display: block;
    }
    .letter-page {
      padding: 0 6mm;
    }
    .document-date,
    .recipient-label,
    .recipient-name,
    .subject-line,
    .project-line,
    .prepared-by,
    h2,
    p {
      unicode-bidi: plaintext;
    }
    .document-meta {
      margin-bottom: 10mm;
    }
    .document-date {
      margin: 0;
      font-size: 14px;
      line-height: 1.9;
      color: #222222;
    }
    .document-title {
      margin: 0 0 9mm;
      text-align: center;
      font-size: 23px;
      font-weight: 700;
      color: #111111;
    }
    .recipient-block {
      margin-bottom: 8mm;
    }
    .recipient-label {
      margin: 0 0 2mm;
      font-size: 14px;
      color: #1f1f1f;
    }
    .recipient-name {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #101010;
    }
    .project-line,
    .subject-line,
    .prepared-by {
      margin: 0 0 4mm;
      font-size: 15px;
      line-height: 1.95;
      color: #161616;
    }
    .salutation,
    .closing-note {
      margin-bottom: 7mm;
    }
    .content-section {
      margin-bottom: 6mm;
      page-break-inside: avoid;
    }
    .attachments-section {
      margin-top: 8mm;
      margin-bottom: 6mm;
      page-break-inside: avoid;
    }
    h2 {
      font-size: 16px;
      margin: 0 0 3mm;
      font-weight: 700;
      color: #151515;
    }
    p {
      font-size: 15px;
      line-height: 2.2;
      margin: 0 0 3mm;
      white-space: pre-line;
      word-break: break-word;
      color: #111111;
    }
    .attachment-item {
      margin-bottom: 2mm;
    }
    .signoff {
      margin-top: 12mm;
    }
    .signoff p {
      margin-bottom: 1mm;
    }
    .signoff .signoff-name {
      font-weight: 700;
    }
    .page-footer {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0 18mm 10mm;
      text-align: center;
      background: #ffffff;
    }
    .page-footer::before {
      content: "";
      display: block;
      width: 100%;
      border-top: 1px solid #d9d2c6;
      margin-bottom: 3mm;
    }
    .page-footer p {
      margin: 0;
      font-size: 11px;
      line-height: 1.75;
      color: #49443d;
    }
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <main>
    <header class="page-header">
      <img src="data:image/png;base64,${embeddedBrandLogoBase64}" alt="Craft Logo" />
    </header>

    <section class="letter-page">
      <div class="document-meta">
        <p class="document-date">التاريخ: ${escapeHtml(content.letterDate)}</p>
      </div>

      <h1 class="document-title">خطاب رسمي</h1>

      <section class="recipient-block">
        <p class="recipient-label">الجهة / الشخص الموجه له الخطاب</p>
        <p class="recipient-name">${escapeHtml(content.recipientName)}</p>
      </section>

      <p class="project-line">اسم المشروع: ${escapeHtml(content.projectName)}</p>
      <p class="subject-line">الموضوع: ${escapeHtml(content.letterSubject)}</p>

      <section class="salutation">
        <p>تحية طيبة وبعد،</p>
      </section>

      <section class="content-section">
        <p>${escapeHtml(content.bodyText)}</p>
      </section>

      ${attachmentsSection}

      <section class="closing-note">
        <p>وتفضلوا بقبول فائق التحية والتقدير،</p>
      </section>

      <section class="signoff">
        <p class="prepared-by">إعداد: ${escapeHtml(content.authorName)}</p>
        <p class="signoff-name">${escapeHtml(content.authorName)}</p>
      </section>
    </section>
  </main>
  <footer class="page-footer">
    <p>+966 55 536 4848</p>
    <p>info@craftksa.com | www.craftksa.com</p>
    <p>RIYADH | SAUDI ARABIA</p>
  </footer>
</body>
</html>`;
};

const findLocalBrowserExecutable = async () => {
	for (const browserPath of candidateBrowserPaths) {
		try {
			await fs.access(browserPath);
			return browserPath;
		} catch {
			continue;
		}
	}

	return null;
};

const resolveBrowserLaunchConfig = async (diagnostics: PdfGenerationDiagnostics) => {
	logPdfTrace("stage=resolve-browser");
	const localExecutablePath = await findLocalBrowserExecutable();
	if (localExecutablePath) {
		diagnostics.browserStrategy = "local";
		diagnostics.resolvedExecutablePath = localExecutablePath;
		diagnostics.argsCount = 3;
		logPdfTrace("stage=resolve-browser strategy=local");
		logPdfTrace(`executablePath=${localExecutablePath}`);
		return {
			args: ["--disable-gpu", "--no-sandbox", "--disable-setuid-sandbox"],
			defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
			executablePath: localExecutablePath,
			headless: true as const,
		};
	}

	chromium.setGraphicsMode = false;
	logPdfTrace("stage=resolve-chromium");
	let chromiumExecutablePath: string | null = null;
	try {
		await fs.access(bundledChromiumBinPath);
		logPdfTrace(`chromium.binPath=${bundledChromiumBinPath}`);
		chromiumExecutablePath = await chromium.executablePath(bundledChromiumBinPath);
	} catch {
		logPdfTrace(`chromium.binPath-missing=${bundledChromiumBinPath}`);
		chromiumExecutablePath = await chromium.executablePath();
	}
	diagnostics.browserStrategy = "serverless_chromium";
	diagnostics.chromiumExecutablePath = chromiumExecutablePath || null;
	diagnostics.resolvedExecutablePath = chromiumExecutablePath || null;
	const chromiumArgs = await resolveChromiumArgs();
	diagnostics.argsCount = chromiumArgs.length;
	logPdfTrace(`chromium.executablePath=${chromiumExecutablePath || "null"}`);
	logPdfTrace(`chromium.args.count=${chromiumArgs.length}`);
	return {
		args: chromiumArgs,
		defaultViewport: chromium.defaultViewport,
		executablePath: chromiumExecutablePath,
		headless: true as const,
	};
};

export const generateReportPdfBuffer = async (payload: ReportDocumentPayload) => {
	const userDataDir = path.join(os.tmpdir(), `craft-report-${randomUUID()}`);
	let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
	const diagnostics: PdfGenerationDiagnostics = {
		stage: "initializing",
		browserStrategy: "unknown",
		resolvedExecutablePath: null,
		chromiumExecutablePath: null,
		launchStarted: false,
		launchSucceeded: false,
		pageCreated: false,
		setContentStarted: false,
		setContentSucceeded: false,
		pdfStarted: false,
		pdfSucceeded: false,
		userDataDir,
		isVercel: !!process.env.VERCEL,
		nodeEnv: process.env.NODE_ENV ?? null,
		argsCount: 0,
	};

	try {
		logPdfTrace("request=generateReportPdfBuffer started");
		logPdfTrace(`projectId=${payload.project.id}`);
		logPdfTrace(`reportId=${payload.report.id}`);
		logPdfTrace(`isVercel=${String(diagnostics.isVercel)}`);
		logPdfTrace(`nodeEnv=${diagnostics.nodeEnv || "null"}`);
		logPdfTrace(`userDataDir=${userDataDir}`);
		logPdfTrace(`embeddedArabicFontRegularPath=${embeddedArabicFontRegularPath}`);
		logPdfTrace(`embeddedArabicFontBoldPath=${embeddedArabicFontBoldPath}`);
		logPdfTrace(`embeddedBrandLogoPath=${embeddedBrandLogoPath}`);
		diagnostics.stage = "building_html";
		logPdfTrace("stage=build-html");
		const html = await buildReportHtml(payload);

		if (!html.includes('<html lang="ar" dir="rtl">')) {
			throw new Error(PDF_INVALID_OUTPUT_MESSAGE);
		}

		if (
			!html.includes(escapeHtml(normalizeText(payload.report.title))) ||
			!html.includes(escapeHtml(normalizeText(payload.project.name)))
		) {
			throw new Error(PDF_INCOMPLETE_DATA_MESSAGE);
		}

		if (
			!html.includes("data:image/png;base64,") ||
			!html.includes(`font-family: "${embeddedArabicFontFamily}"`)
		) {
			throw new Error(PDF_INVALID_OUTPUT_MESSAGE);
		}

		diagnostics.stage = "resolving_browser";
		const launchConfig = await resolveBrowserLaunchConfig(diagnostics);
		const launchArgs = Array.isArray(launchConfig.args) ? launchConfig.args : [];
		diagnostics.stage = "launching_browser";
		diagnostics.launchStarted = true;
		logPdfTrace(`resolvedExecutablePath=${diagnostics.resolvedExecutablePath || "null"}`);
		logPdfTrace(`launchArgsCount=${launchArgs.length}`);
		logPdfTrace("stage=launch-browser");
		browser = await puppeteer.launch({
			...launchConfig,
			args: [...launchArgs, `--user-data-dir=${userDataDir}`],
			ignoreHTTPSErrors: true,
		});
		diagnostics.launchSucceeded = true;
		logPdfTrace("stage=launch-browser success=true");

		diagnostics.stage = "creating_page";
		logPdfTrace("stage=create-page");
		const page = await browser.newPage();
		diagnostics.pageCreated = true;
		diagnostics.stage = "setting_content";
		diagnostics.setContentStarted = true;
		logPdfTrace("stage=set-content");
		await page.setContent(html, {
			waitUntil: "networkidle0",
		});
		diagnostics.setContentSucceeded = true;
		logPdfTrace("stage=set-content success=true");
		await page.emulateMediaType("screen");
		logPdfTrace("stage=wait-for-fonts");
		await page.evaluate(async () => {
			const documentWithFonts = document as Document & {
				fonts?: {
					ready?: Promise<unknown>;
				};
			};

			if (documentWithFonts.fonts?.ready) {
				await documentWithFonts.fonts.ready;
			}
		});
		const arabicFontLoaded = await page.evaluate(
			async (fontFamily) => {
				const documentWithFonts = document as Document & {
					fonts?: {
						ready?: Promise<unknown>;
						check?: (font: string) => boolean;
					};
				};

				if (!documentWithFonts.fonts?.ready) {
					return false;
				}

				await documentWithFonts.fonts.ready;

				if (typeof documentWithFonts.fonts.check !== "function") {
					return false;
				}

				return documentWithFonts.fonts.check(`12px ${fontFamily}`);
			},
			embeddedArabicFontFamily
		);
		logPdfTrace(`font.${embeddedArabicFontFamily}.loaded=${String(arabicFontLoaded)}`);
		if (!arabicFontLoaded) {
			throw new Error(PDF_ARABIC_FONT_NOT_LOADED_MESSAGE);
		}
		await page.waitForFunction(
			() => Boolean(document.body?.innerText?.trim().length),
			{ timeout: 3000 }
		);

		diagnostics.stage = "generating_pdf";
		diagnostics.pdfStarted = true;
		logPdfTrace("stage=page-pdf");
		const pdfBuffer = await page.pdf({
			format: "A4",
			printBackground: true,
			preferCSSPageSize: true,
		});
		const normalizedPdfBuffer = Buffer.from(pdfBuffer);
		validateGeneratedPdfBuffer(normalizedPdfBuffer);
		diagnostics.pdfSucceeded = true;
		diagnostics.stage = "completed";
		logPdfTrace("stage=page-pdf success=true");
		logPdfTrace(`pdf.size=${normalizedPdfBuffer.length}`);
		logPdfTrace("stage=completed");

		return normalizedPdfBuffer;
	} catch (error) {
		console.error(`[pdf] failed stage=${diagnostics.stage}`);
		console.error(`[pdf] launchStarted=${String(diagnostics.launchStarted)}`);
		console.error(`[pdf] launchSucceeded=${String(diagnostics.launchSucceeded)}`);
		console.error(`[pdf] pageCreated=${String(diagnostics.pageCreated)}`);
		console.error(`[pdf] setContentStarted=${String(diagnostics.setContentStarted)}`);
		console.error(`[pdf] setContentSucceeded=${String(diagnostics.setContentSucceeded)}`);
		console.error(`[pdf] pdfStarted=${String(diagnostics.pdfStarted)}`);
		console.error(`[pdf] pdfSucceeded=${String(diagnostics.pdfSucceeded)}`);
		console.error(`[pdf] browserStrategy=${diagnostics.browserStrategy}`);
		console.error(`[pdf] executablePath=${diagnostics.resolvedExecutablePath || "null"}`);
		console.error(`[pdf] chromiumExecutablePath=${diagnostics.chromiumExecutablePath || "null"}`);
		console.error(`[pdf] argsCount=${String(diagnostics.argsCount)}`);
		console.error(`[pdf] error message=${getErrorMessage(error)}`);
		console.error(`[pdf] error stack=${getErrorStack(error) || "null"}`);
		console.error(
			`[pdf] error cause=${
				getErrorCause(error) ? JSON.stringify(getErrorCause(error)) : "null"
			}`
		);
		logPdfErrorDetails("generateReportPdfBuffer", error, { diagnostics });
		throw new Error(getReportPdfUserMessage(error, PDF_INVALID_OUTPUT_MESSAGE), {
			cause: {
				...formatUnknownError(error),
				diagnostics,
			},
		});
	} finally {
		if (browser) {
			try {
				diagnostics.stage = "closing_browser";
				await browser.close();
			} catch {
				// Ignore close failures.
			}
		}

		await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
	}
};

export const generateLetterPdfBuffer = async (payload: LetterDocumentPayload) => {
	const userDataDir = path.join(os.tmpdir(), `craft-letter-${randomUUID()}`);
	let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
	const diagnostics: PdfGenerationDiagnostics = {
		stage: "initializing",
		browserStrategy: "unknown",
		resolvedExecutablePath: null,
		chromiumExecutablePath: null,
		launchStarted: false,
		launchSucceeded: false,
		pageCreated: false,
		setContentStarted: false,
		setContentSucceeded: false,
		pdfStarted: false,
		pdfSucceeded: false,
		userDataDir,
		isVercel: !!process.env.VERCEL,
		nodeEnv: process.env.NODE_ENV ?? null,
		argsCount: 0,
	};

	try {
		logPdfTrace("request=generateLetterPdfBuffer started");
		logPdfTrace(`projectId=${payload.project.id}`);
		logPdfTrace(`letterId=${payload.letter.id}`);
		diagnostics.stage = "building_html";
		const html = await buildLetterHtml(payload);
		if (!html.includes('<html lang="ar" dir="rtl">')) {
			throw new Error(PDF_INVALID_OUTPUT_MESSAGE);
		}

		diagnostics.stage = "resolving_browser";
		const launchConfig = await resolveBrowserLaunchConfig(diagnostics);
		const launchArgs = Array.isArray(launchConfig.args) ? launchConfig.args : [];
		diagnostics.stage = "launching_browser";
		diagnostics.launchStarted = true;
		browser = await puppeteer.launch({
			...launchConfig,
			args: [...launchArgs, `--user-data-dir=${userDataDir}`],
			ignoreHTTPSErrors: true,
		});
		diagnostics.launchSucceeded = true;

		diagnostics.stage = "creating_page";
		const page = await browser.newPage();
		diagnostics.pageCreated = true;
		diagnostics.stage = "setting_content";
		diagnostics.setContentStarted = true;
		await page.setContent(html, {
			waitUntil: "networkidle0",
		});
		diagnostics.setContentSucceeded = true;
		await page.emulateMediaType("screen");
		await page.evaluate(async () => {
			const documentWithFonts = document as Document & {
				fonts?: {
					ready?: Promise<unknown>;
				};
			};

			if (documentWithFonts.fonts?.ready) {
				await documentWithFonts.fonts.ready;
			}
		});

		const arabicFontLoaded = await page.evaluate(
			async (fontFamily) => {
				const documentWithFonts = document as Document & {
					fonts?: {
						ready?: Promise<unknown>;
						check?: (font: string) => boolean;
					};
				};

				if (!documentWithFonts.fonts?.ready) {
					return false;
				}

				await documentWithFonts.fonts.ready;

				if (typeof documentWithFonts.fonts.check !== "function") {
					return false;
				}

				return documentWithFonts.fonts.check(`12px ${fontFamily}`);
			},
			embeddedArabicFontFamily
		);

		if (!arabicFontLoaded) {
			throw new Error(PDF_ARABIC_FONT_NOT_LOADED_MESSAGE);
		}

		diagnostics.stage = "generating_pdf";
		diagnostics.pdfStarted = true;
		const pdfBuffer = await page.pdf({
			format: "A4",
			printBackground: true,
			preferCSSPageSize: true,
		});
		const normalizedPdfBuffer = Buffer.from(pdfBuffer);
		validateGeneratedPdfBuffer(normalizedPdfBuffer);
		diagnostics.pdfSucceeded = true;
		diagnostics.stage = "completed";
		return normalizedPdfBuffer;
	} catch (error) {
		logPdfErrorDetails("generateLetterPdfBuffer", error, { diagnostics });
		throw new Error(getReportPdfUserMessage(error, PDF_INVALID_OUTPUT_MESSAGE), {
			cause: {
				...formatUnknownError(error),
				diagnostics,
			},
		});
	} finally {
		if (browser) {
			try {
				diagnostics.stage = "closing_browser";
				await browser.close();
			} catch {
				// Ignore close failures.
			}
		}

		await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
	}
};
