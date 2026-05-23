import type { ActivityReport, ActivityReportRecipient } from "@/lib/activity";
import { isSmtpConfigured, sendProjectReportEmail } from "@/lib/email";
import {
	generateReportPdfBuffer,
	type ReportDocumentPayload,
	PDF_DELIVERY_FAILURE_MESSAGE,
} from "@/lib/report-pdf";

export type ReportDeliveryOption =
	| "draft"
	| "pdf_only"
	| "email"
	| "whatsapp"
	| "email_whatsapp";

type DeliveryStatus = "not_applicable" | "pending" | "sent" | "failed" | "not_configured";

type DeliveryResult = {
	pdfStatus: "generated" | "failed";
	emailStatus: DeliveryStatus;
	whatsappStatus: DeliveryStatus;
	lastDeliveryError: string | null;
	pdfBuffer: Buffer | null;
	userMessage: string;
};

type DeliveryPreference = {
	option?: ReportDeliveryOption;
};

const getDeliveryChannelsForOption = (option: ReportDeliveryOption) => {
	switch (option) {
		case "email":
			return { email: true, whatsapp: false };
		case "whatsapp":
			return { email: false, whatsapp: true };
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
	emailStatus,
	whatsappStatus,
}: {
	option: ReportDeliveryOption;
	pdfStatus: "generated" | "failed";
	emailStatus: DeliveryStatus;
	whatsappStatus: DeliveryStatus;
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

	if (option === "email" && emailStatus === "not_applicable") {
		return "تم إنشاء التقرير وملف PDF، لكن لا يوجد مستلمون صالحون للبريد الإلكتروني.";
	}

	if (option === "whatsapp" && whatsappStatus === "not_applicable") {
		return "تم إنشاء التقرير وملف PDF، لكن لا يوجد مستلمون صالحون للواتساب.";
	}

	if (
		option === "email_whatsapp" &&
		emailStatus === "not_applicable" &&
		whatsappStatus === "not_applicable"
	) {
		return "تم إنشاء التقرير وملف PDF، لكن لا يوجد مستلمون صالحون للإرسال.";
	}

	if (emailStatus === "not_configured" && whatsappStatus === "not_configured") {
		return "تم إنشاء التقرير لكن البريد الإلكتروني والواتساب غير مهيأين.";
	}

	if (emailStatus === "not_configured") {
		return "تم إنشاء التقرير لكن البريد الإلكتروني غير مهيأ.";
	}

	if (whatsappStatus === "not_configured") {
		return "تم إنشاء التقرير لكن الواتساب غير مهيأ.";
	}

	if (emailStatus === "failed" && whatsappStatus === "failed") {
		return "تم إنشاء التقرير وملف PDF، لكن فشل الإرسال عبر البريد الإلكتروني والواتساب.";
	}

	if (emailStatus === "failed") {
		return "تم إنشاء التقرير وملف PDF، لكن فشل الإرسال عبر البريد الإلكتروني.";
	}

	if (whatsappStatus === "failed") {
		return "تم إنشاء التقرير وملف PDF، لكن فشل الإرسال عبر الواتساب.";
	}

	if (option === "email_whatsapp") {
		return "تم إنشاء التقرير وملف PDF وإرساله عبر البريد الإلكتروني والواتساب.";
	}

	if (option === "email") {
		return "تم إنشاء التقرير وملف PDF وإرساله عبر البريد الإلكتروني.";
	}

	return "تم إنشاء التقرير وملف PDF وإرساله عبر الواتساب.";
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
		const pdfBuffer = await generateReportPdfBuffer(payload);
		const emailRecipients = enabledChannels.email
			? normalizeRecipientsByChannel(payload.report.recipients, "email")
			: [];
		const whatsappRecipients = enabledChannels.whatsapp
			? normalizeRecipientsByChannel(payload.report.recipients, "whatsapp")
			: [];
		let emailStatus: DeliveryStatus = enabledChannels.email ? "pending" : "not_applicable";
		let whatsappStatus: DeliveryStatus = enabledChannels.whatsapp ? "pending" : "not_applicable";

		try {
			if (enabledChannels.email && emailRecipients.length > 0) {
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
			} else if (enabledChannels.email) {
				emailStatus = "not_applicable";
			}
		} catch {
			emailStatus = "failed";
		}

		try {
			if (enabledChannels.whatsapp) {
				whatsappStatus = await sendWhatsAppReport({
					project: payload.project,
					report: payload.report,
					recipients: whatsappRecipients,
					pdfBuffer,
				});
			}
		} catch {
			whatsappStatus = "failed";
		}

		const lastDeliveryError =
			[
				emailStatus === "failed" ? "فشل إرسال البريد الإلكتروني." : null,
				whatsappStatus === "failed" ? "فشل إرسال الواتساب." : null,
				emailStatus === "not_configured" ? "البريد الإلكتروني غير مهيأ." : null,
				whatsappStatus === "not_configured" ? "الواتساب غير مهيأ." : null,
			]
				.filter(Boolean)
				.join(" ") || null;

		return {
			pdfStatus: "generated",
			emailStatus,
			whatsappStatus,
			lastDeliveryError,
			pdfBuffer,
			userMessage: buildDeliveryMessage({
				option,
				pdfStatus: "generated",
				emailStatus,
				whatsappStatus,
			}),
		};
	} catch {
		return {
			pdfStatus: "failed",
			emailStatus: "not_applicable",
			whatsappStatus: "not_applicable",
			lastDeliveryError: PDF_DELIVERY_FAILURE_MESSAGE,
			pdfBuffer: null,
			userMessage: PDF_DELIVERY_FAILURE_MESSAGE,
		};
	}
};
