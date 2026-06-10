import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import {
	getProjectAndClientById,
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
	summaryText: string;
	workText: string;
	introText: string;
	followUpText: string;
};

export const PDF_VIEW_FAILURE_MESSAGE = "تعذر توليد ملف PDF، يرجى المحاولة لاحقًا.";
export const PDF_DELIVERY_FAILURE_MESSAGE = "تعذر توليد ملف PDF، لم يتم إرسال التقرير.";
export const PDF_EMPTY_CONTENT_MESSAGE = "لا يمكن إنشاء PDF لأن بيانات التقرير فارغة";
export const PDF_INVALID_OUTPUT_MESSAGE = "تعذر إنشاء ملف PDF صالح للتقرير";
export const PDF_INCOMPLETE_DATA_MESSAGE = "تعذر إنشاء التقرير لأن بياناته غير مكتملة";

const PDF_MIN_BUFFER_SIZE = 1024;
const shouldLogNonProductionDiagnostics = process.env.NODE_ENV !== "production";
const PDF_USER_FACING_MESSAGES = new Set([
	PDF_VIEW_FAILURE_MESSAGE,
	PDF_DELIVERY_FAILURE_MESSAGE,
	PDF_EMPTY_CONTENT_MESSAGE,
	PDF_INVALID_OUTPUT_MESSAGE,
	PDF_INCOMPLETE_DATA_MESSAGE,
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

const escapeHtml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

const normalizeText = (value?: string | null) => value?.trim() ?? "";

const hasMeaningfulText = (value?: string | null) => normalizeText(value).length > 0;

export const getReportPdfFileName = (reportId: string) => `report-${reportId}.pdf`;

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
		summaryText: rawSummary || "لا يوجد ملخص مضاف لهذا التقرير.",
		workText: rawWorkDetails || rawDetails || "لا توجد أعمال منجزة مضافة لهذا التقرير.",
		introText:
			"نقدم لكم هذا التقرير الذي يوضح الأعمال التي تم إنجازها في الموقع خلال الفترة المحددة، مع توضيح أبرز التحديثات والتحسينات التي تم تنفيذها، وذلك بهدف توثيق سير العمل ومتابعة تقدم المشروع بشكل واضح ومنظم.",
		followUpText:
			"نؤكد أن الأعمال المذكورة أعلاه تم تنفيذها ضمن خطة تطوير الموقع، وسيتم استكمال بقية التحسينات والاختبارات لضمان استقرار النظام ورفع جودة تجربة المستخدم.",
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

	const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.reportTitle)}</title>
  <style>
    @page {
      size: A4;
      margin: 24mm 22mm;
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
      font-family: Arial, Tahoma, "Noto Sans Arabic", "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    body {
      width: 210mm;
      min-height: 297mm;
    }

    main {
      padding: 24mm 22mm;
      box-sizing: border-box;
      background: #ffffff;
    }

    h1 {
      text-align: center;
      font-size: 26px;
      margin: 0 0 18mm;
      font-weight: 700;
      unicode-bidi: plaintext;
    }

    .meta {
      margin-bottom: 14mm;
      line-height: 1.9;
    }

    .meta p,
    h2,
    p {
      unicode-bidi: plaintext;
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
      word-break: break-word;
    }
  </style>
</head>
<body>
  <main>
    <h1>تقرير أعمال الموقع</h1>

    <section class="meta">
      <p>اسم المشروع: ${escapeHtml(content.projectName)}</p>
      <p>عنوان التقرير: ${escapeHtml(content.reportTitle)}</p>
      <p>نوع التقرير: ${escapeHtml(content.reportType)}</p>
      <p>التاريخ: ${escapeHtml(content.reportDate)}</p>
      <p>إعداد: ${escapeHtml(content.authorName)}</p>
    </section>

    <section>
      <p>السلام عليكم ورحمة الله وبركاته،</p>
    </section>

    <section>
      <p>${escapeHtml(content.introText)}</p>
    </section>

    <section>
      <h2>ملخص التقرير</h2>
      <p>${escapeHtml(content.summaryText)}</p>
    </section>

    <section>
      <h2>الأعمال المنجزة</h2>
      <p>${escapeHtml(content.workText)}</p>
    </section>

    <section>
      <p>${escapeHtml(content.followUpText)}</p>
    </section>

    <section>
      <p>أطيب التحيات،</p>
      <p>فريق شركة كرافت</p>
    </section>
  </main>
</body>
</html>`;

	if (shouldLogNonProductionDiagnostics) {
		logPdfTrace(
			[
				`html.reportId=${payload.report.id}`,
				`hasTitle=${String(html.includes(escapeHtml(content.reportTitle)))}`,
				`hasProject=${String(html.includes(escapeHtml(content.projectName)))}`,
				`hasSummary=${String(html.includes(escapeHtml(content.summaryText)))}`,
				`hasBody=${String(html.includes(escapeHtml(content.workText)))}`,
			].join(" ")
		);
	}

	return html;
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
