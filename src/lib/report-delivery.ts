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

type WhatsAppSendResult = {
	outcome: DeliveryExecutionStatus;
	message: string | null;
};

const WHATSAPP_NO_VALID_PHONE_MESSAGE = "لم يتم إرسال واتساب لعدم وجود رقم جوال صالح";
const WHATSAPP_INCOMPLETE_SETTINGS_MESSAGE = "إعدادات واتساب غير مكتملة";
const WHATSAPP_MEDIA_UPLOAD_FAILED_MESSAGE = "فشل رفع ملف التقرير إلى واتساب";
const WHATSAPP_SEND_FAILED_MESSAGE = "فشل إرسال التقرير عبر واتساب";
const WHATSAPP_NOT_CONFIGURED_MESSAGE = "إرسال الواتساب غير مهيأ حالياً، لم يتم إرسال التقرير.";

const getWhatsAppOutcomeMessage = (
	whatsappOutcome: DeliveryExecutionStatus,
	whatsappMessage?: string | null
) => {
	if (whatsappMessage) {
		return whatsappMessage;
	}

	switch (whatsappOutcome) {
		case "failed":
			return WHATSAPP_SEND_FAILED_MESSAGE;
		case "not_configured":
			return WHATSAPP_NOT_CONFIGURED_MESSAGE;
		case "skipped":
			return WHATSAPP_NO_VALID_PHONE_MESSAGE;
		default:
			return null;
	}
};

const getWhatsAppWarningMessage = ({
	whatsappOutcome,
	whatsappMessage,
}: {
	whatsappOutcome: DeliveryExecutionStatus;
	whatsappMessage?: string | null;
}) => {
	const outcomeMessage = getWhatsAppOutcomeMessage(whatsappOutcome, whatsappMessage);

	switch (whatsappOutcome) {
		case "failed":
		case "not_configured":
		case "skipped":
			return outcomeMessage
				? `تم إرسال التقرير عبر البريد الإلكتروني، لكن ${outcomeMessage}`
				: null;
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
	whatsappMessage,
}: {
	option: ReportDeliveryOption;
	pdfStatus: "generated" | "failed";
	emailOutcome: DeliveryExecutionStatus;
	whatsappOutcome: DeliveryExecutionStatus;
	whatsappMessage?: string | null;
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

		return (
			getWhatsAppWarningMessage({
				whatsappOutcome,
				whatsappMessage,
			}) || "تم إرسال التقرير عبر البريد الإلكتروني بنجاح."
		);
	}

	if (whatsappOutcome === "not_configured") {
		return getWhatsAppOutcomeMessage(whatsappOutcome, whatsappMessage) || WHATSAPP_NOT_CONFIGURED_MESSAGE;
	}

	if (whatsappOutcome === "failed") {
		return getWhatsAppOutcomeMessage(whatsappOutcome, whatsappMessage) || WHATSAPP_SEND_FAILED_MESSAGE;
	}

	if (whatsappOutcome === "skipped") {
		return getWhatsAppOutcomeMessage(whatsappOutcome, whatsappMessage) || WHATSAPP_NO_VALID_PHONE_MESSAGE;
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

const getWhatsAppProvider = () =>
	process.env.WHATSAPP_PROVIDER?.trim().toLowerCase() === "meta" ? "meta" : "webhook";

const normalizeMetaWhatsAppPhone = (phone: string) => {
	const compactPhone = phone.replace(/[^\d+]/g, "");
	const withoutPlus = compactPhone.startsWith("+") ? compactPhone.slice(1) : compactPhone;
	const normalizedPhone = withoutPlus.startsWith("05")
		? `966${withoutPlus.slice(1)}`
		: withoutPlus.startsWith("00")
			? withoutPlus.slice(2)
			: withoutPlus;

	return /^\d{8,15}$/.test(normalizedPhone) ? normalizedPhone : null;
};

const parseJsonSafely = async (response: Response) => {
	const contentType = response.headers.get("content-type") ?? "";

	if (!contentType.toLowerCase().includes("application/json")) {
		return null;
	}

	try {
		return await response.json();
	} catch {
		return null;
	}
};

const sendWebhookWhatsAppReport = async ({
	project,
	report,
	recipients,
	pdfBuffer,
}: {
	project: ReportDocumentPayload["project"];
	report: ActivityReport;
	recipients: ActivityReportRecipient[];
	pdfBuffer: Buffer;
}): Promise<WhatsAppSendResult> => {
	if (recipients.length === 0) {
		return {
			outcome: "skipped",
			message: WHATSAPP_NO_VALID_PHONE_MESSAGE,
		};
	}

	if (!process.env.WHATSAPP_WEBHOOK_URL) {
		return {
			outcome: "not_configured",
			message: WHATSAPP_NOT_CONFIGURED_MESSAGE,
		};
	}

	try {
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
			return {
				outcome: "failed",
				message: WHATSAPP_SEND_FAILED_MESSAGE,
			};
		}

		return {
			outcome: "success",
			message: null,
		};
	} catch {
		return {
			outcome: "failed",
			message: WHATSAPP_SEND_FAILED_MESSAGE,
		};
	}
};

const sendMetaWhatsAppReport = async ({
	report,
	recipients,
	pdfBuffer,
}: {
	report: ActivityReport;
	recipients: ActivityReportRecipient[];
	pdfBuffer: Buffer;
}): Promise<WhatsAppSendResult> => {
	const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
	const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
	const apiVersion = process.env.META_WHATSAPP_API_VERSION?.trim();

	if (!accessToken || !phoneNumberId || !apiVersion) {
		return {
			outcome: "not_configured",
			message: WHATSAPP_INCOMPLETE_SETTINGS_MESSAGE,
		};
	}

	const normalizedRecipients = recipients
		.map((recipient) => ({
			...recipient,
			normalizedPhone: recipient.phone ? normalizeMetaWhatsAppPhone(recipient.phone) : null,
		}))
		.filter(
			(
				recipient
			): recipient is ActivityReportRecipient & {
				normalizedPhone: string;
			} => !!recipient.normalizedPhone
		);

	if (normalizedRecipients.length === 0) {
		return {
			outcome: "skipped",
			message: WHATSAPP_NO_VALID_PHONE_MESSAGE,
		};
	}

	const fileName = getReportPdfFileName(report.id);
	const caption = report.title?.trim() || "تقرير المشروع";
	const baseUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;

	try {
		const formData = new FormData();
		formData.append("messaging_product", "whatsapp");
		formData.append("type", "application/pdf");
		formData.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), fileName);

		const uploadResponse = await fetch(`${baseUrl}/media`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			body: formData,
		});
		const uploadPayload = await parseJsonSafely(uploadResponse);
		const mediaId =
			uploadPayload && typeof uploadPayload === "object" && "id" in uploadPayload
				? uploadPayload.id
				: null;

		if (!uploadResponse.ok || typeof mediaId !== "string" || mediaId.length === 0) {
			return {
				outcome: "failed",
				message: WHATSAPP_MEDIA_UPLOAD_FAILED_MESSAGE,
			};
		}

		for (const recipient of normalizedRecipients) {
			const messageResponse = await fetch(`${baseUrl}/messages`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					messaging_product: "whatsapp",
					to: recipient.normalizedPhone,
					type: "document",
					document: {
						id: mediaId,
						filename: fileName,
						caption,
					},
				}),
			});
			const messagePayload = await parseJsonSafely(messageResponse);
			const hasMessageId =
				messagePayload &&
				typeof messagePayload === "object" &&
				"messages" in messagePayload &&
				Array.isArray(messagePayload.messages) &&
				messagePayload.messages.length > 0;

			if (!messageResponse.ok || !hasMessageId) {
				return {
					outcome: "failed",
					message: WHATSAPP_SEND_FAILED_MESSAGE,
				};
			}
		}

		return {
			outcome: "success",
			message: null,
		};
	} catch {
		return {
			outcome: "failed",
			message: WHATSAPP_SEND_FAILED_MESSAGE,
		};
	}
};

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
}): Promise<WhatsAppSendResult> => {
	if (getWhatsAppProvider() === "meta") {
		return sendMetaWhatsAppReport({
			report,
			recipients,
			pdfBuffer,
		});
	}

	return sendWebhookWhatsAppReport({
		project,
		report,
		recipients,
		pdfBuffer,
	});
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
		let whatsappMessage: string | null = null;

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
				const whatsappResult = await sendWhatsAppReport({
					project: payload.project,
					report: payload.report,
					recipients: whatsappRecipients,
					pdfBuffer,
				});
				whatsappOutcome = whatsappResult.outcome;
				whatsappMessage = whatsappResult.message;
			}
		} catch {
			whatsappOutcome = "failed";
			whatsappMessage = WHATSAPP_SEND_FAILED_MESSAGE;
		}

		const emailStatus = mapExecutionOutcomeToStatus(emailOutcome);
		const whatsappStatus = mapExecutionOutcomeToStatus(whatsappOutcome);
		const whatsappWarning =
			emailOutcome === "success"
				? getWhatsAppWarningMessage({
						whatsappOutcome,
						whatsappMessage,
					})
				: null;
		const lastDeliveryError =
			[
				emailOutcome === "failed" ? "فشل إرسال التقرير عبر البريد الإلكتروني" : null,
				emailOutcome === "not_configured"
					? "إعدادات البريد الإلكتروني غير مكتملة، لم يتم إرسال التقرير"
					: null,
				emailOutcome === "skipped" && enabledChannels.email
					? "لا يوجد مستلمون صالحون للبريد الإلكتروني، لم يتم إرسال التقرير"
					: null,
				whatsappOutcome !== "success" && enabledChannels.whatsapp && emailOutcome !== "success"
					? getWhatsAppOutcomeMessage(whatsappOutcome, whatsappMessage)
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
				whatsappMessage,
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
