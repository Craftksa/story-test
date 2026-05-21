import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { pathToFileURL } from "url";
import type {
	ActivityReport,
	ActivityReportAttachment,
	ActivityReportRecipient,
} from "@/lib/activity";
import { isSmtpConfigured, sendProjectReportEmail } from "@/lib/email";

const execFileAsync = promisify(execFile);

type ReportProjectPayload = {
	id: string;
	name: string;
	city?: string | null;
	district?: string | null;
	clientName?: string | null;
	clientEmail?: string | null;
	description?: string | null;
};

type ReportDocumentPayload = {
	project: ReportProjectPayload;
	report: ActivityReport;
	approvedByName?: string | null;
};

type DeliveryStatus = "not_applicable" | "pending" | "sent" | "failed" | "not_configured";

type DeliveryResult = {
	pdfStatus: "generated" | "failed";
	emailStatus: DeliveryStatus;
	whatsappStatus: DeliveryStatus;
	lastDeliveryError: string | null;
	pdfBuffer: Buffer | null;
	userMessage: string;
};

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

const buildReportHtml = async ({ project, report, approvedByName }: ReportDocumentPayload) => {
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
          ${logoSrc ? `<img src="${logoSrc}" alt="Craft Logo" />` : ""}
          <div>
            <div class="eyebrow">Craft Flow Report</div>
            <h1>${escapeHtml(report.title)}</h1>
            <div class="value">${escapeHtml(project.name)}</div>
          </div>
        </div>
        <div class="panel">
          <div class="label">حالة التقرير</div>
          <div class="value">${escapeHtml(report.status)}</div>
        </div>
      </div>

      <div class="grid">
        <div class="panel">
          <div class="label">اسم المشروع</div>
          <div class="value">${escapeHtml(project.name)}</div>
        </div>
        <div class="panel">
          <div class="label">نوع التقرير</div>
          <div class="value">${escapeHtml(report.reportType)}</div>
        </div>
        <div class="panel">
          <div class="label">بيانات العميل</div>
          <div class="value">${escapeHtml(project.clientName || "غير محدد")}<br />${escapeHtml(project.clientEmail || "")}</div>
        </div>
        <div class="panel">
          <div class="label">كاتب التقرير</div>
          <div class="value">${escapeHtml(report.authorName)}</div>
        </div>
        <div class="panel">
          <div class="label">تاريخ الإنشاء</div>
          <div class="value">${escapeHtml(report.createdAt ? new Date(report.createdAt).toLocaleString("ar-SA") : "غير محدد")}</div>
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
        <h2>تفاصيل الأعمال والملاحظات</h2>
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
								`<div><img src="${attachment.url}" alt="${escapeHtml(
									attachment.name || "attachment"
								)}" /></div>`
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
          <div class="value">${escapeHtml(
						[project.city, project.district].filter(Boolean).join(" - ") || "غير محدد"
					)}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
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

const isVercelRuntime = () => !!process.env.VERCEL;

const findBrowserExecutable = async () => {
	for (const browserPath of candidateBrowserPaths) {
		try {
			await fs.access(browserPath);
			return browserPath;
		} catch {
			continue;
		}
	}

	throw new Error(
		"Unable to find a browser executable for PDF generation. Set REPORT_PDF_BROWSER_PATH to Edge or Chrome."
	);
};

const generatePdfWithRemoteService = async (payload: ReportDocumentPayload) => {
	const serviceUrl = process.env.REPORT_PDF_SERVICE_URL;
	if (!serviceUrl) {
		throw new Error(
			"PDF generation is not configured for production. Set REPORT_PDF_SERVICE_URL or provide REPORT_PDF_BROWSER_PATH."
		);
	}

	const html = await buildReportHtml(payload);
	const response = await fetch(serviceUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(process.env.REPORT_PDF_SERVICE_TOKEN
				? { Authorization: `Bearer ${process.env.REPORT_PDF_SERVICE_TOKEN}` }
				: {}),
		},
		body: JSON.stringify({
			html,
			fileName: `${payload.report.title}.pdf`,
		}),
	});

	if (!response.ok) {
		throw new Error(`Remote PDF generation failed with status ${response.status}.`);
	}

	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer);
};

const generatePdfWithLocalBrowser = async (payload: ReportDocumentPayload) => {
	const browserPath = await findBrowserExecutable();
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "craft-report-"));
	const htmlPath = path.join(tempDir, "report.html");
	const pdfPath = path.join(tempDir, "report.pdf");

	try {
		const html = await buildReportHtml(payload);
		await fs.writeFile(htmlPath, html, "utf8");

		const htmlUrl = pathToFileURL(htmlPath).toString();
		await execFileAsync(
			browserPath,
			[
				"--headless=new",
				"--disable-gpu",
				"--no-pdf-header-footer",
				`--print-to-pdf=${pdfPath}`,
				"--allow-file-access-from-files",
				htmlUrl,
			],
			{
				timeout: 120000,
				windowsHide: true,
			}
		);

		return await fs.readFile(pdfPath);
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
	}
};

export const generateReportPdfBuffer = async (payload: ReportDocumentPayload) => {
	const hasExplicitBrowserPath =
		!!process.env.REPORT_PDF_BROWSER_PATH ||
		!!process.env.PUPPETEER_EXECUTABLE_PATH ||
		!!process.env.CHROME_EXECUTABLE_PATH;
	const hasRemotePdfService = !!process.env.REPORT_PDF_SERVICE_URL;

	if (hasRemotePdfService && isVercelRuntime()) {
		return generatePdfWithRemoteService(payload);
	}

	if (hasExplicitBrowserPath || !isVercelRuntime()) {
		return generatePdfWithLocalBrowser(payload);
	}

	return generatePdfWithRemoteService(payload);
};

const normalizeRecipientsByChannel = (
	recipients: ActivityReportRecipient[],
	channel: "email" | "whatsapp"
) =>
	recipients.filter((recipient) => {
		const deliveryChannel = recipient.channel ?? "both";

		if (channel === "email") {
			return !!recipient.email && (deliveryChannel === "email" || deliveryChannel === "both");
		}

		return !!recipient.phone && (deliveryChannel === "whatsapp" || deliveryChannel === "both");
	});

const sendWhatsAppReport = async ({
	project,
	report,
	recipients,
	pdfBuffer,
}: {
	project: ReportProjectPayload;
	report: ActivityReport;
	recipients: ActivityReportRecipient[];
	pdfBuffer: Buffer;
}): Promise<DeliveryStatus> => {
	if (recipients.length === 0) return "not_applicable";
	if (!process.env.WHATSAPP_WEBHOOK_URL) return "not_configured";

	const response = await fetch(process.env.WHATSAPP_WEBHOOK_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(process.env.WHATSAPP_API_TOKEN
				? { Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}` }
				: {}),
		},
		body: JSON.stringify({
			projectName: project.name,
			reportTitle: report.title,
			recipients: recipients.map((recipient) => ({
				name: recipient.name,
				phone: recipient.phone,
			})),
			fileName: `${report.title}.pdf`,
			mimeType: "application/pdf",
			pdfBase64: pdfBuffer.toString("base64"),
		}),
	});

	if (!response.ok) {
		throw new Error(`WhatsApp delivery failed with status ${response.status}`);
	}

	return "sent";
};

export const deliverClientReport = async (
	payload: ReportDocumentPayload
): Promise<DeliveryResult> => {
	try {
		const pdfBuffer = await generateReportPdfBuffer(payload);
		const emailRecipients = normalizeRecipientsByChannel(payload.report.recipients, "email");
		const whatsappRecipients = normalizeRecipientsByChannel(payload.report.recipients, "whatsapp");
		let emailStatus: DeliveryStatus = "not_applicable";
		let whatsappStatus: DeliveryStatus = "not_applicable";

		try {
			if (emailRecipients.length > 0) {
				if (!isSmtpConfigured()) {
					emailStatus = "not_configured";
				} else {
					await sendProjectReportEmail({
						projectName: payload.project.name,
						reportTitle: payload.report.title,
						recipients: emailRecipients,
						pdfBuffer,
					});
					emailStatus = "sent";
				}
			}
		} catch {
			emailStatus = "failed";
		}

		try {
			whatsappStatus = await sendWhatsAppReport({
				project: payload.project,
				report: payload.report,
				recipients: whatsappRecipients,
				pdfBuffer,
			});
		} catch {
			whatsappStatus = "failed";
		}

		return {
			pdfStatus: "generated",
			emailStatus,
			whatsappStatus,
			lastDeliveryError: [
				emailStatus === "failed" ? "فشل إرسال البريد الإلكتروني." : null,
				whatsappStatus === "failed" ? "فشل إرسال الواتساب." : null,
				emailStatus === "not_configured" ? "خدمة البريد غير مهيأة." : null,
				whatsappStatus === "not_configured" ? "خدمة الواتساب غير مهيأة." : null,
			]
				.filter(Boolean)
				.join(" ") || null,
			pdfBuffer,
			userMessage:
				(emailStatus === "not_configured" || whatsappStatus === "not_configured") &&
				emailStatus !== "failed" &&
				whatsappStatus !== "failed"
					? "تم إنشاء التقرير وملف PDF، لكن لم يتم الإرسال بسبب عدم إعداد خدمة البريد أو الواتساب."
					: emailStatus === "failed" || whatsappStatus === "failed"
						? "تم إنشاء التقرير وملف PDF، لكن فشل الإرسال عبر واحدة أو أكثر من القنوات."
						: "تم إنشاء التقرير وملف PDF بنجاح.",
		};
	} catch (error) {
		return {
			pdfStatus: "failed",
			emailStatus: "not_applicable",
			whatsappStatus: "not_applicable",
			lastDeliveryError:
				error instanceof Error
					? error.message
					: "Failed to deliver report.",
			pdfBuffer: null,
			userMessage:
				error instanceof Error
					? `تعذر توليد PDF: ${error.message}`
					: "تعذر توليد ملف PDF الخاص بالتقرير.",
		};
	}
};
