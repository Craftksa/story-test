import type { ActivityReport, ActivityReportRecipient } from "@/lib/activity";
import { isSmtpConfigured, sendProjectReportEmail } from "@/lib/email";
import {
	generateReportPdfBuffer,
	getReportPdfFileName,
	getReportPdfUserMessage,
	logPdfErrorDetails,
	type ReportDocumentPayload,
	PDF_DELIVERY_FAILURE_MESSAGE,
	validateGeneratedPdfBuffer,
	validateReportDocumentPayload,
} from "@/lib/report-pdf";

export type ReportDeliveryOption =
	| "draft"
	| "pdf_only"
	| "email"
	| "whatsapp"
	| "email_whatsapp";

type DeliveryStatus = "not_applicable" | "pending" | "sent" | "failed" | "not_configured";
export type DeliveryExecutionStatus = "success" | "failed" | "not_configured" | "skipped";

type DeliveryResult = {
	pdfStatus: "generated" | "failed";
	emailStatus: DeliveryStatus;
	whatsappStatus: DeliveryStatus;
	emailOutcome: DeliveryExecutionStatus;
	whatsappOutcome: DeliveryExecutionStatus;
	lastDeliveryError: string | null;
	pdfBuffer: Buffer | null;
	userMessage: string;
};

type DeliveryPreference = {
	option?: ReportDeliveryOption;
};

const getWhatsAppWarningMessage = (whatsappOutcome: DeliveryExecutionStatus) => {
	switch (whatsappOutcome) {
		case "failed":
			return "تم إرسال التقرير عبر البريد الإلكتروني، لكن فشل الإرسال عبر واتساب";
		case "not_configured":
			return "تم إرسال التقرير عبر البريد الإلكتروني، لكن إعدادات واتساب غير مكتملة";
		case "skipped":
			return "تم إرسال التقرير عبر البريد الإلكتروني، لكن لم يتم إرسال واتساب لعدم وجود رقم جوال";
		default:
			return null;
	}
};

const getDeliveryChannelsForOption = (option: ReportDeliveryOption) => {
	switch (option) {
		case "email":
			return { email: true, whatsapp: false };
		case "whatsapp":
			return { email: true, whatsapp: true };
		case "email_whatsapp":
			return { email: true, whatsapp: true };
		case "draft":
		case "pdf_only":
		default:
			return { email: false, whatsapp: false };
	}
};

const buildDeliveryMessage = ({
	option,
	pdfStatus,
	emailOutcome,
	whatsappOutcome,
}: {
	option: ReportDeliveryOption;
	pdfStatus: "generated" | "failed";
	emailOutcome: DeliveryExecutionStatus;
	whatsappOutcome: DeliveryExecutionStatus;
}) => {
	if (pdfStatus === "failed") {
		return PDF_DELIVERY_FAILURE_MESSAGE;
	}

	if (option === "draft") {
		return "تم حفظ التقرير كمسودة.";
	}

	if (option === "pdf_only") {
		return "تم إنشاء ملف PDF للتقرير بنجاح.";
	}

	if (option === "email" || option === "whatsapp" || option === "email_whatsapp") {
		if (emailOutcome === "not_configured") {
			return "إعدادات البريد الإلكتروني غير مكتملة، لم يتم إرسال التقرير";
		}

		if (emailOutcome === "failed") {
			return "فشل إرسال التقرير عبر البريد الإلكتروني";
		}

		if (emailOutcome === "skipped") {
			return "لا يوجد مستلمون صالحون للبريد الإلكتروني، لم يتم إرسال التقرير";
		}

		if (option === "email") {
			return "تم إرسال التقرير عبر البريد الإلكتروني بنجاح.";
		}

		if (whatsappOutcome === "success") {
			return "تم إرسال التقرير عبر البريد الإلكتروني وواتساب";
		}

		return getWhatsAppWarningMessage(whatsappOutcome) || "تم إرسال التقرير عبر البريد الإلكتروني بنجاح.";
	}

	if (whatsappOutcome === "not_configured") {
		return "إرسال الواتساب غير مهيأ حاليًا، لم يتم إرسال التقرير.";
	}

	if (whatsappOutcome === "failed") {
		return "فشل إرسال التقرير عبر الواتساب.";
	}

	if (whatsappOutcome === "skipped") {
		return "لا يوجد مستلمون صالحون للواتساب، لم يتم إرسال التقرير.";
	}

	return "تم إرسال التقرير عبر الواتساب بنجاح.";
};

const mapExecutionOutcomeToStatus = (outcome: DeliveryExecutionStatus): DeliveryStatus => {
	switch (outcome) {
		case "success":
			return "sent";
		case "failed":
			return "failed";
		case "not_configured":
			return "not_configured";
		case "skipped":
		default:
			return "not_applicable";
	}
};

const inferDeliveryOptionFromRecipients = (recipients: ActivityReportRecipient[]): ReportDeliveryOption => {
	if (recipients.length === 0) {
		return "pdf_only";
	}

	const channels = new Set(recipients.map((recipient) => recipient.channel ?? "both"));

	if (channels.size === 1 && channels.has("none")) {
		return "pdf_only";
	}

	if (channels.size === 1 && channels.has("email")) {
		return "email";
	}

	if (channels.size === 1 && channels.has("whatsapp")) {
		return "whatsapp";
	}

	return "email_whatsapp";
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
	project: ReportDocumentPayload["project"];
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
	payload: ReportDocumentPayload,
	preference: DeliveryPreference = {}
): Promise<DeliveryResult> => {
	const option = preference.option ?? inferDeliveryOptionFromRecipients(payload.report.recipients);
	const enabledChannels = getDeliveryChannelsForOption(option);

	try {
		validateReportDocumentPayload(payload);
		const pdfBuffer = await generateReportPdfBuffer(payload);
		validateGeneratedPdfBuffer(pdfBuffer);
		const emailRecipients = enabledChannels.email
			? normalizeRecipientsByChannel(payload.report.recipients, "email")
			: [];
		const whatsappRecipients = enabledChannels.whatsapp
			? normalizeRecipientsByChannel(payload.report.recipients, "whatsapp")
			: [];
		let emailOutcome: DeliveryExecutionStatus = enabledChannels.email ? "failed" : "skipped";
		let whatsappOutcome: DeliveryExecutionStatus = enabledChannels.whatsapp ? "failed" : "skipped";

		try {
			if (enabledChannels.email && emailRecipients.length > 0) {
				if (!isSmtpConfigured()) {
					emailOutcome = "not_configured";
				} else {
					await sendProjectReportEmail({
						reportId: payload.report.id,
						projectName: payload.project.name,
						reportTitle: payload.report.title,
						recipients: emailRecipients,
						pdfBuffer,
						attachmentFileName: getReportPdfFileName(payload.report.id),
					});
					emailOutcome = "success";
				}
			} else if (enabledChannels.email) {
				emailOutcome = "skipped";
			}
		} catch {
			emailOutcome = "failed";
		}

		try {
			if (enabledChannels.whatsapp) {
				if (whatsappRecipients.length === 0) {
					whatsappOutcome = "skipped";
				} else if (!process.env.WHATSAPP_WEBHOOK_URL) {
					whatsappOutcome = "not_configured";
				} else {
					const whatsappStatus = await sendWhatsAppReport({
						project: payload.project,
						report: payload.report,
						recipients: whatsappRecipients,
						pdfBuffer,
					});
					whatsappOutcome = whatsappStatus === "sent" ? "success" : "failed";
				}
			}
		} catch {
			whatsappOutcome = "failed";
		}

		const emailStatus = mapExecutionOutcomeToStatus(emailOutcome);
		const whatsappStatus = mapExecutionOutcomeToStatus(whatsappOutcome);
		const whatsappWarning = emailOutcome === "success" ? getWhatsAppWarningMessage(whatsappOutcome) : null;
		const lastDeliveryError =
			[
				emailOutcome === "failed" ? "فشل إرسال التقرير عبر البريد الإلكتروني" : null,
				emailOutcome === "not_configured"
					? "إعدادات البريد الإلكتروني غير مكتملة، لم يتم إرسال التقرير"
					: null,
				emailOutcome === "skipped" && enabledChannels.email
					? "لا يوجد مستلمون صالحون للبريد الإلكتروني، لم يتم إرسال التقرير"
					: null,
				whatsappOutcome === "failed" && emailOutcome !== "success"
					? "فشل إرسال التقرير عبر الواتساب"
					: null,
				whatsappOutcome === "not_configured" && emailOutcome !== "success"
					? "إرسال الواتساب غير مهيأ حاليًا، لم يتم إرسال التقرير."
					: null,
				whatsappOutcome === "skipped" && enabledChannels.whatsapp && emailOutcome !== "success"
					? "لا يوجد مستلمون صالحون للواتساب، لم يتم إرسال التقرير."
					: null,
				whatsappWarning,
			]
				.filter(Boolean)
				.join(" ") || null;

		return {
			pdfStatus: "generated",
			emailStatus,
			whatsappStatus,
			emailOutcome,
			whatsappOutcome,
			lastDeliveryError,
			pdfBuffer,
			userMessage: buildDeliveryMessage({
				option,
				pdfStatus: "generated",
				emailOutcome,
				whatsappOutcome,
			}),
		};
	} catch (error) {
		const userMessage = getReportPdfUserMessage(error, PDF_DELIVERY_FAILURE_MESSAGE);
		logPdfErrorDetails("deliverClientReport", error, {
			projectId: payload.project.id,
			reportId: payload.report.id,
			deliveryOption: option,
		});
		return {
			pdfStatus: "failed",
			emailStatus: "not_applicable",
			whatsappStatus: "not_applicable",
			emailOutcome: enabledChannels.email ? "failed" : "skipped",
			whatsappOutcome: enabledChannels.whatsapp ? "failed" : "skipped",
			lastDeliveryError: userMessage,
			pdfBuffer: null,
			userMessage,
		};
	}
};
