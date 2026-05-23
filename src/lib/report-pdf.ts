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

export const PDF_VIEW_FAILURE_MESSAGE = "تعذر توليد ملف PDF، يرجى المحاولة لاحقًا.";
export const PDF_DELIVERY_FAILURE_MESSAGE = "تعذر توليد ملف PDF، لم يتم إرسال التقرير.";

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
	client: "تقرير للعميل",
	internal: "تقرير داخلي",
	shared: "تقرير مشترك",
};

const reportStatusLabel: Record<ActivityReport["status"], string> = {
	draft: "مسودة",
	pending_admin_approval: "بانتظار موافقة الأدمن",
	approved: "معتمد",
	rejected: "مرفوض",
	sent: "تم الإرسال",
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
	const imageAttachments = report.attachments.filter(isImageAttachment);
	const fileAttachments = report.attachments.filter((attachment) => !isImageAttachment(attachment));
	const recipientsText =
		report.recipients.length > 0
			? report.recipients
					.map((recipient) => {
						const parts = [
							recipient.name,
							recipient.email || null,
							recipient.phone || null,
						].filter(Boolean);
						return parts.join(" • ");
					})
					.join(" | ")
			: "غير محدد";

	return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    @page { size: A4; margin: 22mm 18mm; }
    body { font-family: Tahoma, Arial, sans-serif; color: #1f2937; margin: 0; background: #f4f1e8; }
    .page { padding: 32px; }
    .card { background: white; border-radius: 18px; padding: 28px; box-shadow: 0 16px 40px rgba(17,24,39,.08); }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
    .brand { display: flex; align-items: center; gap: 16px; }
    .brand img { width: 96px; height: auto; }
    .eyebrow { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: #8b7355; }
    h1 { margin: 8px 0 4px; font-size: 28px; color: #1f2937; }
    h2 { margin: 0 0 10px; font-size: 18px; color: #7c6241; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 24px; }
    .panel { border: 1px solid #eadfca; border-radius: 14px; padding: 14px 16px; background: #fffdf8; }
    .label { font-size: 11px; color: #8b7355; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .16em; }
    .value { font-size: 15px; color: #1f2937; line-height: 1.7; }
    .section { margin-top: 24px; }
    .section p { margin: 0; line-height: 1.9; white-space: normal; }
    .attachments { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .attachments img { width: 100%; border-radius: 12px; border: 1px solid #eadfca; object-fit: cover; }
    ul { margin: 10px 0 0; padding: 0 18px 0 0; }
    li { margin-bottom: 8px; line-height: 1.7; }
    .footer { margin-top: 32px; padding-top: 18px; border-top: 1px solid #eadfca; display: flex; justify-content: space-between; gap: 16px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="header">
        <div class="brand">
          ${logoSrc ? `<img src="${logoSrc}" alt="Craft Flow" />` : ""}
          <div>
            <div class="eyebrow">Craft Flow</div>
            <h1>${escapeHtml(report.title)}</h1>
            <div class="value">${escapeHtml(project.name)}</div>
          </div>
        </div>
        <div class="panel">
          <div class="label">حالة الاعتماد</div>
          <div class="value">${escapeHtml(reportStatusLabel[report.status])}</div>
        </div>
      </div>

      <div class="grid">
        <div class="panel">
          <div class="label">اسم الشركة</div>
          <div class="value">Craft Flow</div>
        </div>
        <div class="panel">
          <div class="label">اسم المشروع</div>
          <div class="value">${escapeHtml(project.name)}</div>
        </div>
        <div class="panel">
          <div class="label">عنوان التقرير</div>
          <div class="value">${escapeHtml(report.title)}</div>
        </div>
        <div class="panel">
          <div class="label">نوع التقرير</div>
          <div class="value">${escapeHtml(reportTypeLabel[report.reportType])}</div>
        </div>
        <div class="panel">
          <div class="label">كاتب التقرير</div>
          <div class="value">${escapeHtml(report.authorName)}</div>
        </div>
        <div class="panel">
          <div class="label">تاريخ التقرير</div>
          <div class="value">${escapeHtml(report.createdAt ? new Date(report.createdAt).toLocaleString("ar-SA") : "غير محدد")}</div>
        </div>
        <div class="panel">
          <div class="label">بيانات العميل</div>
          <div class="value">${escapeHtml(project.clientName || "غير محدد")}<br />${escapeHtml(project.clientEmail || "")}</div>
        </div>
        <div class="panel">
          <div class="label">المستلمون</div>
          <div class="value">${escapeHtml(recipientsText)}</div>
        </div>
      </div>

      <div class="section">
        <h2>الملخص</h2>
        <p>${nl2br(report.summary || "لا يوجد ملخص.")}</p>
      </div>

      <div class="section">
        <h2>تفاصيل التقرير</h2>
        <p>${nl2br(report.details)}</p>
        ${report.workDetails ? `<p style="margin-top:12px">${nl2br(report.workDetails)}</p>` : ""}
      </div>

      ${
				imageAttachments.length > 0
					? `<div class="section">
        <h2>الصور والمرفقات المرئية</h2>
        <div class="attachments">
          ${imageAttachments
						.map(
							(attachment) =>
								`<div><img src="${attachment.url}" alt="${escapeHtml(attachment.name || "attachment")}" /></div>`
						)
						.join("")}
        </div>
      </div>`
					: ""
			}

      ${
				fileAttachments.length > 0
					? `<div class="section">
        <h2>المرفقات الأخرى</h2>
        <ul>
          ${fileAttachments
						.map(
							(attachment) =>
								`<li>${escapeHtml(attachment.name || attachment.url)} - ${escapeHtml(attachment.url)}</li>`
						)
						.join("")}
        </ul>
      </div>`
					: ""
			}

      <div class="footer">
        <div>
          <div class="label">اعتماد الأدمن</div>
          <div class="value">${escapeHtml(approvedByName || "غير معتمد بعد")}</div>
        </div>
        <div>
          <div class="label">الموقع</div>
          <div class="value">${escapeHtml([project.city, project.district].filter(Boolean).join(" - ") || "غير محدد")}</div>
        </div>
      </div>
    </div>
  </div>
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
			waitUntil: ["domcontentloaded", "networkidle0"],
		});
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
