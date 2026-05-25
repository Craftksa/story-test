import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { ActivityReport, ActivityReportAttachment } from "@/lib/activity";

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

export const PDF_VIEW_FAILURE_MESSAGE = "ØªØ¹Ø°Ø± ØªÙˆÙ„ÙŠØ¯ Ù…Ù„Ù PDFØŒ ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù„Ø§Ø­Ù‚Ù‹Ø§.";
export const PDF_DELIVERY_FAILURE_MESSAGE = "ØªØ¹Ø°Ø± ØªÙˆÙ„ÙŠØ¯ Ù…Ù„Ù PDFØŒ Ù„Ù… ÙŠØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ±.";

type PdfGenerationDiagnostics = {
	stage:
		| "initializing"
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
	client: "ØªÙ‚Ø±ÙŠØ± Ù„Ù„Ø¹Ù…ÙŠÙ„",
	internal: "ØªÙ‚Ø±ÙŠØ± Ø¯Ø§Ø®Ù„ÙŠ",
	shared: "ØªÙ‚Ø±ÙŠØ± Ù…Ø´ØªØ±Ùƒ",
};

const reportStatusLabel: Record<ActivityReport["status"], string> = {
	draft: "Ù…Ø³ÙˆØ¯Ø©",
	pending_admin_approval: "Ø¨Ø§Ù†ØªØ¸Ø§Ø± Ù…ÙˆØ§ÙÙ‚Ø© Ø§Ù„Ø£Ø¯Ù…Ù†",
	approved: "Ù…Ø¹ØªÙ…Ø¯",
	rejected: "Ù…Ø±ÙÙˆØ¶",
	sent: "ØªÙ… Ø§Ù„Ø¥Ø±Ø³Ø§Ù„",
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
const bundledChromiumBinPath = path.join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin");

const escapeHtml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

const nl2br = (value?: string | null) => escapeHtml(value || "").replaceAll("\n", "<br />");

const isImageAttachment = (attachment: ActivityReportAttachment) =>
	/\.(png|jpe?g|gif|webp|svg)$/i.test(attachment.url) ||
	(attachment.type ? attachment.type.startsWith("image/") : false);

const getLogoMarkup = async () => {
	const svgPath = path.join(process.cwd(), "public", "Craft_Logo.svg");

	try {
		const logo = await fs.readFile(svgPath, "utf8");
		const encoded = Buffer.from(logo).toString("base64");
		return `data:image/svg+xml;base64,${encoded}`;
	} catch {
		return null;
	}
};

export const buildReportHtml = async ({ project, report, approvedByName }: ReportDocumentPayload) => {
	const logoSrc = await getLogoMarkup();
	const reportDate = report.createdAt
		? new Date(report.createdAt).toLocaleDateString("ar-SA")
		: "غير محدد";
	const projectName = project.name?.trim() || "غير محدد";
	const reportTitle = report.title?.trim() || "غير محدد";
	const reportType = reportTypeLabel[report.reportType] || "غير محدد";
	const authorName = report.authorName?.trim() || approvedByName?.trim() || "غير محدد";
	const hasSummary = Boolean(report.summary?.trim());
	const hasWorkDetails = Boolean(report.workDetails?.trim());
	const hasDetails = Boolean(report.details?.trim());
	const summaryText = hasSummary
		? report.summary!.trim()
		: "لا يوجد ملخص مضاف لهذا التقرير.";
	const completedWorkText = hasWorkDetails
		? report.workDetails!.trim()
		: hasDetails
			? report.details!.trim()
			: "لا توجد أعمال منجزة مضافة لهذا التقرير.";
	const logoMarkup = logoSrc ? `<img src="${logoSrc}" alt="شعار الشركة" />` : "";

	console.log("[pdf-template] official work report template rendered");
	console.log(`[pdf-template] hasSummary=${hasSummary}`);
	console.log(`[pdf-template] hasWorkDetails=${hasWorkDetails}`);
	console.log(`[pdf-template] hasDetails=${hasDetails}`);

	const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(reportTitle)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      direction: rtl;
      text-align: right;
      font-family: Arial, "Tahoma", sans-serif;
    }

    main {
      padding: 28mm 22mm;
      box-sizing: border-box;
    }

    .logo-space {
      height: 28mm;
    }

    .logo-space img {
      display: block;
      max-height: 22mm;
      max-width: 60mm;
      margin-right: 0;
      margin-left: auto;
    }

    h1 {
      margin: 0 0 18mm;
      text-align: center;
      font-size: 26px;
      font-weight: 700;
    }

    .meta {
      margin-bottom: 14mm;
      font-size: 14px;
      line-height: 1.9;
    }

    .meta p {
      margin: 0 0 3mm;
    }

    section {
      margin-bottom: 10mm;
    }

    h2 {
      margin: 0 0 5mm;
      font-size: 17px;
      font-weight: 700;
    }

    p {
      margin: 0 0 5mm;
      font-size: 15px;
      line-height: 2;
      white-space: pre-line;
    }

    .closing {
      margin-top: 14mm;
    }
  </style>
</head>
<body>
  <main>
    <div class="logo-space">${logoMarkup}</div>

    <h1>تقرير أعمال الموقع</h1>

    <section class="meta">
      <p>اسم المشروع: ${escapeHtml(projectName)}</p>
      <p>عنوان التقرير: ${escapeHtml(reportTitle)}</p>
      <p>نوع التقرير: ${escapeHtml(reportType)}</p>
      <p>التاريخ: ${escapeHtml(reportDate)}</p>
      <p>إعداد: ${escapeHtml(authorName)}</p>
    </section>

    <section>
      <p>السلام عليكم ورحمة الله وبركاته،</p>
    </section>

    <section>
      <p>${escapeHtml(
			"نقدم لكم هذا التقرير الذي يوضح الأعمال التي تم إنجازها في الموقع خلال الفترة المحددة، مع توضيح أبرز التحديثات والتحسينات التي تم تنفيذها، وذلك بهدف توثيق سير العمل ومتابعة تقدم المشروع بشكل واضح ومنظم."
		)}</p>
    </section>

    <section>
      <h2>ملخص التقرير</h2>
      <p>${escapeHtml(summaryText)}</p>
    </section>

    <section>
      <h2>الأعمال المنجزة</h2>
      <p>${escapeHtml(completedWorkText)}</p>
    </section>

    <section>
      <p>${escapeHtml(
			"نؤكد أن الأعمال المذكورة أعلاه تم تنفيذها ضمن خطة تطوير الموقع، وسيتم استكمال بقية التحسينات والاختبارات لضمان استقرار النظام ورفع جودة تجربة المستخدم."
		)}</p>
    </section>

    <section class="closing">
      <p>أطيب التحيات،</p>
      <p>فريق شركة كرافت</p>
    </section>
  </main>
</body>
</html>`;

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
		await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
		diagnostics.setContentSucceeded = true;
		logPdfTrace("stage=set-content success=true");
		await page.emulateMediaType("screen");

		diagnostics.stage = "generating_pdf";
		diagnostics.pdfStarted = true;
		logPdfTrace("stage=page-pdf");
		const pdfBuffer = await page.pdf({
			format: "A4",
			printBackground: true,
			preferCSSPageSize: true,
			margin: {
				top: "12mm",
				right: "10mm",
				bottom: "12mm",
				left: "10mm",
			},
		});
		diagnostics.pdfSucceeded = true;
		diagnostics.stage = "completed";
		logPdfTrace("stage=page-pdf success=true");
		logPdfTrace("stage=completed");

		return Buffer.from(pdfBuffer);
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
		throw new Error(PDF_DELIVERY_FAILURE_MESSAGE, {
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
