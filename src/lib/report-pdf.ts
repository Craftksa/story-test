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

const resolveBrowserLaunchConfig = async () => {
	const localExecutablePath = await findLocalBrowserExecutable();
	if (localExecutablePath) {
		return {
			args: ["--disable-gpu", "--no-sandbox", "--disable-setuid-sandbox"],
			defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
			executablePath: localExecutablePath,
			headless: true as const,
		};
	}

	chromium.setGraphicsMode = false;
	return {
		args: puppeteer.defaultArgs({
			args: chromium.args,
			headless: "shell",
		}),
		defaultViewport: chromium.defaultViewport,
		executablePath: await chromium.executablePath(),
		headless: "shell" as const,
	};
};

export const generateReportPdfBuffer = async (payload: ReportDocumentPayload) => {
	const html = await buildReportHtml(payload);
	const userDataDir = path.join(os.tmpdir(), `craft-report-${randomUUID()}`);
	let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

	try {
		const launchConfig = await resolveBrowserLaunchConfig();
		browser = await puppeteer.launch({
			...launchConfig,
			args: [...launchConfig.args, `--user-data-dir=${userDataDir}`],
			ignoreHTTPSErrors: true,
		});

		const page = await browser.newPage();
		await page.setContent(html, {
			waitUntil: ["domcontentloaded", "networkidle0"],
		});
		await page.emulateMediaType("screen");

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

		return Buffer.from(pdfBuffer);
	} catch {
		throw new Error(PDF_DELIVERY_FAILURE_MESSAGE);
	} finally {
		if (browser) {
			try {
				await browser.close();
			} catch {
				// Ignore close failures.
			}
		}

		await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
	}
};
