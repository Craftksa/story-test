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

type DeliveryChannels = {
	email: boolean;
	whatsapp: boolean;
};

type WhatsAppProviderResolved = "meta" | "webhook" | "disabled";
type WhatsAppStageReached =
	| "meta_start"
	| "media_upload_start"
	| "media_upload_failed"
	| "media_upload_success"
	| "message_send_start"
	| "message_send_failed"
	| "message_send_success";

export type WhatsAppDeliveryDiagnostic = {
	requestedWhatsApp: boolean;
	whatsappProviderValue: string;
	whatsappProviderResolved: WhatsAppProviderResolved;
	hasMetaToken: boolean;
	hasMetaPhoneNumberId: boolean;
	metaApiVersion: string | null;
	whatsappStageReached: WhatsAppStageReached | null;
	metaUploadStatus: number | null;
	metaUploadOk: boolean | null;
	metaErrorCode: number | null;
	metaErrorMessage: string | null;
	metaErrorType: string | null;
	metaErrorSubcode: number | null;
};

type DeliveryResult = {
	pdfStatus: "generated" | "failed";
	emailStatus: DeliveryStatus;
	whatsappStatus: DeliveryStatus;
	emailOutcome: DeliveryExecutionStatus;
	whatsappOutcome: DeliveryExecutionStatus;
	lastDeliveryError: string | null;
	pdfBuffer: Buffer | null;
	userMessage: string;
	requestedChannels: DeliveryChannels;
	deliverySucceeded: boolean;
	failureStatusCode: number | null;
	diagnostic: WhatsAppDeliveryDiagnostic | null;
};

type DeliveryPreference = {
	option?: ReportDeliveryOption;
};

type WhatsAppSendResult = {
	outcome: DeliveryExecutionStatus;
	message: string | null;
	diagnostic: WhatsAppDeliveryDiagnostic | null;
};

const EMAIL_FAILED_MESSAGE = "فشل إرسال التقرير عبر البريد الإلكتروني";
const EMAIL_NOT_CONFIGURED_MESSAGE = "إعدادات البريد الإلكتروني غير مكتملة، لم يتم إرسال التقرير";
const EMAIL_NO_VALID_RECIPIENTS_MESSAGE = "لا يوجد مستلمون صالحون للبريد الإلكتروني، لم يتم إرسال التقرير";
const EMAIL_SUCCESS_MESSAGE = "تم إرسال التقرير عبر البريد الإلكتروني بنجاح";

const WHATSAPP_NO_VALID_PHONE_MESSAGE = "لم يتم إرسال واتساب لعدم وجود رقم جوال صالح";
const WHATSAPP_INCOMPLETE_SETTINGS_MESSAGE = "إعدادات واتساب غير مكتملة";
const WHATSAPP_MEDIA_UPLOAD_FAILED_MESSAGE = "فشل رفع ملف التقرير إلى واتساب";
const WHATSAPP_SEND_FAILED_MESSAGE = "فشل إرسال التقرير عبر واتساب";
const WHATSAPP_NOT_CONFIGURED_MESSAGE = "إرسال الواتساب غير مهيأ حالياً، لم يتم إرسال التقرير";
const WHATSAPP_SUCCESS_MESSAGE = "تم إرسال التقرير عبر واتساب بنجاح";
const BOTH_SUCCESS_MESSAGE = "تم إرسال التقرير عبر البريد الإلكتروني وواتساب بنجاح";
const EMAIL_SUCCESS_WHATSAPP_FAILED_MESSAGE = "تم إرسال التقرير عبر البريد الإلكتروني، لكن فشل الإرسال عبر واتساب";
const WHATSAPP_SUCCESS_EMAIL_FAILED_MESSAGE = "تم إرسال التقرير عبر واتساب، لكن فشل الإرسال عبر البريد الإلكتروني";

const getDeliveryChannelsForOption = (option: ReportDeliveryOption): DeliveryChannels => {
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

const getEmailOutcomeMessage = (emailOutcome: DeliveryExecutionStatus) => {
	switch (emailOutcome) {
		case "failed":
			return EMAIL_FAILED_MESSAGE;
		case "not_configured":
			return EMAIL_NOT_CONFIGURED_MESSAGE;
		case "skipped":
			return EMAIL_NO_VALID_RECIPIENTS_MESSAGE;
		case "success":
			return EMAIL_SUCCESS_MESSAGE;
		default:
			return null;
	}
};

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
		case "success":
			return WHATSAPP_SUCCESS_MESSAGE;
		default:
			return null;
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

	if (option === "email") {
		return getEmailOutcomeMessage(emailOutcome) || EMAIL_FAILED_MESSAGE;
	}

	if (option === "whatsapp") {
		return getWhatsAppOutcomeMessage(whatsappOutcome, whatsappMessage) || WHATSAPP_SEND_FAILED_MESSAGE;
	}

	if (emailOutcome === "success" && whatsappOutcome === "success") {
		return BOTH_SUCCESS_MESSAGE;
	}

	if (emailOutcome === "success") {
		if (whatsappOutcome === "failed") {
			return EMAIL_SUCCESS_WHATSAPP_FAILED_MESSAGE;
		}

		return `تم إرسال التقرير عبر البريد الإلكتروني، لكن ${
			getWhatsAppOutcomeMessage(whatsappOutcome, whatsappMessage) || WHATSAPP_SEND_FAILED_MESSAGE
		}`;
	}

	if (whatsappOutcome === "success") {
		if (emailOutcome === "failed") {
			return WHATSAPP_SUCCESS_EMAIL_FAILED_MESSAGE;
		}

		return `تم إرسال التقرير عبر واتساب، لكن ${
			getEmailOutcomeMessage(emailOutcome) || EMAIL_FAILED_MESSAGE
		}`;
	}

	if (emailOutcome !== "success" && whatsappOutcome !== "success") {
		const emailMessage = getEmailOutcomeMessage(emailOutcome);
		const whatsappStatusMessage = getWhatsAppOutcomeMessage(whatsappOutcome, whatsappMessage);

		if (emailMessage && whatsappStatusMessage) {
			return `${emailMessage} ${whatsappStatusMessage}`;
		}

		return emailMessage || whatsappStatusMessage || EMAIL_FAILED_MESSAGE;
	}

	return BOTH_SUCCESS_MESSAGE;
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

const inferDeliveryOptionFromRecipients = (recipients: ActivityReportRecipient[]): ReportDeliveryOption => {
	const emailRecipients = normalizeRecipientsByChannel(recipients, "email");
	const whatsappRecipients = normalizeRecipientsByChannel(recipients, "whatsapp");

	if (emailRecipients.length > 0 && whatsappRecipients.length > 0) {
		return "email_whatsapp";
	}

	if (emailRecipients.length > 0) {
		return "email";
	}

	if (whatsappRecipients.length > 0) {
		return "whatsapp";
	}

	return "pdf_only";
};

const getWhatsAppProviderConfig = (
	requestedWhatsApp: boolean
): {
	value: string;
	resolved: WhatsAppProviderResolved;
} => {
	const rawValue = process.env.WHATSAPP_PROVIDER?.trim();
	const normalizedValue = rawValue?.toLowerCase() ?? "";

	if (!requestedWhatsApp) {
		return {
			value: rawValue || "missing",
			resolved: "disabled",
		};
	}

	return {
		value: rawValue || "missing",
		resolved: normalizedValue === "meta" ? "meta" : "webhook",
	};
};

const getWhatsAppProvider = () => getWhatsAppProviderConfig(true).resolved;

const createWhatsAppDiagnostic = (
	requestedWhatsApp: boolean,
	overrides: Partial<WhatsAppDeliveryDiagnostic> = {}
): WhatsAppDeliveryDiagnostic => {
	const providerConfig = getWhatsAppProviderConfig(requestedWhatsApp);

	return {
		requestedWhatsApp,
		whatsappProviderValue: providerConfig.value,
		whatsappProviderResolved: providerConfig.resolved,
		hasMetaToken: !!process.env.META_WHATSAPP_ACCESS_TOKEN?.trim(),
		hasMetaPhoneNumberId: !!process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim(),
		metaApiVersion: process.env.META_WHATSAPP_API_VERSION?.trim() || null,
		whatsappStageReached: null,
		metaUploadStatus: null,
		metaUploadOk: null,
		metaErrorCode: null,
		metaErrorMessage: null,
		metaErrorType: null,
		metaErrorSubcode: null,
		...overrides,
	};
};

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

const maskPhoneForLog = (phone: string) => {
	if (phone.length <= 4) {
		return "****";
	}

	if (phone.length <= 7) {
		return `${phone.slice(0, 1)}***${phone.slice(-2)}`;
	}

	return `${phone.slice(0, 3)}*****${phone.slice(-4)}`;
};

const getMetaErrorDetails = (payload: unknown) => {
	if (!payload || typeof payload !== "object" || !("error" in payload)) {
		return {
			metaErrorCode: null,
			metaErrorMessage: null,
			metaErrorType: null,
			metaErrorSubcode: null,
		};
	}

	const errorPayload = (payload as { error?: unknown }).error;

	if (!errorPayload || typeof errorPayload !== "object") {
		return {
			metaErrorCode: null,
			metaErrorMessage: "non_json_response",
			metaErrorType: null,
			metaErrorSubcode: null,
		};
	}

	return {
		metaErrorCode:
			"code" in errorPayload && typeof errorPayload.code === "number" ? errorPayload.code : null,
		metaErrorMessage:
			"message" in errorPayload && typeof errorPayload.message === "string"
				? errorPayload.message
				: null,
		metaErrorType:
			"type" in errorPayload && typeof errorPayload.type === "string" ? errorPayload.type : null,
		metaErrorSubcode:
			"error_subcode" in errorPayload && typeof errorPayload.error_subcode === "number"
				? errorPayload.error_subcode
				: null,
	};
};

const logMetaWhatsAppStage = (stage: string, details: Record<string, unknown>) => {
	console.info("[whatsapp-meta]", {
		stage,
		...details,
	});
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
	const diagnostic = createWhatsAppDiagnostic(true);

	if (recipients.length === 0) {
		return {
			outcome: "skipped",
			message: WHATSAPP_NO_VALID_PHONE_MESSAGE,
			diagnostic,
		};
	}

	if (!process.env.WHATSAPP_WEBHOOK_URL) {
		return {
			outcome: "not_configured",
			message: WHATSAPP_NOT_CONFIGURED_MESSAGE,
			diagnostic,
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
				diagnostic,
			};
		}

		return {
			outcome: "success",
			message: null,
			diagnostic,
		};
	} catch {
		return {
			outcome: "failed",
			message: WHATSAPP_SEND_FAILED_MESSAGE,
			diagnostic,
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
	let diagnostic = createWhatsAppDiagnostic(true, {
		whatsappStageReached: "meta_start",
		whatsappProviderResolved: "meta",
	});

	logMetaWhatsAppStage("whatsapp_meta_start", {
		provider: "meta",
		recipientCount: recipients.length,
		hasToken: !!accessToken,
		hasPhoneNumberId: !!phoneNumberId,
		apiVersion: apiVersion || null,
	});

	if (!accessToken || !phoneNumberId || !apiVersion) {
		return {
			outcome: "not_configured",
			message: WHATSAPP_INCOMPLETE_SETTINGS_MESSAGE,
			diagnostic,
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
			diagnostic,
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
		diagnostic = {
			...diagnostic,
			whatsappStageReached: "media_upload_start",
		};

		logMetaWhatsAppStage("whatsapp_media_upload_start", {
			provider: "meta",
		});

		const uploadResponse = await fetch(`${baseUrl}/media`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			body: formData,
		});
		const uploadPayload = await parseJsonSafely(uploadResponse);
		const uploadMetaError = getMetaErrorDetails(uploadPayload);
		const mediaId =
			uploadPayload && typeof uploadPayload === "object" && "id" in uploadPayload
				? uploadPayload.id
				: null;
		const uploadMetaErrorMessage =
			uploadPayload === null
				? "non_json_response"
				: !uploadResponse.ok
					? uploadMetaError.metaErrorMessage
					: typeof mediaId !== "string" || mediaId.length === 0
						? "missing_media_id"
						: uploadMetaError.metaErrorMessage;
		diagnostic = {
			...diagnostic,
			whatsappStageReached:
				uploadResponse.ok && typeof mediaId === "string" && mediaId.length > 0
					? "media_upload_success"
					: "media_upload_failed",
			metaUploadStatus: uploadResponse.status,
			metaUploadOk: uploadResponse.ok,
			metaErrorCode: uploadMetaError.metaErrorCode,
			metaErrorMessage: uploadMetaErrorMessage,
			metaErrorType: uploadMetaError.metaErrorType,
			metaErrorSubcode: uploadMetaError.metaErrorSubcode,
		};

		logMetaWhatsAppStage("whatsapp_media_upload_result", {
			provider: "meta",
			status: uploadResponse.status,
			ok: uploadResponse.ok,
			metaErrorCode: uploadMetaError.metaErrorCode,
			metaErrorMessage: uploadMetaErrorMessage,
			metaErrorType: uploadMetaError.metaErrorType,
			metaErrorSubcode: uploadMetaError.metaErrorSubcode,
		});

		if (!uploadResponse.ok || typeof mediaId !== "string" || mediaId.length === 0) {
			return {
				outcome: "failed",
				message: WHATSAPP_MEDIA_UPLOAD_FAILED_MESSAGE,
				diagnostic,
			};
		}

		for (const recipient of normalizedRecipients) {
			const recipientPhoneMasked = maskPhoneForLog(recipient.normalizedPhone);
			diagnostic = {
				...diagnostic,
				whatsappStageReached: "message_send_start",
			};

			logMetaWhatsAppStage("whatsapp_message_send_start", {
				provider: "meta",
				recipientPhoneMasked,
			});

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
			const messageMetaError = getMetaErrorDetails(messagePayload);
			const hasMessageId =
				messagePayload &&
				typeof messagePayload === "object" &&
				"messages" in messagePayload &&
				Array.isArray(messagePayload.messages) &&
				messagePayload.messages.length > 0;
			const messageMetaErrorMessage =
				messagePayload === null
					? "non_json_response"
					: !messageResponse.ok
						? messageMetaError.metaErrorMessage
						: !hasMessageId
							? "missing_message_id"
							: messageMetaError.metaErrorMessage;
			diagnostic = {
				...diagnostic,
				whatsappStageReached:
					messageResponse.ok && hasMessageId ? "message_send_success" : "message_send_failed",
				metaErrorCode: messageMetaError.metaErrorCode,
				metaErrorMessage: messageMetaErrorMessage,
				metaErrorType: messageMetaError.metaErrorType,
				metaErrorSubcode: messageMetaError.metaErrorSubcode,
			};

			logMetaWhatsAppStage("whatsapp_message_send_result", {
				provider: "meta",
				status: messageResponse.status,
				ok: messageResponse.ok,
				metaErrorCode: messageMetaError.metaErrorCode,
				metaErrorMessage: messageMetaErrorMessage,
				metaErrorType: messageMetaError.metaErrorType,
				metaErrorSubcode: messageMetaError.metaErrorSubcode,
				recipientPhoneMasked,
			});

			if (!messageResponse.ok || !hasMessageId) {
				return {
					outcome: "failed",
					message: WHATSAPP_SEND_FAILED_MESSAGE,
					diagnostic,
				};
			}
		}

		return {
			outcome: "success",
			message: null,
			diagnostic,
		};
	} catch (error) {
		logMetaWhatsAppStage("whatsapp_meta_exception", {
			provider: "meta",
			errorMessage: error instanceof Error ? error.message : "unknown_error",
		});
		diagnostic = {
			...diagnostic,
			metaErrorMessage: error instanceof Error ? error.message : "unknown_error",
		};

		return {
			outcome: "failed",
			message: WHATSAPP_SEND_FAILED_MESSAGE,
			diagnostic,
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

const didRequiredChannelsSucceed = ({
	pdfStatus,
	requestedChannels,
	emailOutcome,
	whatsappOutcome,
}: {
	pdfStatus: "generated" | "failed";
	requestedChannels: DeliveryChannels;
	emailOutcome: DeliveryExecutionStatus;
	whatsappOutcome: DeliveryExecutionStatus;
}) =>
	pdfStatus === "generated" &&
	(!requestedChannels.email || emailOutcome === "success") &&
	(!requestedChannels.whatsapp || whatsappOutcome === "success");

const getFailureStatusCode = ({
	pdfStatus,
	requestedChannels,
	emailOutcome,
	whatsappOutcome,
}: {
	pdfStatus: "generated" | "failed";
	requestedChannels: DeliveryChannels;
	emailOutcome: DeliveryExecutionStatus;
	whatsappOutcome: DeliveryExecutionStatus;
}) => {
	if (pdfStatus === "failed") {
		return 500;
	}

	const requiredOutcomes: DeliveryExecutionStatus[] = [];

	if (requestedChannels.email) {
		requiredOutcomes.push(emailOutcome);
	}

	if (requestedChannels.whatsapp) {
		requiredOutcomes.push(whatsappOutcome);
	}

	if (requiredOutcomes.some((outcome) => outcome === "failed")) {
		return 502;
	}

	if (requiredOutcomes.some((outcome) => outcome === "not_configured" || outcome === "skipped")) {
		return 400;
	}

	return null;
};

export const deliverClientReport = async (
	payload: ReportDocumentPayload,
	preference: DeliveryPreference = {}
): Promise<DeliveryResult> => {
	const option = preference.option ?? inferDeliveryOptionFromRecipients(payload.report.recipients);
	const requestedChannels = getDeliveryChannelsForOption(option);
	const baseDiagnostic = createWhatsAppDiagnostic(requestedChannels.whatsapp);

	try {
		validateReportDocumentPayload(payload);
		const pdfBuffer = await generateReportPdfBuffer(payload);
		validateGeneratedPdfBuffer(pdfBuffer);

		const emailRecipients = requestedChannels.email
			? normalizeRecipientsByChannel(payload.report.recipients, "email")
			: [];
		const whatsappRecipients = requestedChannels.whatsapp
			? normalizeRecipientsByChannel(payload.report.recipients, "whatsapp")
			: [];

		let emailOutcome: DeliveryExecutionStatus = requestedChannels.email ? "failed" : "skipped";
		let whatsappOutcome: DeliveryExecutionStatus = requestedChannels.whatsapp ? "failed" : "skipped";
		let whatsappMessage: string | null = null;
		let diagnostic = baseDiagnostic;

		try {
			if (requestedChannels.email && emailRecipients.length > 0) {
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
			} else if (requestedChannels.email) {
				emailOutcome = "skipped";
			}
		} catch {
			emailOutcome = "failed";
		}

		try {
			if (requestedChannels.whatsapp) {
				const whatsappResult = await sendWhatsAppReport({
					project: payload.project,
					report: payload.report,
					recipients: whatsappRecipients,
					pdfBuffer,
				});
				whatsappOutcome = whatsappResult.outcome;
				whatsappMessage = whatsappResult.message;
				diagnostic = whatsappResult.diagnostic ?? diagnostic;
			}
		} catch {
			whatsappOutcome = "failed";
			whatsappMessage = WHATSAPP_SEND_FAILED_MESSAGE;
		}

		const deliverySucceeded = didRequiredChannelsSucceed({
			pdfStatus: "generated",
			requestedChannels,
			emailOutcome,
			whatsappOutcome,
		});
		const userMessage = buildDeliveryMessage({
			option,
			pdfStatus: "generated",
			emailOutcome,
			whatsappOutcome,
			whatsappMessage,
		});

		return {
			pdfStatus: "generated",
			emailStatus: requestedChannels.email ? mapExecutionOutcomeToStatus(emailOutcome) : "not_applicable",
			whatsappStatus: requestedChannels.whatsapp
				? mapExecutionOutcomeToStatus(whatsappOutcome)
				: "not_applicable",
			emailOutcome,
			whatsappOutcome,
			lastDeliveryError: deliverySucceeded ? null : userMessage,
			pdfBuffer,
			userMessage,
			requestedChannels,
			deliverySucceeded,
			failureStatusCode: deliverySucceeded
				? null
				: getFailureStatusCode({
						pdfStatus: "generated",
						requestedChannels,
						emailOutcome,
						whatsappOutcome,
					}),
			diagnostic,
		};
	} catch (error) {
		const userMessage = getReportPdfUserMessage(error, PDF_DELIVERY_FAILURE_MESSAGE);
		logPdfErrorDetails("deliverClientReport", error, {
			projectId: payload.project.id,
			reportId: payload.report.id,
			deliveryOption: option,
		});

		const emailStatus = requestedChannels.email ? "failed" : "not_applicable";
		const whatsappStatus = requestedChannels.whatsapp ? "failed" : "not_applicable";

		return {
			pdfStatus: "failed",
			emailStatus,
			whatsappStatus,
			emailOutcome: requestedChannels.email ? "failed" : "skipped",
			whatsappOutcome: requestedChannels.whatsapp ? "failed" : "skipped",
			lastDeliveryError: userMessage,
			pdfBuffer: null,
			userMessage,
			requestedChannels,
			deliverySucceeded: false,
			failureStatusCode: 500,
			diagnostic: baseDiagnostic,
		};
	}
};
