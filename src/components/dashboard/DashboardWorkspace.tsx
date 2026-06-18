"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import {
	AlertCircle,
	Clock3,
	ExternalLink,
	FilePlus2,
	FileText,
	Filter,
	FolderKanban,
	Loader2,
	MessageSquarePlus,
	RefreshCcw,
	Send,
	Sparkles,
	UploadCloud,
} from "lucide-react";
import { useCheckedLocale } from "@/lib/client-utils";
import { uploadFiles } from "@/utils/uploadthing";
import { cn, formatStatus } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadgeSystem";
import Spinner from "@/components/Spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ActivityFilter =
	| "all"
	| "pending_approval"
	| "overdue"
	| "waiting_client_action"
	| "no_recent_activity"
	| "recent";

type InternalUser = {
	id: string;
	name: string | null;
	email: string | null;
	role: string | null;
};

type ProjectNote = {
	id: string;
	projectId: string;
	content: string;
	authorId: string | null;
	authorName: string;
	createdAt: string | null;
	updatedAt: string | null;
};

type ReportAttachment = {
	url: string;
	name?: string | null;
	type?: string | null;
};

type LetterAttachment = ReportAttachment;

type ReportRecipient = {
	name: string;
	email?: string | null;
	phone?: string | null;
	channel?: "email" | "whatsapp" | "both" | "none";
};

type ReportDeliveryOption =
	| "draft"
	| "pdf_only"
	| "email"
	| "whatsapp"
	| "email_whatsapp";

type ReportPermission = {
	userId: string;
	userName: string;
	userEmail: string | null;
	accessLevel: "view" | "edit";
};

type ProjectReport = {
	id: string;
	projectId: string;
	reportType: "client" | "internal" | "shared";
	title: string;
	summary: string | null;
	details: string;
	workDetails: string | null;
	attachments: ReportAttachment[];
	recipients: ReportRecipient[];
	status: "draft" | "pending_admin_approval" | "approved" | "rejected" | "sent";
	authorId: string | null;
	authorName: string;
	approvedBy: string | null;
	approvedByName: string | null;
	approvedAt: string | null;
	rejectionReason: string | null;
	adminDecisionNote: string | null;
	pdfStatus: "not_generated" | "generated" | "failed";
	emailStatus: "not_applicable" | "pending" | "sent" | "failed" | "not_configured";
	whatsappStatus: "not_applicable" | "pending" | "sent" | "failed" | "not_configured";
	lastDeliveryError: string | null;
	sentAt: string | null;
	createdAt: string | null;
	updatedAt: string | null;
	permissions: ReportPermission[];
	canEdit: boolean;
	canApprove: boolean;
	canSendToClient: boolean;
};

type ProjectLetter = {
	id: string;
	projectId: string;
	recipientName: string;
	subject: string;
	body: string;
	letterDate: string | null;
	attachments: LetterAttachment[];
	status: "draft" | "ready";
	authorId: string | null;
	authorName: string;
	createdAt: string | null;
	updatedAt: string | null;
	canEdit: boolean;
};

type ProjectSummary = {
	id: string;
	name: string;
	status: string;
	city: string | null;
	district: string | null;
	clientName: string | null;
	clientEmail: string | null;
	lastActivityAt: string | null;
	lastUpdatedAt: string | null;
	noteCount: number;
	lastNote: ProjectNote | null;
	reportCount: number;
	pendingApprovalCount: number;
	overdueTaskCount: number;
	clientActionTaskCount: number;
	totalTaskCount: number;
	teamCount: number;
};

type ProjectDetails = {
	project: ProjectSummary & {
		description: string | null;
		clientId: string | null;
		teamMembers: InternalUser[];
	};
	notes: ProjectNote[];
	reports: ProjectReport[];
	letters: ProjectLetter[];
	activities: Array<{
		id: string;
		type: "task" | "note" | "report";
		title: string;
		description: string;
		occurredAt: string | null;
		priority: "high" | "medium" | "low";
	}>;
	activityItems: ActivityInboxItem[];
};

type ActivityInboxItem = {
	id: string;
	type:
		| "report_pending_approval"
		| "report_resubmitted"
		| "report_needs_changes"
		| "report_sent"
		| "report_send_failed"
		| "letter_pending_approval"
		| "letter_resubmitted"
		| "letter_needs_changes"
		| "letter_sent"
		| "letter_send_failed"
		| "internal_note"
		| "task_follow_up";
	title: string;
	summary: string;
	projectId: string;
	projectName: string;
	createdAt: string;
	createdByName: string | null;
	statusLabel: string;
	relatedType: "report" | "letter" | "task" | "project" | "note";
	relatedId: string;
	reviewNotes: string | null;
	recipientEmail: string | null;
	detailsHref: string | null;
};

type ActivityProjectsResponse = {
	projects: ProjectSummary[];
	internalUsers: InternalUser[];
	activityItems: ActivityInboxItem[];
};

type ActivityMutationResponse = {
	details: ProjectDetails | null;
	message?: string | null;
	reportId?: string | null;
	debug?: ApiErrorDebug | null;
};

type ApiValidationIssue = {
	code?: string;
	message?: string;
	path?: Array<string | number>;
	minimum?: number;
	maximum?: number;
	validation?: string;
	received?: string;
};

type ApiErrorDebug = {
	whatsappStageReached?: string | null;
	metaUploadStatus?: number | null;
	metaErrorCode?: number | null;
	metaErrorMessage?: string | null;
	metaErrorType?: string | null;
	metaErrorSubcode?: number | null;
	hasMetaToken?: boolean | null;
	hasMetaPhoneNumberId?: boolean | null;
	whatsappProviderResolved?: string | null;
};

type ReportSubmitAction = "draft" | "save" | "send";

type ReportFormState = {
	reportId: string | null;
	projectId: string;
	reportType: "client" | "internal" | "shared";
	deliveryOption: ReportDeliveryOption;
	title: string;
	summary: string;
	details: string;
	workDetails: string;
	attachments: ReportAttachment[];
	recipients: ReportRecipient[];
	permissions: Array<{ userId: string; accessLevel: "view" | "edit" }>;
};

type LetterFormState = {
	letterId: string | null;
	projectId: string;
	recipientName: string;
	recipientEmail: string;
	subject: string;
	letterDate: string;
	body: string;
	attachments: LetterAttachment[];
};

type ApprovalDialogState = {
	reportId: string;
	projectId: string;
	decision: "approve" | "reject";
	reason: string;
};

type ActivityCenterProps = {
	currentUser: {
		id?: string | null;
		role?: string | null;
		name?: string | null;
		email?: string | null;
	};
};

const EMPTY_RECIPIENT: ReportRecipient = { name: "", email: "", phone: "", channel: "email" };

const EMPTY_REPORT_FORM: ReportFormState = {
	reportId: null,
	projectId: "",
	reportType: "client",
	deliveryOption: "email",
	title: "",
	summary: "",
	details: "",
	workDetails: "",
	attachments: [],
	recipients: [{ ...EMPTY_RECIPIENT }],
	permissions: [],
};

const EMPTY_LETTER_FORM: LetterFormState = {
	letterId: null,
	projectId: "",
	recipientName: "",
	recipientEmail: "",
	subject: "",
	letterDate: "",
	body: "",
	attachments: [],
};

const reportTypeLabel: Record<ProjectReport["reportType"], string> = {
	client: "تقرير للعميل",
	internal: "تقرير داخلي",
	shared: "تقرير مشترك",
};

const reportStatusLabel: Record<ProjectReport["status"], string> = {
	draft: "مسودة",
	pending_admin_approval: "بانتظار موافقة الأدمن",
	approved: "معتمد",
	rejected: "مرفوض",
	sent: "تم الإرسال",
};

const letterStatusLabel: Record<ProjectLetter["status"], string> = {
	draft: "مسودة",
	ready: "جاهز",
};

const deliveryStatusLabel: Record<ProjectReport["emailStatus"], string> = {
	not_applicable: "غير مطلوب",
	pending: "قيد الانتظار",
	sent: "تم",
	failed: "فشل",
	not_configured: "غير مهيأ",
};

const pdfStatusLabel: Record<ProjectReport["pdfStatus"], string> = {
	not_generated: "غير مولد",
	generated: "تم التوليد",
	failed: "فشل",
};

const deliveryOptionLabel: Record<ReportDeliveryOption, string> = {
	draft: "حفظ كمسودة",
	pdf_only: "إنشاء PDF فقط",
	email: "إرسال PDF عبر البريد الإلكتروني",
	whatsapp: "إرسال PDF عبر واتساب",
	email_whatsapp: "إرسال PDF عبر البريد والواتساب",
};

const isRecentProject = (summary: ProjectSummary) => {
	if (!summary.lastActivityAt) return false;
	const diff = Date.now() - new Date(summary.lastActivityAt).getTime();
	return diff <= 7 * 24 * 60 * 60 * 1000;
};

const matchesActivityFilter = (summary: ProjectSummary, filter: ActivityFilter) => {
	if (filter === "pending_approval") return summary.pendingApprovalCount > 0;
	if (filter === "overdue") return summary.overdueTaskCount > 0;
	if (filter === "waiting_client_action") return summary.clientActionTaskCount > 0;
	if (filter === "no_recent_activity") return !isRecentProject(summary);
	if (filter === "recent") return isRecentProject(summary);
	return true;
};

const getProjectCountLabel = (count: number) => (count === 1 ? "مشروع" : "مشاريع");

const truncate = (value?: string | null, max = 110) => {
	if (!value) return "";
	if (value.length <= max) return value;
	return `${value.slice(0, max).trim()}...`;
};

const inferDeliveryOption = (report: ProjectReport): ReportDeliveryOption => {
	if (report.status === "draft") return "draft";
	return "email";
};

const hasValidEmailAddress = (value?: string | null) =>
	!!value && z.string().email().safeParse(value.trim()).success;

const formatApiDebugDetails = (debug?: ApiErrorDebug | null) => {
	if (!debug) {
		return null;
	}

	const parts: string[] = [];

	if (debug.whatsappStageReached) {
		parts.push(`stage: ${debug.whatsappStageReached}`);
	}

	if (typeof debug.metaUploadStatus === "number") {
		parts.push(`status: ${debug.metaUploadStatus}`);
	}

	if (typeof debug.metaErrorCode === "number") {
		parts.push(`code: ${debug.metaErrorCode}`);
	}

	if (typeof debug.metaErrorSubcode === "number") {
		parts.push(`subcode: ${debug.metaErrorSubcode}`);
	}

	if (debug.metaErrorType) {
		parts.push(`type: ${debug.metaErrorType}`);
	}

	if (debug.metaErrorMessage) {
		parts.push(debug.metaErrorMessage);
	}

	if (!parts.length && debug.whatsappProviderResolved) {
		parts.push(`provider: ${debug.whatsappProviderResolved}`);
	}

	if (!parts.length && debug.hasMetaToken === false) {
		parts.push("meta token missing");
	}

	if (!parts.length && debug.hasMetaPhoneNumberId === false) {
		parts.push("phone number id missing");
	}

	return parts.length ? parts.join(" — ") : null;
};

const normalizeLetterDate = (value?: string | null) => {
	if (!value) return null;
	return value.slice(0, 10);
};

const extractApiErrorMessage = (error: unknown, fallbackMessage: string) => {
	if (axios.isAxiosError(error)) {
		const responseData = error.response?.data as
			| { error?: string; issues?: ApiValidationIssue[]; debug?: ApiErrorDebug | null }
			| undefined;
		const apiIssues = Array.isArray(responseData?.issues) ? responseData.issues : [];
		if (apiIssues.length > 0) {
			return formatValidationIssues(apiIssues);
		}

		const apiMessage = responseData?.error;
		const debugDetails = formatApiDebugDetails(responseData?.debug);
		if (typeof apiMessage === "string" && apiMessage.trim()) {
			const translatedMessage = translateApiErrorMessage(apiMessage);
			return debugDetails ? `${translatedMessage} — ${debugDetails}` : translatedMessage;
		}

		if (debugDetails) {
			return debugDetails;
		}
	}

	if (error instanceof Error && error.message.trim()) {
		return error.message;
	}

	return fallbackMessage;
};

const isValidAbsoluteUrl = (value: string) => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};

const normalizeAttachmentList = <T extends ReportAttachment>(attachments: T[]) =>
	attachments
		.map((attachment) => ({
			...attachment,
			url: attachment.url.trim(),
			name: attachment.name?.trim() || null,
			type: attachment.type?.trim() || null,
		}))
		.filter((attachment) => attachment.url && isValidAbsoluteUrl(attachment.url));

const normalizeReportPermissions = (
	permissions: Array<{ userId: string; accessLevel: "view" | "edit" }>
) => {
	const uniquePermissions = new Map<string, { userId: string; accessLevel: "view" | "edit" }>();

	permissions.forEach((permission) => {
		const userId = permission.userId.trim();
		if (!userId) return;

		uniquePermissions.set(userId, {
			userId,
			accessLevel: permission.accessLevel,
		});
	});

	return Array.from(uniquePermissions.values());
};

const validationFieldLabels: Record<string, string> = {
	projectId: "المشروع",
	reportType: "نوع التقرير",
	title: "عنوان التقرير",
	summary: "ملخص التقرير",
	details: "تفاصيل التقرير",
	workDetails: "التفاصيل الإضافية",
	attachments: "المرفقات",
	recipients: "المستلمون",
	permissions: "الصلاحيات",
	deliveryOption: "خيار الإرسال",
	recipientName: "الجهة المرسل إليها",
	subject: "عنوان الخطاب",
	letterDate: "تاريخ الخطاب",
	body: "نص الخطاب",
	email: "البريد الإلكتروني",
	phone: "رقم الواتساب",
	url: "رابط المرفق",
	userId: "المستخدم",
	accessLevel: "مستوى الصلاحية",
};

const getIssueFieldLabel = (issue: ApiValidationIssue) => {
	const issuePath = Array.isArray(issue.path) ? issue.path : [];
	const [root, index, leaf] = issuePath;

	if (root === "recipients" && typeof index === "number") {
		const leafLabel = typeof leaf === "string" ? validationFieldLabels[leaf] : null;
		return leafLabel
			? `المستلم ${index + 1} - ${leafLabel}`
			: `المستلم ${index + 1}`;
	}

	if (root === "permissions" && typeof index === "number") {
		const leafLabel = typeof leaf === "string" ? validationFieldLabels[leaf] : null;
		return leafLabel
			? `الصلاحية ${index + 1} - ${leafLabel}`
			: `الصلاحية ${index + 1}`;
	}

	if (root === "attachments" && typeof index === "number") {
		const leafLabel = typeof leaf === "string" ? validationFieldLabels[leaf] : null;
		return leafLabel
			? `المرفق ${index + 1} - ${leafLabel}`
			: `المرفق ${index + 1}`;
	}

	if (typeof leaf === "string" && validationFieldLabels[leaf]) {
		return validationFieldLabels[leaf];
	}

	if (typeof root === "string" && validationFieldLabels[root]) {
		return validationFieldLabels[root];
	}

	return "البيانات المدخلة";
};

const translateValidationIssue = (issue: ApiValidationIssue) => {
	if (issue.code === "too_small" && typeof issue.minimum === "number") {
		return `يجب ألا يقل عن ${issue.minimum} أحرف.`;
	}

	if (issue.code === "too_big" && typeof issue.maximum === "number") {
		return `يجب ألا يزيد عن ${issue.maximum} حرفًا.`;
	}

	if (issue.code === "invalid_string" && issue.validation === "email") {
		return "صيغة البريد الإلكتروني غير صحيحة.";
	}

	if (issue.code === "invalid_string" && issue.validation === "url") {
		return "رابط الملف غير صالح.";
	}

	if (issue.code === "invalid_type") {
		return issue.received === "undefined" ? "هذا الحقل مطلوب." : "قيمة هذا الحقل غير صحيحة.";
	}

	if (issue.message === "Invalid email") {
		return "صيغة البريد الإلكتروني غير صحيحة.";
	}

	if (issue.message === "Required") {
		return "هذا الحقل مطلوب.";
	}

	return "القيمة المدخلة غير صحيحة.";
};

const formatValidationIssues = (issues: ApiValidationIssue[]) => {
	const messages = issues
		.slice(0, 3)
		.map((issue) => `${getIssueFieldLabel(issue)}: ${translateValidationIssue(issue)}`);

	return messages.join(" ");
};

const translateApiErrorMessage = (message: string) => {
	const trimmedMessage = message.trim();

	const knownMessages: Record<string, string> = {
		Forbidden: "لا تملك الصلاحية لتنفيذ هذا الإجراء.",
		"Project not found": "المشروع غير موجود أو لا تملك صلاحية الوصول إليه.",
		"Report not found": "التقرير غير موجود.",
		"Letter not found": "الخطاب غير موجود.",
		"Invalid report data": "بيانات التقرير غير مكتملة أو لا تطابق المتطلبات المطلوبة.",
		"Invalid letter data": "بيانات الخطاب غير مكتملة أو لا تطابق المتطلبات المطلوبة.",
		"One or more report permissions are invalid.": "يوجد مستخدم غير صالح ضمن صلاحيات التقرير.",
		"You do not have permission to edit this report.": "لا تملك صلاحية تعديل هذا التقرير.",
		"You do not have permission to edit this letter.": "لا تملك صلاحية تعديل هذا الخطاب.",
		"Only client reports can be sent.": "يمكن إرسال تقارير العميل فقط.",
		"Report must be approved before sending.": "يجب اعتماد التقرير قبل إرساله.",
		"Failed to create report": "تعذر إنشاء التقرير.",
		"Failed to update report": "تعذر تحديث التقرير.",
		"Failed to send report": "تعذر إرسال التقرير.",
		"Failed to create letter": "تعذر إنشاء الخطاب.",
		"Failed to update letter": "تعذر تحديث الخطاب.",
	};

	return knownMessages[trimmedMessage] ?? trimmedMessage;
};

const validateReportForm = ({
	projectId,
	title,
	details,
	reportType,
	permissions,
	isAdmin,
}: {
	projectId: string;
	title: string;
	details: string;
	reportType: ReportFormState["reportType"];
	permissions: Array<{ userId: string; accessLevel: "view" | "edit" }>;
	isAdmin: boolean;
}) => {
	if (!projectId) {
		return "اختر المشروع أولًا.";
	}

	if (title.trim().length < 3) {
		return "عنوان التقرير يجب أن يكون 3 أحرف على الأقل.";
	}

	if (details.trim().length < 5) {
		return "تفاصيل التقرير يجب أن تكون 5 أحرف على الأقل.";
	}

	if (
		isAdmin &&
		reportType !== "client" &&
		permissions.some((permission) => !permission.userId.trim())
	) {
		return "اختر مستخدمًا لكل صلاحية أو احذف الصف الفارغ.";
	}

	return null;
};

const validateLetterForm = ({
	projectId,
	recipientName,
	subject,
	body,
}: {
	projectId: string;
	recipientName: string;
	subject: string;
	body: string;
}) => {
	if (!projectId) {
		return "اختر المشروع أولًا.";
	}

	if (recipientName.trim().length < 2) {
		return "اسم الجهة أو الشخص يجب أن يكون حرفين على الأقل.";
	}

	if (subject.trim().length < 2) {
		return "عنوان الخطاب يجب أن يكون حرفين على الأقل.";
	}

	if (body.trim().length < 5) {
		return "نص الخطاب يجب أن يكون 5 أحرف على الأقل.";
	}

	return null;
};

const getReportDeliveryOptionForAction = (
	action: ReportSubmitAction,
	_currentOption: ReportDeliveryOption
): ReportDeliveryOption => {
	if (action === "draft") {
		return "draft";
	}

	return "email";
};

const priorityClasses: Record<"high" | "medium" | "low", string> = {
	high: "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-400/30 dark:bg-rose-950/35 dark:text-rose-200",
	medium: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/35 dark:text-amber-200",
	low: "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/35 dark:text-emerald-200",
};

const reportStatusClasses: Record<ProjectReport["status"], string> = {
	draft:
		"border-zinc-200 bg-zinc-50 font-semibold text-zinc-900 dark:border-stone-800 dark:bg-stone-950/40 dark:text-stone-200",
	pending_admin_approval:
		"border-amber-200 bg-amber-50 font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
	approved:
		"border-sky-200 bg-sky-50 font-semibold text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
	rejected:
		"border-rose-200 bg-rose-50 font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
	sent:
		"border-emerald-200 bg-emerald-50 font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
};

const letterStatusClasses: Record<ProjectLetter["status"], string> = {
	draft:
		"border-zinc-200 bg-zinc-50 font-semibold text-zinc-900 dark:border-stone-800 dark:bg-stone-950/40 dark:text-stone-200",
	ready:
		"border-sky-200 bg-sky-50 font-semibold text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
};

const activityItemTypeLabel: Record<ActivityInboxItem["type"], string> = {
	report_pending_approval: "تقرير",
	report_resubmitted: "تقرير",
	report_needs_changes: "طلب تعديل",
	report_sent: "إشعار",
	report_send_failed: "إشعار",
	letter_pending_approval: "خطاب",
	letter_resubmitted: "خطاب",
	letter_needs_changes: "طلب تعديل",
	letter_sent: "إشعار",
	letter_send_failed: "إشعار",
	internal_note: "ملاحظة داخلية",
	task_follow_up: "مهمة",
};

const activityItemStatusClasses: Record<ActivityInboxItem["type"], string> = {
	report_pending_approval:
		"border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
	report_resubmitted:
		"border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100",
	report_needs_changes:
		"border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-100",
	report_sent:
		"border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100",
	report_send_failed:
		"border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-100",
	letter_pending_approval:
		"border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
	letter_resubmitted:
		"border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100",
	letter_needs_changes:
		"border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-100",
	letter_sent:
		"border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100",
	letter_send_failed:
		"border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-100",
	internal_note:
		"border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100",
	task_follow_up:
		"border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100",
};

const activityPanelScrollHeightClass = "h-[calc(100vh-320px)]";
const activityPanelScrollContainerClass =
	"overflow-y-scroll overscroll-contain [scrollbar-gutter:stable] [scrollbar-color:rgba(218,197,143,0.55)_rgba(255,255,255,0.05)] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.05] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#9f8a58] hover:[&::-webkit-scrollbar-thumb]:bg-[#dac58f]";
const activityModalOverlayClassName = "fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm";
const activityModalContentClassName =
	"fixed left-1/2 top-1/2 z-[9999] w-full max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-zinc-300/90 bg-zinc-50 p-0 text-zinc-950 shadow-2xl shadow-black/15 dark:border-[#8f7850]/30 dark:bg-[#15110d] dark:text-[#f4ead8] dark:shadow-black/45";
const activityModalHeaderClassName =
	"sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-[#8f7850]/22 dark:bg-[#17120e]/94";
const activityModalFooterClassName =
	"sticky bottom-0 border-t border-zinc-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-[#8f7850]/22 dark:bg-[#17120e]/94";
const activityModalFieldClassName =
	"w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 shadow-sm shadow-black/5 outline-none transition placeholder:text-zinc-500 focus-visible:border-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/10 dark:border-[#7f6c47]/35 dark:bg-[#221b15] dark:text-[#f4ead8] dark:placeholder:text-[#b8ad99] dark:shadow-black/20 dark:focus-visible:border-[#d6bc84] dark:focus-visible:ring-[#d6bc84]/20";
const activityModalSelectContentClassName =
	"z-[10001] border border-zinc-200 bg-white text-zinc-950 shadow-2xl shadow-black/10 dark:border-[#7f6c47]/30 dark:bg-[#1d1712] dark:text-[#f4ead8] dark:shadow-black/35";
const activityModalLabelClassName = "mb-2 block text-sm font-medium text-zinc-800 dark:text-[#eadfc9]";
const activityModalPrimaryButtonClassName =
	"rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#d0b27a] dark:text-[#17120e] dark:hover:bg-[#dec593]";
const activityModalSecondaryButtonClassName =
	"rounded-xl border border-zinc-300 bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:border-zinc-400 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#a78956]/35 dark:bg-[#2a2118] dark:text-[#f0dfbf] dark:hover:border-[#c9a86c]/55 dark:hover:bg-[#34281d]";
const activityModalCancelButtonClassName =
	"rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950 dark:border-[#7f6c47]/30 dark:bg-[#201914] dark:text-[#d4c7ad] dark:hover:bg-[#2a2017] dark:hover:text-[#f4ead8]";
const activityModalCloseButtonClassName =
	"rounded-full border border-zinc-300 bg-white p-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:border-[#7f6c47]/30 dark:bg-[#201914] dark:text-[#d4c7ad] dark:hover:bg-[#2a2017] dark:hover:text-[#f4ead8]";
const activityModalCardClassName =
	"rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-black/5 dark:border-[#7f6c47]/24 dark:bg-[#1a1511] dark:shadow-black/25";
const activityModalSurfaceClassName =
	"rounded-xl border border-zinc-200 bg-zinc-100/80 px-4 py-3 dark:border-[#7f6c47]/24 dark:bg-[#221b15]";
const activityModalEmptySurfaceClassName =
	"rounded-xl border border-dashed border-zinc-300 bg-zinc-100/70 px-4 py-4 text-sm text-zinc-600 dark:border-[#88724b]/32 dark:bg-[#231b15] dark:text-[#c9bda5]";
const activityModalListItemClassName =
	"flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-100/80 px-3 py-3 text-sm dark:border-[#7f6c47]/24 dark:bg-[#211913]";
const activityModalUploadTriggerClassName =
	"inline-flex cursor-pointer items-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm shadow-black/5 transition hover:border-zinc-500 hover:bg-zinc-100 dark:border-[#a78956]/35 dark:bg-[#241c15] dark:text-[#f2e2c3] dark:hover:border-[#d4b679]/60 dark:hover:bg-[#312519]";
const activityModalGhostActionClassName =
	"text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-950 dark:text-[#cdbf9f] dark:hover:bg-[#2d2319] dark:hover:text-[#f4ead8]";
const reportModalContentClassName =
	"fixed left-1/2 top-1/2 z-[9999] w-full max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-zinc-300/90 bg-zinc-50 p-0 text-zinc-950 shadow-2xl shadow-black/15 dark:border-[#8f7850]/30 dark:bg-[#15110d] dark:text-[#f4ead8] dark:shadow-black/45";
const reportModalHeaderClassName =
	"sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-[#8f7850]/22 dark:bg-[#17120e]/94";
const reportModalFooterClassName =
	"sticky bottom-0 border-t border-zinc-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-[#8f7850]/22 dark:bg-[#17120e]/94";
const reportModalFieldClassName =
	"w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 shadow-sm shadow-black/5 outline-none transition placeholder:text-zinc-500 focus-visible:border-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/10 dark:border-[#7f6c47]/35 dark:bg-[#221b15] dark:text-[#f4ead8] dark:placeholder:text-[#b8ad99] dark:shadow-black/20 dark:focus-visible:border-[#d6bc84] dark:focus-visible:ring-[#d6bc84]/20";
const reportModalSelectContentClassName =
	"z-[10001] border border-zinc-200 bg-white text-zinc-950 shadow-2xl shadow-black/10 dark:border-[#7f6c47]/30 dark:bg-[#1d1712] dark:text-[#f4ead8] dark:shadow-black/35";
const reportModalLabelClassName = "mb-2 block text-sm font-medium text-zinc-800 dark:text-[#eadfc9]";
const reportModalPrimaryButtonClassName =
	"rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#d0b27a] dark:text-[#17120e] dark:hover:bg-[#dec593]";
const reportModalSecondaryButtonClassName =
	"rounded-xl border border-zinc-300 bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:border-zinc-400 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#a78956]/35 dark:bg-[#2a2118] dark:text-[#f0dfbf] dark:hover:border-[#c9a86c]/55 dark:hover:bg-[#34281d]";
const reportModalCancelButtonClassName =
	"rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950 dark:border-[#7f6c47]/30 dark:bg-[#201914] dark:text-[#d4c7ad] dark:hover:bg-[#2a2017] dark:hover:text-[#f4ead8]";
const reportModalCloseButtonClassName =
	"rounded-full border border-zinc-300 bg-white p-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:border-[#7f6c47]/30 dark:bg-[#201914] dark:text-[#d4c7ad] dark:hover:bg-[#2a2017] dark:hover:text-[#f4ead8]";
const reportModalCardClassName =
	"rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-black/5 dark:border-[#7f6c47]/24 dark:bg-[#1a1511] dark:shadow-black/25";
const reportModalSurfaceClassName =
	"rounded-xl border border-zinc-200 bg-zinc-100/80 px-4 py-3 dark:border-[#7f6c47]/24 dark:bg-[#221b15]";
const reportModalEmptySurfaceClassName =
	"rounded-xl border border-dashed border-zinc-300 bg-zinc-100/70 px-4 py-4 text-sm text-zinc-600 dark:border-[#88724b]/32 dark:bg-[#231b15] dark:text-[#c9bda5]";
const reportModalListItemClassName =
	"flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-100/80 px-3 py-3 text-sm dark:border-[#7f6c47]/24 dark:bg-[#211913]";
const reportModalUploadTriggerClassName =
	"inline-flex cursor-pointer items-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm shadow-black/5 transition hover:border-zinc-500 hover:bg-zinc-100 dark:border-[#a78956]/35 dark:bg-[#241c15] dark:text-[#f2e2c3] dark:hover:border-[#d4b679]/60 dark:hover:bg-[#312519]";
const reportModalGhostActionClassName =
	"text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-950 dark:text-[#cdbf9f] dark:hover:bg-[#2d2319] dark:hover:text-[#f4ead8]";
const reportModalSubtleTextClassName = "text-sm text-zinc-600 dark:text-[#c8baa0]";
const reportModalMetaCardClassName =
	"rounded-xl border border-zinc-200 bg-zinc-100/85 px-4 py-3 dark:border-[#7f6c47]/24 dark:bg-[#211a14]";
const reportModalRowCardClassName =
	"grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-[#7f6c47]/24 dark:bg-[#1c1611]";

export function DashboardWorkspace({ currentUser }: ActivityCenterProps) {
	const router = useRouter();
	const { lang, dir } = useCheckedLocale();
	const activityDirection = dir === "rtl" ? "rtl" : "ltr";
	const activityTextAlignClass = activityDirection === "rtl" ? "text-right" : "text-left";
	const isAdmin = ["admin", "moderator"].includes(currentUser.role ?? "");
	const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
	const [projects, setProjects] = useState<ProjectSummary[]>([]);
	const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);
	const [activityItems, setActivityItems] = useState<ActivityInboxItem[]>([]);
	const [loadingProjects, setLoadingProjects] = useState(true);
	const [selectedProjectId, setSelectedProjectId] = useState("");
	const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
	const [loadingDetails, setLoadingDetails] = useState(false);
	const [noteDialogOpen, setNoteDialogOpen] = useState(false);
	const [reportDialogOpen, setReportDialogOpen] = useState(false);
	const [letterDialogOpen, setLetterDialogOpen] = useState(false);
	const [whatsAppComingSoonDialogOpen, setWhatsAppComingSoonDialogOpen] = useState(false);
	const [viewingReportId, setViewingReportId] = useState<string | null>(null);
	const [viewingLetterId, setViewingLetterId] = useState<string | null>(null);
	const [approvalDialog, setApprovalDialog] = useState<ApprovalDialogState | null>(null);
	const [noteProjectId, setNoteProjectId] = useState("");
	const [noteText, setNoteText] = useState("");
	const [reportForm, setReportForm] = useState<ReportFormState>(EMPTY_REPORT_FORM);
	const [letterForm, setLetterForm] = useState<LetterFormState>(EMPTY_LETTER_FORM);
	const [submittingNote, setSubmittingNote] = useState(false);
	const [reportSubmitAction, setReportSubmitAction] = useState<ReportSubmitAction | null>(null);
	const [submittingLetter, setSubmittingLetter] = useState(false);
	const [actioningLetterId, setActioningLetterId] = useState<string | null>(null);
	const [uploadingAttachments, setUploadingAttachments] = useState(false);
	const [uploadingLetterAttachments, setUploadingLetterAttachments] = useState(false);
	const [actioningReportId, setActioningReportId] = useState<string | null>(null);
	const lastPrintOpenRef = useRef<{ url: string; openedAt: number } | null>(null);

	const formatDate = (value?: string | null) => {
		if (!value) return "غير متوفر";
		return new Date(value).toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
			dateStyle: "medium",
			timeStyle: "short",
		});
	};

	const getActivityItemIcon = (itemType: ActivityInboxItem["type"]) => {
		if (itemType.includes("report")) return FileText;
		if (itemType.includes("letter")) return FilePlus2;
		if (itemType === "internal_note") return MessageSquarePlus;
		if (itemType === "task_follow_up") return Clock3;
		return AlertCircle;
	};

	const loadProjects = async () => {
		setLoadingProjects(true);
		try {
			const response = await axios.get<ActivityProjectsResponse>("/api/activity/projects");
			setProjects(response.data.projects);
			setInternalUsers(response.data.internalUsers);
			setActivityItems(response.data.activityItems || []);
			setSelectedProjectId((current) => {
				if (current && response.data.projects.some((project) => project.id === current)) {
					return current;
				}
				return response.data.projects[0]?.id ?? "";
			});
		} catch (error) {
			console.error("Failed to load activity projects", error);
			toast.error("تعذر تحميل بيانات صفحة النشاط.");
		} finally {
			setLoadingProjects(false);
		}
	};

	const loadProjectDetails = async (projectId: string) => {
		if (!projectId) {
			setProjectDetails(null);
			return null;
		}

		setLoadingDetails(true);
		try {
			const response = await axios.get<ProjectDetails>(`/api/activity/projects/${projectId}`);
			setProjectDetails(response.data);
			return response.data;
		} catch (error) {
			console.error("Failed to load project activity details", error);
			toast.error("تعذر تحميل تفاصيل النشاط لهذا المشروع.");
			setProjectDetails(null);
			return null;
		} finally {
			setLoadingDetails(false);
		}
	};

	useEffect(() => {
		void loadProjects();
	}, []);

	useEffect(() => {
		if (!selectedProjectId) return;
		void loadProjectDetails(selectedProjectId);
	}, [selectedProjectId]);

	const filteredProjects = useMemo(() => {
		return projects.filter((summary) => matchesActivityFilter(summary, activityFilter));
	}, [activityFilter, projects]);

	const summaryCards = useMemo(
		() => [
			{
				filter: "all" as ActivityFilter,
				label: "كل المشاريع",
				count: projects.length,
				icon: FolderKanban,
			},
			{
				filter: "pending_approval" as ActivityFilter,
				label: "تحتاج اعتماد",
				count: projects.filter((summary) => matchesActivityFilter(summary, "pending_approval")).length,
				icon: AlertCircle,
			},
			{
				filter: "overdue" as ActivityFilter,
				label: "متأخرة",
				count: projects.filter((summary) => matchesActivityFilter(summary, "overdue")).length,
				icon: Clock3,
			},
			{
				filter: "waiting_client_action" as ActivityFilter,
				label: "بانتظار العميل",
				count: projects.filter((summary) => matchesActivityFilter(summary, "waiting_client_action")).length,
				icon: MessageSquarePlus,
			},
			{
				filter: "no_recent_activity" as ActivityFilter,
				label: "بدون نشاط حديث",
				count: projects.filter((summary) => matchesActivityFilter(summary, "no_recent_activity")).length,
				icon: RefreshCcw,
			},
			{
				filter: "recent" as ActivityFilter,
				label: "محدثة اليوم",
				count: projects.filter((summary) => matchesActivityFilter(summary, "recent")).length,
				icon: Sparkles,
			},
		],
		[projects]
	);

	useEffect(() => {
		if (!filteredProjects.length) return;
		if (filteredProjects.some((project) => project.id === selectedProjectId)) return;
		setSelectedProjectId(filteredProjects[0].id);
	}, [filteredProjects, selectedProjectId]);

	const selectedSummary = projects.find((project) => project.id === selectedProjectId) ?? null;
	const visibleActivityItems = useMemo(
		() =>
			activityItems.filter((item) => {
				if (item.type === "report_pending_approval" || item.type === "report_resubmitted") {
					return isAdmin;
				}

				if (item.type === "report_needs_changes") {
					return !isAdmin;
				}

				if (item.type === "letter_pending_approval" || item.type === "letter_resubmitted") {
					return isAdmin;
				}

				if (item.type === "letter_needs_changes") {
					return !isAdmin;
				}

				return true;
			}),
		[activityItems, isAdmin]
	);
	const viewedReport = useMemo(
		() => projectDetails?.reports.find((report) => report.id === viewingReportId) ?? null,
		[projectDetails?.reports, viewingReportId]
	);
	const viewedLetter = useMemo(
		() => projectDetails?.letters.find((letter) => letter.id === viewingLetterId) ?? null,
		[projectDetails?.letters, viewingLetterId]
	);

	useEffect(() => {
		if (!viewingReportId) return;
		if (!projectDetails?.reports.some((report) => report.id === viewingReportId)) {
			setViewingReportId(null);
		}
	}, [projectDetails, viewingReportId]);

	useEffect(() => {
		if (!viewingLetterId) return;
		if (!projectDetails?.letters.some((letter) => letter.id === viewingLetterId)) {
			setViewingLetterId(null);
		}
	}, [projectDetails, viewingLetterId]);

	const openAddNoteDialog = () => {
		setNoteProjectId(selectedProjectId || filteredProjects[0]?.id || "");
		setNoteText("");
		setNoteDialogOpen(true);
	};

	const openCreateReportDialog = () => {
		setReportForm({
			...EMPTY_REPORT_FORM,
			projectId: selectedProjectId || filteredProjects[0]?.id || "",
		});
		setReportDialogOpen(true);
	};

	const openCreateLetterDialog = () => {
		setLetterForm({
			...EMPTY_LETTER_FORM,
			projectId: selectedProjectId || filteredProjects[0]?.id || "",
			recipientEmail:
				getProjectClientEmail(selectedProjectId || filteredProjects[0]?.id || "") || "",
			letterDate: new Date().toISOString().slice(0, 10),
		});
		setLetterDialogOpen(true);
	};

	const openWhatsAppComingSoonDialog = () => {
		setWhatsAppComingSoonDialogOpen(true);
	};

	const openEditReportDialog = (report: ProjectReport) => {
		setReportForm({
			reportId: report.id,
			projectId: report.projectId,
			reportType: report.reportType,
			deliveryOption: inferDeliveryOption(report),
			title: report.title,
			summary: report.summary || "",
			details: report.details,
			workDetails: report.workDetails || "",
			attachments: report.attachments,
			recipients:
				report.recipients.length > 0
					? report.recipients.map((recipient) => ({
							name: recipient.name,
							email: recipient.email || "",
							phone: recipient.phone || "",
							channel: "email",
						}))
					: [{ ...EMPTY_RECIPIENT }],
			permissions: report.permissions.map((permission) => ({
				userId: permission.userId,
				accessLevel: permission.accessLevel,
			})),
		});
		setReportDialogOpen(true);
	};

	const openViewReportDialog = (report: ProjectReport) => {
		setViewingReportId(report.id);
	};

	const openEditLetterDialog = (letter: ProjectLetter) => {
		setLetterForm({
			letterId: letter.id,
			projectId: letter.projectId,
			recipientName: letter.recipientName,
			recipientEmail: getProjectClientEmail(letter.projectId) || "",
			subject: letter.subject,
			letterDate: letter.letterDate ? letter.letterDate.slice(0, 10) : "",
			body: letter.body,
			attachments: letter.attachments,
		});
		setLetterDialogOpen(true);
	};

	const openViewLetterDialog = (letter: ProjectLetter) => {
		setViewingLetterId(letter.id);
	};

	const ensureProjectLoaded = async (projectId: string) => {
		if (projectDetails?.project.id === projectId) {
			return projectDetails;
		}

		setSelectedProjectId(projectId);
		return loadProjectDetails(projectId);
	};

	const handleActivityDetails = async (item: ActivityInboxItem) => {
		if (item.relatedType === "task" && item.detailsHref) {
			router.push(item.detailsHref);
			return;
		}

		if (item.relatedType === "project") {
			setSelectedProjectId(item.projectId);
			return;
		}

		const details = await ensureProjectLoaded(item.projectId);
		if (!details) return;

		if (item.relatedType === "report") {
			const report = details.reports.find((entry) => entry.id === item.relatedId);
			if (report) {
				openViewReportDialog(report);
			}
			return;
		}

		if (item.relatedType === "letter") {
			const letter = details.letters.find((entry) => entry.id === item.relatedId);
			if (letter) {
				openViewLetterDialog(letter);
			}
		}
	};

	const handleActivityEdit = async (item: ActivityInboxItem) => {
		const details = await ensureProjectLoaded(item.projectId);
		if (!details) return;

		if (item.relatedType === "report") {
			const report = details.reports.find((entry) => entry.id === item.relatedId);
			if (report) {
				openEditReportDialog(report);
			}
			return;
		}

		if (item.relatedType === "letter") {
			const letter = details.letters.find((entry) => entry.id === item.relatedId);
			if (letter) {
				openEditLetterDialog(letter);
			}
		}
	};

	const handleNoteSubmit = async () => {
		if (!noteProjectId || !noteText.trim()) {
			toast.error("اكتب الملاحظة وحدد المشروع أولًا.");
			return;
		}

		setSubmittingNote(true);
		try {
			const response = await axios.post<ProjectDetails>("/api/activity/notes", {
				projectId: noteProjectId,
				content: noteText.trim(),
			});

			setProjectDetails(response.data);
			setSelectedProjectId(response.data.project.id);
			setNoteDialogOpen(false);
			setNoteText("");
			await loadProjects();
			toast.success("تمت إضافة الملاحظة بنجاح.");
		} catch (error) {
			console.error("Failed to save note", error);
			toast.error("تعذر إضافة الملاحظة.");
		} finally {
			setSubmittingNote(false);
		}
	};

	const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files ? Array.from(event.target.files) : [];
		if (!files.length) return;

		setUploadingAttachments(true);
		try {
			const uploaded = await uploadFiles("reportAttachmentUploader", { files });
			const nextAttachments = uploaded.map((file) => ({
				url: (file as { ufsUrl?: string; url?: string }).ufsUrl || (file as { url?: string }).url || "",
				name: (file as { name?: string }).name || "",
				type: (file as { type?: string }).type || "",
			}));

			setReportForm((current) => ({
				...current,
				attachments: [...current.attachments, ...nextAttachments.filter((item) => item.url)],
			}));
			toast.success("تم رفع المرفقات.");
		} catch (error) {
			console.error("Failed to upload report attachments", error);
			toast.error("تعذر رفع المرفقات.");
		} finally {
			setUploadingAttachments(false);
			event.target.value = "";
		}
	};

	const handleLetterAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files ? Array.from(event.target.files) : [];
		if (!files.length) return;

		setUploadingLetterAttachments(true);
		try {
			const uploaded = await uploadFiles("reportAttachmentUploader", { files });
			const nextAttachments = uploaded.map((file) => ({
				url: (file as { ufsUrl?: string; url?: string }).ufsUrl || (file as { url?: string }).url || "",
				name: (file as { name?: string }).name || "",
				type: (file as { type?: string }).type || "",
			}));

			setLetterForm((current) => ({
				...current,
				attachments: [...current.attachments, ...nextAttachments.filter((item) => item.url)],
			}));
			toast.success("تم رفع مرفقات الخطاب.");
		} catch (error) {
			console.error("Failed to upload letter attachments", error);
			toast.error("تعذر رفع مرفقات الخطاب.");
		} finally {
			setUploadingLetterAttachments(false);
			event.target.value = "";
		}
	};

	const upsertProjectDetails = async (
		request: Promise<{ data: ProjectDetails | ActivityMutationResponse | null }>
	) => {
		const response = await request;
		const payload =
			response.data && typeof response.data === "object" && "details" in response.data
				? (response.data as ActivityMutationResponse)
				: {
						details: response.data as ProjectDetails | null,
						message: null,
						reportId: null,
					};

		if (payload.details) {
			setProjectDetails(payload.details);
			setSelectedProjectId(payload.details.project.id);
			setActivityItems(payload.details.activityItems || []);
		}
		await loadProjects();
		return payload;
	};

	const handleReportSubmit = async () => {
		void handleReportAction("save");
	};

	const closeReportDialog = () => {
		setReportDialogOpen(false);
		setReportForm({
			...EMPTY_REPORT_FORM,
			projectId: selectedProjectId,
		});
	};

	const closeLetterDialog = () => {
		setLetterDialogOpen(false);
		setLetterForm({
			...EMPTY_LETTER_FORM,
			projectId: selectedProjectId,
		});
	};

	const getProjectClientEmail = (projectId: string) =>
		projects.find((project) => project.id === projectId)?.clientEmail?.trim() || null;

	const getCleanedReportRecipients = () =>
		reportForm.recipients
			.map((recipient) => ({
				name: recipient.name.trim(),
				email: recipient.email?.trim() || null,
				phone: recipient.phone?.trim() || null,
				channel: "email" as const,
			}))
			.filter((recipient) => recipient.name);

	const buildReportPayload = (action: ReportSubmitAction) => {
		const deliveryOption = getReportDeliveryOptionForAction(action, reportForm.deliveryOption);

		return {
			projectId: reportForm.projectId,
			reportType: reportForm.reportType,
			deliveryOption,
			submitAction: action,
			title: reportForm.title.trim(),
			summary: reportForm.summary.trim() || null,
			details: reportForm.details.trim(),
			workDetails: reportForm.workDetails.trim() || null,
			attachments: normalizeAttachmentList(reportForm.attachments),
			recipients: getCleanedReportRecipients(),
			permissions: normalizeReportPermissions(reportForm.permissions),
		};
	};

	const validateReportAction = (action: ReportSubmitAction) => {
		const validationError = validateReportForm({
			projectId: reportForm.projectId,
			title: reportForm.title,
			details: reportForm.details,
			reportType: reportForm.reportType,
			permissions: reportForm.permissions,
			isAdmin,
		});

		if (validationError) {
			return validationError;
		}

		if (action !== "draft") {
			const cleanedRecipients = getCleanedReportRecipients();

			if (
				cleanedRecipients.length === 0 ||
				cleanedRecipients.some((recipient) => !hasValidEmailAddress(recipient.email))
			) {
				return "البريد الإلكتروني مطلوب لإرسال التقرير";
			}
		}

		if (action === "send") {
			if (!isAdmin) {
				return "لا تملك صلاحية إرسال التقرير.";
			}

			if (reportForm.reportType !== "client") {
				return "يمكن إرسال تقارير العميل فقط.";
			}

			const deliveryOption = getReportDeliveryOptionForAction(action, reportForm.deliveryOption);
			const cleanedRecipients = getCleanedReportRecipients();
			const hasEmailRecipient = cleanedRecipients.some((recipient) => !!recipient.email);
			if (deliveryOption === "email" && !hasEmailRecipient) {
				return "البريد الإلكتروني مطلوب لإرسال التقرير";
			}
		}

		return null;
	};

	const handleReportAction = async (action: ReportSubmitAction) => {
		const validationError = validateReportAction(action);
		if (validationError) {
			toast.error(validationError);
			return;
		}

		setReportSubmitAction(action);
		try {
			const payload = buildReportPayload(action);
			const saveResponse = await upsertProjectDetails(
				reportForm.reportId
					? axios.patch<ActivityMutationResponse>(
							`/api/activity/reports/${reportForm.reportId}`,
							payload
						)
					: axios.post<ActivityMutationResponse>("/api/activity/reports", payload)
			);

			const savedReportId = saveResponse.reportId || reportForm.reportId;
			if (savedReportId && savedReportId !== reportForm.reportId) {
				setReportForm((current) => ({
					...current,
					reportId: savedReportId,
					deliveryOption: payload.deliveryOption,
				}));
			}

			if (action === "send") {
				if (!savedReportId) {
					throw new Error("تعذر حفظ التقرير قبل الإرسال.");
				}

				const sendResponse = await upsertProjectDetails(
					axios.post<ActivityMutationResponse>(`/api/activity/reports/${savedReportId}/send`, {})
				);
				toast.success(sendResponse.message || "تم إرسال التقرير بنجاح");
				closeReportDialog();
				return;
			}

			toast.success(
				saveResponse.message ||
					(action === "draft" ? "تم حفظ التقرير كمسودة" : "تم حفظ التعديلات بنجاح.")
			);
			closeReportDialog();
		} catch (error) {
			console.error(`Failed to ${action} report`, error);
			toast.error(
				extractApiErrorMessage(
					error,
					action === "send" ? "تعذر إرسال التقرير." : "تعذر حفظ التقرير."
				)
			);
		} finally {
			setReportSubmitAction(null);
		}
	};

	const handleLetterAction = async (action: "save" | "send") => {
		const validationError = validateLetterForm({
			projectId: letterForm.projectId,
			recipientName: letterForm.recipientName,
			subject: letterForm.subject,
			body: letterForm.body,
		});

		if (validationError) {
			toast.error(validationError);
			return;
		}

		if (action === "send" && !hasValidEmailAddress(letterForm.recipientEmail)) {
			toast.error("البريد الإلكتروني مطلوب لإرسال الخطاب");
			return;
		}

		const cleanedAttachments = normalizeAttachmentList(letterForm.attachments);

		setSubmittingLetter(true);
		try {
			const payload = {
				projectId: letterForm.projectId,
				recipientName: letterForm.recipientName.trim(),
				subject: letterForm.subject.trim(),
				letterDate: letterForm.letterDate || null,
				body: letterForm.body.trim(),
				attachments: cleanedAttachments,
			};

			const isEditingLetter = !!letterForm.letterId;
			let savedLetterId = letterForm.letterId;
			let responsePayload: ActivityMutationResponse;

			if (letterForm.letterId) {
				responsePayload = await upsertProjectDetails(
					axios.patch<ActivityMutationResponse>(
						`/api/activity/letters/${letterForm.letterId}`,
						payload
					)
				);
			} else {
				responsePayload = await upsertProjectDetails(
					axios.post<ActivityMutationResponse>("/api/activity/letters", payload)
				);
			}

			if (!savedLetterId) {
				const matchingLetter = responsePayload.details?.letters
					.filter((letter) => letter.projectId === payload.projectId)
					.sort(
						(a, b) =>
							new Date(b.updatedAt || b.createdAt || 0).getTime() -
							new Date(a.updatedAt || a.createdAt || 0).getTime()
					)
					.find(
						(letter) =>
							letter.recipientName === payload.recipientName &&
							letter.subject === payload.subject &&
							letter.body === payload.body &&
							normalizeLetterDate(letter.letterDate) === normalizeLetterDate(payload.letterDate)
					);

				savedLetterId = matchingLetter?.id ?? null;
			}

			if (action === "send") {
				if (!savedLetterId) {
					throw new Error("تعذر حفظ الخطاب قبل الإرسال.");
				}

				const sendResponse = await upsertProjectDetails(
					axios.post<ActivityMutationResponse>(`/api/activity/letters/${savedLetterId}/send`, {
						recipientEmail: letterForm.recipientEmail.trim(),
					})
				);
				toast.success(sendResponse.message || "تم إرسال الخطاب عبر البريد الإلكتروني بنجاح");
				closeLetterDialog();
				return;
			}

			toast.success(
				responsePayload.message ||
					(isEditingLetter ? "تم تحديث الخطاب." : "تم إنشاء الخطاب بنجاح.")
			);
			closeLetterDialog();
		} catch (error) {
			console.error(`Failed to ${action} letter`, error);
			toast.error(
				extractApiErrorMessage(
					error,
					action === "send" ? "فشل إرسال الخطاب عبر البريد الإلكتروني" : "تعذر حفظ الخطاب."
				)
			);
		} finally {
			setSubmittingLetter(false);
		}
	};

	const handleResubmitReport = async (item: ActivityInboxItem) => {
		const details = await ensureProjectLoaded(item.projectId);
		if (!details) return;

		const report = details.reports.find((entry) => entry.id === item.relatedId);
		if (!report) {
			toast.error("تعذر العثور على التقرير لإعادة تسليمه.");
			return;
		}

		setActioningReportId(report.id);
		try {
			const responsePayload = await upsertProjectDetails(
				axios.patch<ActivityMutationResponse>(`/api/activity/reports/${report.id}`, {
					title: report.title,
					summary: report.summary || null,
					details: report.details,
					workDetails: report.workDetails || null,
					attachments: normalizeAttachmentList(report.attachments),
					recipients: report.recipients.map((recipient) => ({
						name: recipient.name,
						email: recipient.email || null,
						phone: recipient.phone || null,
						channel: "email",
					})),
					permissions: report.permissions.map((permission) => ({
						userId: permission.userId,
						accessLevel: permission.accessLevel,
					})),
					deliveryOption: "email",
					submitAction: "save",
				})
			);
			toast.success(responsePayload.message || "تمت إعادة تسليم التقرير للمراجعة.");
		} catch (error) {
			console.error("Failed to resubmit report", error);
			toast.error(extractApiErrorMessage(error, "تعذر إعادة تسليم التقرير للمراجعة."));
		} finally {
			setActioningReportId(null);
		}
	};

	const handleApprovalAction = async () => {
		if (!approvalDialog) return;
		if (approvalDialog.decision === "reject" && !approvalDialog.reason.trim()) {
			toast.error("سبب الرفض مطلوب.");
			return;
		}

		setActioningReportId(approvalDialog.reportId);
		try {
			const responsePayload = await upsertProjectDetails(
				axios.patch<ActivityMutationResponse>(`/api/activity/reports/${approvalDialog.reportId}/approval`, {
					decision: approvalDialog.decision,
					reason: approvalDialog.reason.trim() || null,
				})
			);
			toast.success(
				responsePayload.message ||
					(approvalDialog.decision === "approve" ? "تم اعتماد التقرير." : "تم رفض التقرير.")
			);
			setApprovalDialog(null);
		} catch (error) {
			console.error("Failed to process report approval", error);
			toast.error(extractApiErrorMessage(error, "تعذر تنفيذ إجراء الموافقة."));
		} finally {
			setActioningReportId(null);
		}
	};

	const handleSendReport = async (report: ProjectReport) => {
		setActioningReportId(report.id);
		try {
			const responsePayload = await upsertProjectDetails(
				axios.post<ActivityMutationResponse>(`/api/activity/reports/${report.id}/send`, {})
			);
			toast.success(responsePayload.message || "تم إرسال التقرير للعميل.");
		} catch (error) {
			console.error("Failed to send report", error);
			toast.error(extractApiErrorMessage(error, "تعذر إرسال التقرير."));
		} finally {
			setActioningReportId(null);
		}
	};

	const handleSendLetter = (letter: ProjectLetter) => {
		setViewingLetterId(null);
		openEditLetterDialog(letter);
	};

	const openPrintPage = (url: string) => {
		if (!url) return;

		const now = Date.now();
		if (
			lastPrintOpenRef.current &&
			lastPrintOpenRef.current.url === url &&
			now - lastPrintOpenRef.current.openedAt < 1000
		) {
			return;
		}

		lastPrintOpenRef.current = { url, openedAt: now };
		window.open(url, "_blank", "noopener,noreferrer");
	};

	const handleOpenReportPdf = (report: ProjectReport) => {
		openPrintPage(`/activity/reports/${report.id}/print`);
	};

	const handleOpenLetterPrint = (letter: ProjectLetter) => {
		openPrintPage(`/activity/letters/${letter.id}/print`);
	};

	const addRecipient = () => {
		setReportForm((current) => ({
			...current,
			recipients: [...current.recipients, { ...EMPTY_RECIPIENT }],
		}));
	};

	const updateRecipient = (index: number, key: keyof ReportRecipient, value: string) => {
		setReportForm((current) => ({
			...current,
			recipients: current.recipients.map((recipient, currentIndex) =>
				currentIndex === index ? { ...recipient, [key]: value } : recipient
			),
		}));
	};

	const removeRecipient = (index: number) => {
		setReportForm((current) => ({
			...current,
			recipients:
				current.recipients.length === 1
					? [{ ...EMPTY_RECIPIENT }]
					: current.recipients.filter((_, currentIndex) => currentIndex !== index),
		}));
	};

	const handleWhatsAppFieldKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			openWhatsAppComingSoonDialog();
		}
	};

	const addPermission = () => {
		setReportForm((current) => ({
			...current,
			permissions: [...current.permissions, { userId: "", accessLevel: "view" }],
		}));
	};

	const updatePermission = (
		index: number,
		key: "userId" | "accessLevel",
		value: string
	) => {
		setReportForm((current) => ({
			...current,
			permissions: current.permissions.map((permission, currentIndex) =>
				currentIndex === index
					? {
							...permission,
							[key]:
								key === "accessLevel"
									? (value as "view" | "edit")
									: value,
						}
					: permission
			),
		}));
	};

	const removePermission = (index: number) => {
		setReportForm((current) => ({
			...current,
			permissions: current.permissions.filter((_, currentIndex) => currentIndex !== index),
		}));
	};

	const selectedProjectTeam = projectDetails?.project.teamMembers ?? [];
	const visiblePermissionUsers = internalUsers.filter((user) => user.id !== currentUser.id);

	const renderActivityItemActions = (item: ActivityInboxItem) => {
		if (item.type === "report_pending_approval" || item.type === "report_resubmitted") {
			return (
				<>
					<Button
						type="button"
						size="sm"
						onClick={() =>
							setApprovalDialog({
								reportId: item.relatedId,
								projectId: item.projectId,
								decision: "approve",
								reason: "",
							})
						}
						disabled={actioningReportId === item.relatedId}
					>
						موافقة وإرسال
					</Button>
					<Button type="button" size="sm" variant="outline" onClick={() => void handleActivityEdit(item)}>
						تعديل
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() =>
							setApprovalDialog({
								reportId: item.relatedId,
								projectId: item.projectId,
								decision: "reject",
								reason: "",
							})
						}
					>
						إرجاع للتعديل
					</Button>
				</>
			);
		}

		if (item.type === "report_needs_changes") {
			return (
				<>
					<Button type="button" size="sm" variant="outline" onClick={() => void handleActivityEdit(item)}>
						فتح وتعديل
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={() => void handleResubmitReport(item)}
						disabled={actioningReportId === item.relatedId}
					>
						تسليم للمراجعة
					</Button>
				</>
			);
		}

		if (
			item.type === "letter_pending_approval" ||
			item.type === "letter_resubmitted" ||
			item.type === "letter_needs_changes"
		) {
			return (
				<>
					<Button type="button" size="sm" variant="outline" onClick={() => void handleActivityEdit(item)}>
						فتح وتعديل
					</Button>
					<Button type="button" size="sm" variant="ghost" onClick={() => void handleActivityDetails(item)}>
						Details
					</Button>
				</>
			);
		}

		return (
			<Button type="button" size="sm" variant="ghost" onClick={() => void handleActivityDetails(item)}>
				Details
			</Button>
		);
	};

	return (
		<div dir={activityDirection} className={cn("space-y-4", activityTextAlignClass)}>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
				{summaryCards.map((card) => {
					const isActive = activityFilter === card.filter;
					const isApprovalCard = card.filter === "pending_approval";
					const Icon = card.icon;

					return (
						<button
							key={card.filter}
							type="button"
							onClick={() => setActivityFilter(card.filter)}
							className={cn(
								"rounded-2xl border px-4 py-3 text-right transition hover:border-primary/30 hover:bg-muted/30",
								isActive
									? isApprovalCard
										? "border-destructive/35 bg-destructive/10 shadow-sm"
										: "border-primary/35 bg-primary/5 shadow-sm"
									: "border-border/60 bg-background"
							)}
						>
							<div className="flex items-start justify-between gap-3">
								<div className={cn("min-w-0 flex-1", activityTextAlignClass)}>
									<p
										className={cn(
											"text-sm font-medium",
											isActive && isApprovalCard ? "text-destructive" : "text-foreground"
										)}
									>
										{card.label}
									</p>
									<div className="mt-3 flex items-end gap-2">
										<span className="text-2xl font-semibold text-foreground">{card.count}</span>
										<span className="pb-1 text-xs text-muted-foreground">
											{getProjectCountLabel(card.count)}
										</span>
									</div>
								</div>
								<div
									className={cn(
										"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
										isActive
											? isApprovalCard
												? "border-destructive/25 bg-destructive/10 text-destructive"
												: "border-primary/20 bg-primary/10 text-primary"
											: "border-border/60 bg-muted/20 text-muted-foreground"
									)}
								>
									<Icon className="h-4 w-4" />
								</div>
							</div>
						</button>
					);
				})}
			</div>
			<Card className="border-border/70 shadow-sm">
				<CardHeader className="gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div className={cn("space-y-1", activityTextAlignClass)}>
						<CardTitle>لوحة التحكم</CardTitle>
					</div>
					<div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
						<Select value={activityFilter} onValueChange={(value) => setActivityFilter(value as ActivityFilter)}>
							<SelectTrigger className="w-full min-w-44 bg-background sm:w-48">
								<Filter className="me-2 h-4 w-4 text-muted-foreground" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">كل المشاريع</SelectItem>
								<SelectItem value="pending_approval">تحتاج اعتماد</SelectItem>
								<SelectItem value="overdue">متأخرة</SelectItem>
								<SelectItem value="waiting_client_action">بانتظار العميل</SelectItem>
								<SelectItem value="no_recent_activity">بدون نشاط حديث</SelectItem>
								<SelectItem value="recent">محدثة اليوم</SelectItem>
							</SelectContent>
						</Select>
						<Button type="button" variant="outline" onClick={openAddNoteDialog}>
							<MessageSquarePlus className="me-2 h-4 w-4" />
							إضافة ملاحظة
						</Button>
						<Button type="button" onClick={openCreateReportDialog}>
							<FilePlus2 className="me-2 h-4 w-4" />
							إنشاء تقرير
						</Button>
						<Button type="button" variant="outline" onClick={openCreateLetterDialog}>
							<FilePlus2 className="me-2 h-4 w-4" />
							إنشاء خطاب
						</Button>
					</div>
				</CardHeader>
			</Card>

			<div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
				<Card className="overflow-hidden">
					<CardHeader className={cn("pb-3", activityTextAlignClass)}>
						<CardTitle className="text-base">المشاريع</CardTitle>
					</CardHeader>
					<CardContent className="min-h-0">
						{loadingProjects ? (
							<div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
								<Spinner className="h-4 w-4 text-muted-foreground" />
								جاري تحميل المشاريع...
							</div>
						) : filteredProjects.length === 0 ? (
							<div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
								لا توجد مشاريع مطابقة لهذا الفلتر.
							</div>
						) : (
							<div
								className={cn(
									activityPanelScrollHeightClass,
									activityPanelScrollContainerClass,
									"activity-scrollbar-right pe-2"
								)}
							>
								<div dir="rtl" className="grid gap-3 text-right md:grid-cols-2">
									{filteredProjects.map((summary) => (
										<button
											type="button"
											key={summary.id}
											onClick={() => setSelectedProjectId(summary.id)}
											className={cn(
												"rounded-2xl border p-4 text-right transition hover:border-primary/40 hover:bg-muted/40",
												selectedProjectId === summary.id
													? "border-primary/50 bg-primary/5 shadow-sm"
													: "border-border/60 bg-background"
											)}
										>
											<div className="flex items-start justify-between gap-3">
												<div className={cn("min-w-0 flex-1 space-y-1", activityTextAlignClass)}>
													<h3 className="break-words text-sm font-semibold text-foreground">
														{summary.name}
													</h3>
													<p className="text-xs text-muted-foreground">
														{summary.clientName || "بدون عميل محدد"}
													</p>
												</div>
												<div className="shrink-0 self-start">
													<StatusBadge status={formatStatus(summary.status)} />
												</div>
											</div>
											<div className={cn("mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2", activityTextAlignClass)}>
												<div className={cn("rounded-xl border border-border/50 bg-muted/20 px-3 py-2", activityTextAlignClass)}>
													<p>آخر تحديث</p>
													<p className="mt-1 font-medium text-foreground">{formatDate(summary.lastActivityAt || summary.lastUpdatedAt)}</p>
												</div>
												<div className={cn("rounded-xl border border-border/50 bg-muted/20 px-3 py-2", activityTextAlignClass)}>
													<p>الملاحظات</p>
													<p className="mt-1 font-medium text-foreground">{summary.noteCount}</p>
												</div>
												<div className={cn("rounded-xl border border-border/50 bg-muted/20 px-3 py-2", activityTextAlignClass)}>
													<p>التقارير</p>
													<p className="mt-1 font-medium text-foreground">{summary.reportCount}</p>
												</div>
												<div className={cn("rounded-xl border border-border/50 bg-muted/20 px-3 py-2", activityTextAlignClass)}>
													<p>المهام الحرجة</p>
													<p className="mt-1 font-medium text-foreground">
														{summary.overdueTaskCount} متأخر | {summary.clientActionTaskCount} عميل
													</p>
												</div>
											</div>
											<div className={cn("mt-3 rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground", activityTextAlignClass)}>
												{summary.lastNote ? truncate(summary.lastNote.content) : "لا توجد ملاحظات بعد"}
											</div>
											{summary.pendingApprovalCount > 0 && (
												<div className="mt-3 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
													{summary.pendingApprovalCount} تقرير بانتظار المراجعة
												</div>
											)}
										</button>
									))}
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="overflow-hidden">
					<CardHeader className={cn("border-b border-border/60", activityTextAlignClass)}>
						<CardTitle className="text-base">
							{selectedSummary ? selectedSummary.name : "تفاصيل النشاط"}
						</CardTitle>
					</CardHeader>
					<CardContent className="min-h-0 p-0">
						{loadingDetails ? (
							<div className="flex min-h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" />
								جاري تحميل تفاصيل المشروع...
							</div>
						) : !projectDetails ? (
							<div className="px-6 py-10" />
						) : (
							<div
								className={cn(
									activityPanelScrollHeightClass,
									activityPanelScrollContainerClass,
									"activity-scrollbar-right"
								)}
							>
								<div dir="rtl" className={cn("space-y-5 px-6 py-6 text-right", activityTextAlignClass)}>
									<div className="grid gap-3 sm:grid-cols-2 [&>div]:rounded-xl [&>div]:border [&>div]:border-zinc-200 [&>div]:bg-zinc-100/85 [&>div]:px-4 [&>div]:py-3 dark:[&>div]:border-[#7f6c47]/24 dark:[&>div]:bg-[#211a14] [&>div_p:last-child]:font-medium [&>div_p:last-child]:text-zinc-900 dark:[&>div_p:last-child]:text-[#f4ead8]">
										<div className={cn("rounded-2xl border border-border/60 bg-muted/20 p-4", activityTextAlignClass)}>
											<p className="text-xs text-muted-foreground">العميل</p>
											<p className="mt-1 font-medium">
												{projectDetails.project.clientName || "غير محدد"}
											</p>
										</div>
										<div className={cn("rounded-2xl border border-border/60 bg-muted/20 p-4", activityTextAlignClass)}>
											<p className="text-xs text-muted-foreground">آخر نشاط</p>
											<p className="mt-1 font-medium">
												{formatDate(projectDetails.project.lastActivityAt || projectDetails.project.lastUpdatedAt)}
											</p>
										</div>
										<div className={cn("rounded-2xl border border-border/60 bg-muted/20 p-4", activityTextAlignClass)}>
											<p className="text-xs text-muted-foreground">الفريق</p>
											<p className="mt-1 font-medium">
												{projectDetails.project.teamMembers.map((member) => member.name || member.email).join("، ") || "غير محدد"}
											</p>
										</div>
										<div className={cn("rounded-2xl border border-border/60 bg-muted/20 p-4", activityTextAlignClass)}>
											<p className="text-xs text-muted-foreground">الوصف</p>
											<p className="mt-1 font-medium text-sm text-muted-foreground">
												{projectDetails.project.description || "لا يوجد وصف"}
											</p>
										</div>
									</div>

									<section className={cn("space-y-3", activityTextAlignClass)}>
										<div className="flex items-center justify-between">
											<h3 className="text-sm font-semibold">النشاط المرتبط بالمشروع</h3>
											<Badge variant="outline">{projectDetails.activities.length}</Badge>
										</div>
										<div className="space-y-3">
											{projectDetails.activities.length === 0 ? (
												<div className="rounded-xl border border-dashed border-border/60 px-4 py-4 text-sm text-muted-foreground">
													لا توجد عناصر نشاط بعد.
												</div>
											) : (
												projectDetails.activities.map((activity) => (
													<div key={activity.id} className={cn("rounded-2xl border border-border/60 p-4", activityTextAlignClass)}>
														<div className="flex items-start justify-between gap-3">
															<div className={cn("space-y-1", activityTextAlignClass)}>
																<p className="text-sm font-semibold">{activity.title}</p>
																<p className="text-sm text-muted-foreground">{truncate(activity.description, 160)}</p>
															</div>
															<span className={cn("rounded-full border px-2 py-1 text-[11px] font-medium", priorityClasses[activity.priority])}>
																{activity.priority === "high" ? "عالي" : activity.priority === "medium" ? "متوسط" : "منخفض"}
															</span>
														</div>
														<p className="mt-3 text-xs text-muted-foreground">{formatDate(activity.occurredAt)}</p>
													</div>
												))
											)}
										</div>
									</section>

									<section className={cn("space-y-3", activityTextAlignClass)}>
										<div className="flex items-center justify-between">
											<h3 className="text-sm font-semibold">الملاحظات</h3>
											<Button type="button" variant="outline" size="sm" onClick={openAddNoteDialog}>
												<MessageSquarePlus className="me-2 h-4 w-4" />
												إضافة ملاحظة
											</Button>
										</div>
										<div className="space-y-3">
											{projectDetails.notes.length === 0 ? (
												<div className="rounded-xl border border-dashed border-border/60 px-4 py-4 text-sm text-muted-foreground">
													لا توجد ملاحظات بعد
												</div>
											) : (
												projectDetails.notes.map((note) => (
													<div key={note.id} className={cn("rounded-2xl border border-border/60 p-4", activityTextAlignClass)}>
														<p className="text-sm leading-7 text-foreground">{note.content}</p>
														<div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
															<span>{note.authorName}</span>
															<span>{formatDate(note.createdAt)}</span>
														</div>
													</div>
												))
											)}
										</div>
									</section>

									<section className={cn("space-y-3", activityTextAlignClass)}>
										<div className="flex items-center justify-between">
											<h3 className="text-sm font-semibold">الخطابات</h3>
											<Button type="button" size="sm" onClick={openCreateLetterDialog}>
												<FilePlus2 className="me-2 h-4 w-4" />
												إنشاء خطاب
											</Button>
										</div>
										<div className="space-y-3">
											{projectDetails.letters.length === 0 ? (
												<div className="rounded-xl border border-dashed border-border/60 px-4 py-4 text-sm text-muted-foreground">
													لا توجد خطابات مرتبطة بهذا المشروع بعد.
												</div>
											) : (
												projectDetails.letters.map((letter) => (
													<div
														key={letter.id}
														className={cn(
															"w-full rounded-2xl border border-border/60 bg-muted/10 px-4 py-4 transition hover:border-border/90 hover:bg-muted/15",
															activityTextAlignClass
														)}
													>
														<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
															<div className={cn("min-w-0 flex-1 space-y-3", activityTextAlignClass)}>
																<div className="flex flex-wrap items-center gap-2">
																	<h4 className="min-w-0 text-sm font-semibold text-foreground">{letter.subject}</h4>
																	<Badge
																		className={cn(
																			letterStatusClasses[letter.status],
																			letter.status === "ready" &&
																				"bg-sky-50 !text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:!text-sky-200 dark:border-sky-800"
																		)}
																	>
																		{letterStatusLabel[letter.status]}
																	</Badge>
																</div>
																<div className={cn("grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4", activityTextAlignClass)}>
																	<div className="space-y-1">
																		<p>الجهة الموجه لها</p>
																		<p className="text-sm text-foreground">{letter.recipientName}</p>
																	</div>
																	<div className="space-y-1">
																		<p>التاريخ</p>
																		<p className="text-sm text-foreground">{formatDate(letter.letterDate || letter.createdAt)}</p>
																	</div>
																	<div className="space-y-1">
																		<p>الحالة</p>
																		<p className="text-sm text-foreground">{letterStatusLabel[letter.status]}</p>
																	</div>
																	<div className="space-y-1">
																		<p>الكاتب</p>
																		<p className="text-sm text-foreground">{letter.authorName}</p>
																	</div>
																</div>
															</div>
															<div className="flex flex-wrap justify-start gap-2 lg:justify-end">
																<Button type="button" variant="outline" size="sm" onClick={() => openViewLetterDialog(letter)}>
																	عرض
																</Button>
																{letter.canEdit && (
																	<Button type="button" size="sm" onClick={() => openEditLetterDialog(letter)}>
																		تعديل
																	</Button>
																)}
															</div>
														</div>
													</div>
												))
											)}
										</div>
									</section>

									<section className={cn("space-y-3", activityTextAlignClass)}>
										<div className="flex items-center justify-between">
											<h3 className="text-sm font-semibold">التقارير</h3>
											<Button type="button" size="sm" onClick={openCreateReportDialog}>
												<FilePlus2 className="me-2 h-4 w-4" />
												إنشاء تقرير
											</Button>
										</div>
										<div className="space-y-3">
											{projectDetails.reports.length === 0 ? (
												<div className="rounded-xl border border-dashed border-border/60 px-4 py-4 text-sm text-muted-foreground">
													لا توجد تقارير مرتبطة بهذا المشروع بعد.
												</div>
											) : (
												projectDetails.reports.map((report) => (
													<div
														key={report.id}
														className={cn(
															"w-full rounded-2xl border border-border/60 bg-muted/10 px-4 py-4 transition hover:border-border/90 hover:bg-muted/15",
															activityTextAlignClass
														)}
													>
														<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
															<div className={cn("min-w-0 flex-1 space-y-3", activityTextAlignClass)}>
																<div className="flex flex-wrap items-center gap-2">
																	<h4 className="min-w-0 text-sm font-semibold text-foreground">{report.title}</h4>
																	<Badge
																		className={cn(
																			reportStatusClasses[report.status],
																			report.status === "sent" &&
																				"bg-emerald-50 !text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:!text-emerald-200 dark:border-emerald-800",
																			report.status === "draft" &&
																				"bg-neutral-100 !text-neutral-800 border-neutral-300 dark:bg-neutral-800 dark:!text-neutral-100 dark:border-neutral-700"
																		)}
																	>
																		{reportStatusLabel[report.status]}
																	</Badge>
																</div>
																<div
																	className={cn(
																		"grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4",
																		activityTextAlignClass
																	)}
																>
																	<div className="space-y-1">
																		<p>نوع التقرير</p>
																		<p className="text-sm text-foreground">{reportTypeLabel[report.reportType]}</p>
																	</div>
																	<div className="space-y-1">
																		<p>حالة التقرير</p>
																		<p className="text-sm text-foreground">{reportStatusLabel[report.status]}</p>
																	</div>
																	<div className="space-y-1">
																		<p>تاريخ الإنشاء</p>
																		<p className="text-sm text-foreground">{formatDate(report.createdAt)}</p>
																	</div>
																	<div className="space-y-1">
																		<p>كاتب التقرير</p>
																		<p className="text-sm text-foreground">{report.authorName}</p>
																	</div>
																</div>
															</div>
															<div className="flex flex-wrap justify-start gap-2 lg:justify-end">
																<Button type="button" variant="outline" size="sm" onClick={() => openViewReportDialog(report)}>
																	عرض
																</Button>
																{report.canEdit && (
																	<Button type="button" size="sm" onClick={() => openEditReportDialog(report)}>
																		تعديل
																	</Button>
																)}
															</div>
														</div>
													</div>
												))
											)}
										</div>
									</section>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<Dialog open={!!viewingLetterId} onOpenChange={(open) => !open && setViewingLetterId(null)}>
				<DialogContent
					overlayClassName={activityModalOverlayClassName}
					className={cn(reportModalContentClassName, "sm:max-w-4xl")}
				>
					<div dir={activityDirection} className={cn("overflow-hidden", activityTextAlignClass)}>
						<DialogHeader className={reportModalHeaderClassName}>
							<div>
								<DialogTitle className="text-xl font-semibold text-foreground">
									{viewedLetter?.subject || "عرض الخطاب"}
								</DialogTitle>
							</div>
							<Button
								type="button"
								variant="ghost"
								onClick={() => setViewingLetterId(null)}
								className={reportModalCloseButtonClassName}
							>
								X
							</Button>
						</DialogHeader>

						{viewedLetter ? (
							<div className="space-y-5 px-6 py-6">
								<div className={cn(activityModalCardClassName, "space-y-5")}>
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => handleOpenLetterPrint(viewedLetter)}
											className={activityModalCancelButtonClassName}
										>
											<FileText className="me-2 h-4 w-4" />
											طباعة / حفظ PDF
										</Button>
										{viewedLetter.canEdit && (
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => handleSendLetter(viewedLetter)}
												disabled={actioningLetterId === viewedLetter.id}
												className={activityModalCancelButtonClassName}
											>
												{actioningLetterId === viewedLetter.id ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<>
														<Send className="me-2 h-4 w-4" />
														تعديل للإرسال
													</>
												)}
											</Button>
										)}
									</div>

									<div className="grid gap-3 sm:grid-cols-2">
										<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
											<p className="text-xs text-muted-foreground">اسم المشروع</p>
											<p className="text-sm text-zinc-900 dark:text-[#f4ead8]">{projectDetails?.project.name || "غير متوفر"}</p>
										</div>
										<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
											<p className="text-xs text-muted-foreground">الجهة الموجه لها</p>
											<p className="text-sm text-zinc-900 dark:text-[#f4ead8]">{viewedLetter.recipientName}</p>
										</div>
										<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
											<p className="text-xs text-muted-foreground">الموضوع</p>
											<p className="text-sm text-zinc-900 dark:text-[#f4ead8]">{viewedLetter.subject}</p>
										</div>
										<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
											<p className="text-xs text-muted-foreground">التاريخ</p>
											<p className="text-sm text-zinc-900 dark:text-[#f4ead8]">
												{formatDate(viewedLetter.letterDate || viewedLetter.createdAt)}
											</p>
										</div>
										<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
											<p className="text-xs text-muted-foreground">الحالة</p>
											<p className="text-sm text-zinc-900 dark:text-[#f4ead8]">{letterStatusLabel[viewedLetter.status]}</p>
										</div>
										<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
											<p className="text-xs text-muted-foreground">الكاتب</p>
											<p className="text-sm text-zinc-900 dark:text-[#f4ead8]">{viewedLetter.authorName}</p>
										</div>
									</div>

									<div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-100/85 px-5 py-5 text-zinc-700 dark:border-[#8b744a]/20 dark:bg-[#211a14] dark:text-stone-200 [&_p]:text-zinc-700 dark:[&_p]:text-stone-200 [&_section:last-child_p]:text-zinc-900 dark:[&_section:last-child_p]:text-stone-100">
										<p className="text-base">تحية طيبة وبعد،</p>
										<p className="whitespace-pre-line text-sm leading-8">
											{viewedLetter.body || "لا يوجد نص مضاف لهذا الخطاب."}
										</p>
										<section className="space-y-1 pt-2">
											<p className="text-sm">وتفضلوا بقبول فائق التحية والتقدير،</p>
											<p className="text-sm">فريق شركة كرافت</p>
										</section>
									</div>

									{viewedLetter.attachments.length > 0 && (
										<div className={cn(activityModalCardClassName, "space-y-3")}>
											<p className="text-sm font-medium text-foreground">المرفقات</p>
											<div className="flex flex-wrap gap-2">
												{viewedLetter.attachments.map((attachment, index) => (
													<a
														key={`${attachment.url}-${index}`}
														href={attachment.url}
														target="_blank"
														rel="noreferrer"
														className="rounded-xl border border-zinc-200 bg-zinc-100/80 px-3 py-2 text-xs font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-200/80 dark:border-[#8b744a]/28 dark:bg-[#221b15] dark:text-[#f2e3c4] dark:hover:border-[#caa96a]/45 dark:hover:bg-[#2c2117]"
													>
														{attachment.name || `مرفق ${index + 1}`}
													</a>
												))}
											</div>
										</div>
									)}
								</div>
							</div>
						) : (
							<div className="px-6 py-8 text-sm text-zinc-500 dark:text-[#b8b2a3]">تعذر تحميل بيانات الخطاب المحدد.</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={!!viewingReportId} onOpenChange={(open) => !open && setViewingReportId(null)}>
				<DialogContent
					overlayClassName={activityModalOverlayClassName}
					className={cn(reportModalContentClassName, "sm:max-w-5xl")}
				>
					<div dir={activityDirection} className={cn("overflow-hidden", activityTextAlignClass)}>
						<DialogHeader className={reportModalHeaderClassName}>
							<div>
								<DialogTitle className="text-xl font-semibold text-foreground">
									{viewedReport?.title || "عرض التقرير"}
								</DialogTitle>
							</div>
							<Button
								type="button"
								variant="ghost"
								onClick={() => setViewingReportId(null)}
								className={reportModalCloseButtonClassName}
							>
								X
							</Button>
						</DialogHeader>

						{viewedReport ? (
							<div className="space-y-5 px-6 py-6">
								<div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
									<div className={cn(activityModalCardClassName, "space-y-5")}>
										<div className="space-y-3">
											<h3 className="text-2xl font-semibold text-zinc-950 dark:text-[#f4ead8]">{viewedReport.title}</h3>
										</div>

										<div className="grid gap-3 sm:grid-cols-2 [&>div]:rounded-xl [&>div]:border [&>div]:border-zinc-200 [&>div]:bg-zinc-100/85 [&>div]:px-4 [&>div]:py-3 dark:[&>div]:border-[#7f6c47]/24 dark:[&>div]:bg-[#211a14] [&>div_p:last-child]:font-medium [&>div_p:last-child]:text-zinc-900 dark:[&>div_p:last-child]:text-[#f4ead8]">
											<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
												<p className="text-xs text-muted-foreground">اسم المشروع</p>
												<p className="text-sm text-zinc-900 dark:text-stone-100">{projectDetails?.project.name || "غير متوفر"}</p>
											</div>
											<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
												<p className="text-xs text-muted-foreground">نوع التقرير</p>
												<p className="text-sm text-zinc-900 dark:text-stone-100">{reportTypeLabel[viewedReport.reportType]}</p>
											</div>
											<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
												<p className="text-xs text-muted-foreground">التاريخ</p>
												<p className="text-sm text-zinc-900 dark:text-stone-100">{formatDate(viewedReport.createdAt)}</p>
											</div>
											<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
												<p className="text-xs text-muted-foreground">إعداد</p>
												<p className="text-sm text-zinc-900 dark:text-stone-100">{viewedReport.authorName}</p>
											</div>
										</div>

										<div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-100/85 px-5 py-5 text-zinc-700 dark:border-[#8b744a]/20 dark:bg-[#211a14] dark:text-stone-200 [&_h4]:text-zinc-950 dark:[&_h4]:text-stone-100 [&_p]:text-zinc-700 dark:[&_p]:text-stone-200 [&_section:last-child_p]:text-zinc-900 dark:[&_section:last-child_p]:text-stone-100">
											<p className="text-base text-zinc-900 dark:text-stone-100">السلام عليكم ورحمة الله وبركاته،</p>
											<p className="text-sm leading-8 text-zinc-700 dark:text-stone-200">
												نقدم لكم هذا التقرير الذي يعرض أحدث مستجدات المشروع، موضحًا أبرز ما تم إنجازه من أعمال، والنتائج المحققة حتى تاريخ إعداد هذا التقرير، وذلك في إطار الحرص على تعزيز الشفافية ومتابعة سير العمل بكفاءة وفعالية.
											</p>

											<section className="space-y-2">
												<h4 className="text-sm font-semibold text-zinc-900 dark:text-stone-100">ملخص التقرير</h4>
												<p className="whitespace-pre-line text-sm leading-8 text-zinc-700 dark:text-stone-200">
													{viewedReport.summary || "لا يوجد ملخص لهذا التقرير."}
												</p>
											</section>

											<section className="space-y-2">
												<h4 className="text-sm font-semibold text-zinc-900 dark:text-stone-100">متن التقرير</h4>
												<p className="whitespace-pre-line text-sm leading-8 text-zinc-700 dark:text-stone-200">
													{viewedReport.details}
												</p>
												{viewedReport.workDetails && (
													<p className="whitespace-pre-line text-sm leading-8 text-zinc-700 dark:text-stone-200">
														{viewedReport.workDetails}
													</p>
												)}
											</section>

											<section className="space-y-1 pt-2">
												<p className="text-sm text-zinc-900 dark:text-stone-100">أطيب التحيات،</p>
												<p className="text-sm text-zinc-900 dark:text-stone-100">فريق شركة كرافت</p>
											</section>
										</div>
									</div>

									<div className="space-y-4">
										<div className={cn(reportModalCardClassName, "space-y-4")}>
											<div className="flex flex-wrap gap-2">
												{(viewedReport.status === "approved" || viewedReport.status === "sent") && (
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => handleOpenReportPdf(viewedReport)}
														className={reportModalCancelButtonClassName}
													>
														<FileText className="me-2 h-4 w-4" />
														طباعة / حفظ PDF
													</Button>
												)}
												{viewedReport.canSendToClient && (
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => handleSendReport(viewedReport)}
														disabled={actioningReportId === viewedReport.id}
														className={reportModalCancelButtonClassName}
													>
														<Send className="me-2 h-4 w-4" />
														إرسال
													</Button>
												)}
												{viewedReport.canApprove && (
													<>
														<Button
															type="button"
															size="sm"
															onClick={() =>
																setApprovalDialog({
																	reportId: viewedReport.id,
																	projectId: viewedReport.projectId,
																	decision: "approve",
																	reason: "",
																})
															}
															disabled={actioningReportId === viewedReport.id}
															className={reportModalPrimaryButtonClassName}
														>
															{actioningReportId === viewedReport.id ? (
																<Loader2 className="h-4 w-4 animate-spin" />
															) : (
																"اعتماد"
															)}
														</Button>
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={() =>
																setApprovalDialog({
																	reportId: viewedReport.id,
																	projectId: viewedReport.projectId,
																	decision: "reject",
																	reason: viewedReport.rejectionReason || "",
																})
															}
															className={reportModalCancelButtonClassName}
														>
															رفض
														</Button>
													</>
												)}
											</div>

											<div className="grid gap-3 sm:grid-cols-2">
												<div className={reportModalMetaCardClassName}>
													<p className="text-xs text-muted-foreground">حالة التقرير</p>
													<p className="mt-1 text-sm font-medium text-zinc-900 dark:text-[#f4ead8]">{reportStatusLabel[viewedReport.status]}</p>
												</div>
												<div className={reportModalMetaCardClassName}>
													<p className="text-xs text-muted-foreground">حالة PDF</p>
													<p className="mt-1 text-sm font-medium text-zinc-900 dark:text-[#f4ead8]">{pdfStatusLabel[viewedReport.pdfStatus]}</p>
												</div>
												<div className={reportModalMetaCardClassName}>
													<p className="text-xs text-muted-foreground">إرسال البريد</p>
													<p className="mt-1 text-sm font-medium text-zinc-900 dark:text-[#f4ead8]">{deliveryStatusLabel[viewedReport.emailStatus]}</p>
												</div>
												<div className={reportModalMetaCardClassName}>
													<p className="text-xs text-muted-foreground">إرسال الواتساب</p>
													<p className="mt-1 text-sm font-medium text-zinc-900 dark:text-[#f4ead8]">{deliveryStatusLabel[viewedReport.whatsappStatus]}</p>
												</div>
											</div>
										</div>

										<div className={cn(reportModalCardClassName, "space-y-4")}>
											<div className="space-y-2">
												<p className="text-sm font-medium text-foreground">معلومات الإرسال</p>
												<p className={reportModalSubtleTextClassName}>
													{viewedReport.recipients.length > 0
														? viewedReport.recipients
																.map((recipient) => `${recipient.name}${recipient.channel && recipient.channel !== "both" ? ` - ${recipient.channel === "email" ? "بريد" : recipient.channel === "whatsapp" ? "واتساب" : "بدون إرسال"}` : ""}`)
																.join("، ")
														: "لا يوجد مستلمون محددون لهذا التقرير."}
												</p>
											</div>

											{viewedReport.permissions.length > 0 && (
												<div className="space-y-2">
													<p className="text-sm font-medium text-foreground">صلاحيات التقرير</p>
													<p className={reportModalSubtleTextClassName}>
														{viewedReport.permissions
															.map((permission) => `${permission.userName} (${permission.accessLevel === "edit" ? "تعديل" : "مشاهدة"})`)
															.join("، ")}
													</p>
												</div>
											)}

											{viewedReport.attachments.length > 0 && (
												<div className="space-y-2">
													<p className="text-sm font-medium text-foreground">المرفقات</p>
													<div className="flex flex-wrap gap-2">
														{viewedReport.attachments.map((attachment, index) => (
															<a
																key={`${attachment.url}-${index}`}
																href={attachment.url}
																target="_blank"
																rel="noreferrer"
																className="rounded-xl border border-zinc-200 bg-zinc-100/80 px-3 py-2 text-xs font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-200/80 dark:border-[#8b744a]/28 dark:bg-[#221b15] dark:text-[#f2e3c4] dark:hover:border-[#caa96a]/45 dark:hover:bg-[#2c2117]"
															>
																{attachment.name || `مرفق ${index + 1}`}
															</a>
														))}
													</div>
												</div>
											)}
										</div>

										{viewedReport.rejectionReason && (
											<div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-4 text-sm text-rose-900 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200">
												سبب الرفض: {viewedReport.rejectionReason}
											</div>
										)}

										{viewedReport.lastDeliveryError && (
											<div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
												{viewedReport.lastDeliveryError}
											</div>
										)}
									</div>
								</div>
							</div>
						) : (
							<div className="px-6 py-8 text-sm text-zinc-500 dark:text-[#b8b2a3]">تعذر تحميل بيانات التقرير المحدد.</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
				<DialogContent
					overlayClassName={activityModalOverlayClassName}
					className={cn(activityModalContentClassName, "sm:max-w-xl")}
				>
					<div dir={activityDirection} className={cn("overflow-hidden", activityTextAlignClass)}>
						<DialogHeader className={activityModalHeaderClassName}>
							<div>
								<DialogTitle className="text-xl font-semibold text-foreground">إضافة ملاحظة</DialogTitle>
							</div>
							<Button
								type="button"
								variant="ghost"
								onClick={() => setNoteDialogOpen(false)}
								className={activityModalCloseButtonClassName}
							>
								X
							</Button>
						</DialogHeader>
						<div className="space-y-5 px-6 py-6">
							<div className={cn(activityModalCardClassName, "space-y-4")}>
								<div className="space-y-2">
									<label className={activityModalLabelClassName}>المشروع</label>
									<Select value={noteProjectId} onValueChange={setNoteProjectId}>
										<SelectTrigger className={activityModalFieldClassName}>
											<SelectValue placeholder="اختر المشروع" />
										</SelectTrigger>
										<SelectContent className={activityModalSelectContentClassName}>
											{projects.map((project) => (
												<SelectItem key={project.id} value={project.id}>
													{project.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<label className={activityModalLabelClassName}>الملاحظة</label>
									<Textarea
										value={noteText}
										onChange={(event) => setNoteText(event.target.value)}
										placeholder="اكتب ملاحظة واضحة مرتبطة بالمشروع..."
										rows={6}
										className={cn(activityModalFieldClassName, "min-h-[150px] resize-y")}
									/>
								</div>
							</div>
						</div>
						<DialogFooter className={activityModalFooterClassName}>
							<Button
								type="button"
								variant="outline"
								onClick={() => setNoteDialogOpen(false)}
								className={activityModalCancelButtonClassName}
							>
								إلغاء
							</Button>
							<Button
								type="button"
								onClick={handleNoteSubmit}
								disabled={submittingNote}
								className={activityModalPrimaryButtonClassName}
							>
								{submittingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ الملاحظة"}
							</Button>
						</DialogFooter>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={letterDialogOpen} onOpenChange={setLetterDialogOpen}>
				<DialogContent
					overlayClassName={activityModalOverlayClassName}
					className={cn(activityModalContentClassName, "sm:max-w-3xl")}
				>
					<div dir={activityDirection} className={cn("overflow-hidden", activityTextAlignClass)}>
						<DialogHeader className={activityModalHeaderClassName}>
							<div>
								<DialogTitle className="text-xl font-semibold text-foreground">
									{letterForm.letterId ? "تعديل خطاب" : "إنشاء خطاب"}
								</DialogTitle>
							</div>
							<Button
								type="button"
								variant="ghost"
								onClick={closeLetterDialog}
								className={activityModalCloseButtonClassName}
							>
								X
							</Button>
						</DialogHeader>

						<div className="space-y-5 px-6 py-6">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<label className={activityModalLabelClassName}>المشروع</label>
									<Select
										value={letterForm.projectId}
										onValueChange={(value) =>
											setLetterForm((current) => ({ ...current, projectId: value }))
										}
									>
										<SelectTrigger className={activityModalFieldClassName}>
											<SelectValue placeholder="اختر المشروع" />
										</SelectTrigger>
										<SelectContent className={activityModalSelectContentClassName}>
											{projects.map((project) => (
												<SelectItem key={project.id} value={project.id}>
													{project.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<label className={activityModalLabelClassName}>التاريخ</label>
									<Input
										type="date"
										value={letterForm.letterDate}
										onChange={(event) =>
											setLetterForm((current) => ({
												...current,
												letterDate: event.target.value,
											}))
										}
										className={activityModalFieldClassName}
									/>
								</div>

								<div className="space-y-2">
									<label className={activityModalLabelClassName}>الجهة / الشخص الموجه له الخطاب</label>
									<Input
										value={letterForm.recipientName}
										onChange={(event) =>
											setLetterForm((current) => ({
												...current,
												recipientName: event.target.value,
											}))
										}
										placeholder="اسم الجهة أو الشخص"
										className={activityModalFieldClassName}
									/>
								</div>

								<div className="space-y-2">
									<label className={activityModalLabelClassName}>البريد الإلكتروني للمستلم</label>
									<Input
										value={letterForm.recipientEmail}
										onChange={(event) =>
											setLetterForm((current) => ({
												...current,
												recipientEmail: event.target.value,
											}))
										}
										placeholder="name@example.com"
										type="email"
										className={activityModalFieldClassName}
									/>
								</div>

								<div className="space-y-2">
									<label className={activityModalLabelClassName}>عنوان الخطاب أو الموضوع</label>
									<Input
										value={letterForm.subject}
										onChange={(event) =>
											setLetterForm((current) => ({
												...current,
												subject: event.target.value,
											}))
										}
										placeholder="مثال: خطاب طلب اعتماد"
										className={activityModalFieldClassName}
									/>
								</div>

								<div className="space-y-2 md:col-span-2">
									<label className={activityModalLabelClassName}>نص الخطاب</label>
									<Textarea
										value={letterForm.body}
										onChange={(event) =>
											setLetterForm((current) => ({ ...current, body: event.target.value }))
										}
										rows={10}
										placeholder="اكتب نص الخطاب الرسمي هنا..."
										className={cn(activityModalFieldClassName, "min-h-[220px] resize-y")}
									/>
								</div>

								<div className={cn(activityModalCardClassName, "space-y-3 md:col-span-2")}>
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div>
											<p className="text-sm font-medium text-foreground">المرفقات</p>
										</div>
										<label className={activityModalUploadTriggerClassName}>
											<UploadCloud className="me-2 h-4 w-4" />
											{uploadingLetterAttachments ? "جاري الرفع..." : "رفع مرفقات"}
											<input
												type="file"
												multiple
												className="hidden"
												onChange={handleLetterAttachmentUpload}
											/>
										</label>
									</div>

									<div className="space-y-2">
										{letterForm.attachments.length === 0 ? (
											<div className={activityModalEmptySurfaceClassName}>
												لا توجد مرفقات بعد.
											</div>
										) : (
											letterForm.attachments.map((attachment, index) => (
												<div
													key={`${attachment.url}-${index}`}
													className={activityModalListItemClassName}
												>
													<div className="min-w-0">
														<p className="truncate font-medium text-foreground">
															{attachment.name || attachment.url}
														</p>
														<p className="truncate text-xs text-muted-foreground">{attachment.url}</p>
													</div>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className={activityModalGhostActionClassName}
														onClick={() =>
															setLetterForm((current) => ({
																...current,
																attachments: current.attachments.filter(
																	(_, currentIndex) => currentIndex !== index
																),
															}))
														}
													>
														حذف
													</Button>
												</div>
											))
										)}
									</div>
								</div>
							</div>
						</div>

						<DialogFooter className={activityModalFooterClassName}>
							<Button
								type="button"
								variant="outline"
								onClick={closeLetterDialog}
								className={activityModalCancelButtonClassName}
							>
								إلغاء
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => void handleLetterAction("send")}
								disabled={submittingLetter || uploadingLetterAttachments}
								className={activityModalCancelButtonClassName}
							>
								{submittingLetter ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال الخطاب"}
							</Button>
							<Button
								type="button"
								onClick={() => void handleLetterAction("save")}
								disabled={submittingLetter || uploadingLetterAttachments}
								className={activityModalPrimaryButtonClassName}
							>
								{submittingLetter ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : letterForm.letterId ? (
									"حفظ التعديلات"
								) : (
									"إنشاء الخطاب"
								)}
							</Button>
						</DialogFooter>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
				<DialogContent
					overlayClassName={activityModalOverlayClassName}
					className={cn(activityModalContentClassName, "sm:max-w-4xl")}
				>
					<div dir={activityDirection} className={cn("overflow-hidden", activityTextAlignClass)}>
						<DialogHeader className={activityModalHeaderClassName}>
							<div>
								<DialogTitle className="text-xl font-semibold text-foreground">
									{reportForm.reportId ? "تعديل تقرير" : "إنشاء تقرير"}
								</DialogTitle>
							</div>
							<Button
								type="button"
								variant="ghost"
								onClick={() => setReportDialogOpen(false)}
								className={activityModalCloseButtonClassName}
							>
								X
							</Button>
						</DialogHeader>

					<div className="space-y-5 px-6 py-6">
					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<label className={activityModalLabelClassName}>اسم المشروع</label>
							<Select
								value={reportForm.projectId}
								onValueChange={(value) => setReportForm((current) => ({ ...current, projectId: value }))}
							>
								<SelectTrigger className={activityModalFieldClassName}>
									<SelectValue placeholder="اختر المشروع" />
								</SelectTrigger>
								<SelectContent className={activityModalSelectContentClassName}>
									{projects.map((project) => (
										<SelectItem key={project.id} value={project.id}>
											{project.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<label className={activityModalLabelClassName}>نوع التقرير</label>
							<Select
								value={reportForm.reportType}
								onValueChange={(value) =>
									setReportForm((current) => ({
										...current,
										reportType: value as ReportFormState["reportType"],
									}))
								}
							>
								<SelectTrigger className={activityModalFieldClassName}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent className={activityModalSelectContentClassName}>
									<SelectItem value="client">تقرير للعميل</SelectItem>
									<SelectItem value="internal">تقرير داخلي</SelectItem>
									<SelectItem value="shared">تقرير مشترك بين الأدمن والمهندسين</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2 md:col-span-2">
							<div className={cn(activityModalCardClassName, "space-y-4")}>
								<div>
									<p className="text-sm font-medium text-foreground">خيارات الإرسال</p>
								</div>
								<Select
									value={reportForm.deliveryOption}
									onValueChange={(value) =>
										setReportForm((current) => ({
											...current,
											deliveryOption: value as ReportDeliveryOption,
										}))
									}
								>
									<SelectTrigger className={activityModalFieldClassName}>
										<SelectValue />
									</SelectTrigger>
								<SelectContent className={activityModalSelectContentClassName}>
									<SelectItem value="draft">{deliveryOptionLabel.draft}</SelectItem>
									<SelectItem value="email">{deliveryOptionLabel.email}</SelectItem>
								</SelectContent>
							</Select>
						</div>
						</div>
						<div className="space-y-2 md:col-span-2">
							<label className={activityModalLabelClassName}>عنوان التقرير</label>
							<Input
								value={reportForm.title}
								onChange={(event) =>
									setReportForm((current) => ({ ...current, title: event.target.value }))
								}
								placeholder="مثال: تقرير تقدم الأعمال للأسبوع الحالي"
								className={activityModalFieldClassName}
							/>
						</div>
						<div className="space-y-2 md:col-span-2">
							<label className={activityModalLabelClassName}>وصف / ملخص</label>
							<Textarea
								value={reportForm.summary}
								onChange={(event) =>
									setReportForm((current) => ({ ...current, summary: event.target.value }))
								}
								rows={3}
								placeholder="ملخص تنفيذي موجز للتقرير"
								className={cn(activityModalFieldClassName, "min-h-[110px] resize-y")}
							/>
						</div>
						<div className="space-y-2 md:col-span-2">
							<label className={activityModalLabelClassName}>تفاصيل الأعمال أو الملاحظات</label>
							<Textarea
								value={reportForm.details}
								onChange={(event) =>
									setReportForm((current) => ({ ...current, details: event.target.value }))
								}
								rows={6}
								placeholder="اكتب التفاصيل الرسمية للتقرير"
								className={cn(activityModalFieldClassName, "min-h-[150px] resize-y")}
							/>
						</div>
						<div className="space-y-2 md:col-span-2">
							<label className={activityModalLabelClassName}>تفاصيل إضافية</label>
							<Textarea
								value={reportForm.workDetails}
								onChange={(event) =>
									setReportForm((current) => ({ ...current, workDetails: event.target.value }))
								}
								rows={4}
								placeholder="أي توضيحات أو أعمال منفذة أو ملاحظات داخلية"
								className={cn(activityModalFieldClassName, "min-h-[110px] resize-y")}
							/>
						</div>

						<div className={cn(activityModalCardClassName, "space-y-3 md:col-span-2")}>
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="text-sm font-medium text-foreground">الصور أو المرفقات</p>
								</div>
								<label className={activityModalUploadTriggerClassName}>
									<UploadCloud className="me-2 h-4 w-4" />
									{uploadingAttachments ? "جاري الرفع..." : "رفع مرفقات"}
									<input
										type="file"
										multiple
										className="hidden"
										onChange={handleAttachmentUpload}
									/>
								</label>
							</div>
							<div className="space-y-2">
								{reportForm.attachments.length === 0 ? (
									<div className={activityModalEmptySurfaceClassName}>
										لا توجد مرفقات بعد.
									</div>
								) : (
									reportForm.attachments.map((attachment, index) => (
										<div key={`${attachment.url}-${index}`} className={activityModalListItemClassName}>
											<div className="min-w-0">
												<p className="truncate font-medium text-foreground">{attachment.name || attachment.url}</p>
												<p className="truncate text-xs text-muted-foreground">{attachment.url}</p>
											</div>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className={activityModalGhostActionClassName}
												onClick={() =>
													setReportForm((current) => ({
														...current,
														attachments: current.attachments.filter((_, currentIndex) => currentIndex !== index),
													}))
												}
											>
												حذف
											</Button>
										</div>
									))
								)}
							</div>
						</div>

						<div className={cn(activityModalCardClassName, "space-y-3 md:col-span-2")}>
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-foreground">المستلمون</p>
								</div>
								<Button type="button" variant="outline" size="sm" onClick={addRecipient} className={activityModalSecondaryButtonClassName}>
									إضافة مستلم
								</Button>
							</div>
							<div className="space-y-3">
								{reportForm.recipients.map((recipient, index) => (
									<div key={`recipient-${index}`} className={cn(reportModalRowCardClassName, "md:grid-cols-4")}>
										<Input
											value={recipient.name}
											onChange={(event) => updateRecipient(index, "name", event.target.value)}
											placeholder="اسم المستلم"
											className={activityModalFieldClassName}
										/>
										<Input
											value={recipient.email || ""}
											onChange={(event) => updateRecipient(index, "email", event.target.value)}
											placeholder="Email"
											type="email"
											className={activityModalFieldClassName}
										/>
										<div
											role="button"
											tabIndex={0}
											onClick={openWhatsAppComingSoonDialog}
											onKeyDown={handleWhatsAppFieldKeyDown}
											className="relative"
											aria-label="ميزة الواتساب غير مفعلة حاليًا"
										>
											<Input
												value={recipient.phone || ""}
												readOnly
												placeholder="رقم الواتساب"
												className={cn(
													activityModalFieldClassName,
													"pointer-events-none cursor-not-allowed pe-24 opacity-70"
												)}
												aria-disabled="true"
											/>
											<Badge
												variant="secondary"
												className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 whitespace-nowrap"
											>
												قريبًا
											</Badge>
										</div>
										<div className="flex gap-2">
											<Select
												value="email"
												onValueChange={() => updateRecipient(index, "channel", "email")}
												disabled
											>
												<SelectTrigger className={activityModalFieldClassName}>
													<SelectValue />
												</SelectTrigger>
												<SelectContent className={activityModalSelectContentClassName}>
													<SelectItem value="email">البريد فقط</SelectItem>
												</SelectContent>
											</Select>
											<Button type="button" variant="ghost" onClick={() => removeRecipient(index)} className={reportModalGhostActionClassName}>
												حذف
											</Button>
										</div>
									</div>
								))}
							</div>
						</div>

						{isAdmin && reportForm.reportType !== "client" && (
							<div className={cn(activityModalCardClassName, "space-y-3 md:col-span-2")}>
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium text-foreground">صلاحيات التقرير</p>
									</div>
									<Button type="button" variant="outline" size="sm" onClick={addPermission} className={activityModalSecondaryButtonClassName}>
										إضافة صلاحية
									</Button>
								</div>
								<div className="space-y-3">
									{reportForm.permissions.length === 0 ? (
										<div className={activityModalEmptySurfaceClassName}>
											لم يتم تعيين صلاحيات إضافية بعد.
										</div>
									) : (
										reportForm.permissions.map((permission, index) => (
											<div key={`permission-${index}`} className={cn(reportModalRowCardClassName, "md:grid-cols-[minmax(0,1fr)_180px_80px]")}>
												<Select
													value={permission.userId}
													onValueChange={(value) => updatePermission(index, "userId", value)}
												>
													<SelectTrigger className={activityModalFieldClassName}>
														<SelectValue placeholder="اختر المستخدم" />
													</SelectTrigger>
													<SelectContent className={activityModalSelectContentClassName}>
														{visiblePermissionUsers.map((user) => (
															<SelectItem key={user.id} value={user.id}>
																{user.name || user.email || user.id}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<Select
													value={permission.accessLevel}
													onValueChange={(value) => updatePermission(index, "accessLevel", value)}
												>
													<SelectTrigger className={activityModalFieldClassName}>
														<SelectValue />
													</SelectTrigger>
													<SelectContent className={activityModalSelectContentClassName}>
														<SelectItem value="view">مشاهدة فقط</SelectItem>
														<SelectItem value="edit">تعديل</SelectItem>
													</SelectContent>
												</Select>
												<Button type="button" variant="ghost" onClick={() => removePermission(index)} className={reportModalGhostActionClassName}>
													حذف
												</Button>
											</div>
										))
									)}
								</div>
							</div>
						)}

						<div className="rounded-2xl border border-zinc-200 bg-zinc-100/80 p-4 md:col-span-2 dark:border-[#7f6c47]/24 dark:bg-[#1f1813]">
							<div className="grid gap-3 sm:grid-cols-3">
								<div>
									<p className="text-xs text-muted-foreground">كاتب التقرير</p>
									<p className="mt-1 text-sm font-medium text-foreground">{currentUser.name || currentUser.email || "غير محدد"}</p>
								</div>
								<div>
									<p className="text-xs text-muted-foreground">تاريخ الإنشاء</p>
									<p className="mt-1 text-sm font-medium text-foreground">{formatDate(new Date().toISOString())}</p>
								</div>
								<div>
									<p className="text-xs text-muted-foreground">الحالة المتوقعة</p>
									<p className="mt-1 text-sm font-medium text-foreground">
										{reportForm.deliveryOption === "draft"
											? "مسودة"
											: reportForm.reportType === "client" && !isAdmin
											? "بانتظار موافقة الأدمن"
											: reportForm.reportType === "client"
												? reportForm.deliveryOption === "pdf_only"
													? "معتمد مع إنشاء PDF"
													: "معتمد مع محاولة الإرسال"
												: reportForm.deliveryOption === "pdf_only"
													? "داخلي مع إنشاء PDF"
													: "معتمد داخليًا"}
									</p>
								</div>
							</div>
						</div>
					</div>

					<DialogFooter className={cn(reportModalFooterClassName, "flex flex-wrap justify-end gap-2")}>
						<Button
							type="button"
							onClick={() => void handleReportAction("draft")}
							disabled={!!reportSubmitAction || uploadingAttachments}
							className={activityModalSecondaryButtonClassName}
						>
							{reportSubmitAction === "draft" ? (
								<>
									<Loader2 className="me-2 h-4 w-4 animate-spin" />
									جارٍ الحفظ...
								</>
							) : (
								"حفظ كمسودة"
							)}
						</Button>
						<Button
							type="button"
							onClick={() => void handleReportAction("save")}
							disabled={!!reportSubmitAction || uploadingAttachments}
							className={activityModalPrimaryButtonClassName}
						>
							{reportSubmitAction === "save" ? (
								<>
									<Loader2 className="me-2 h-4 w-4 animate-spin" />
									جارٍ الحفظ...
								</>
							) : (
								"حفظ التعديلات"
							)}
						</Button>
						{isAdmin && reportForm.reportType === "client" && (
							<Button
								type="button"
								onClick={() => void handleReportAction("send")}
								disabled={!!reportSubmitAction || uploadingAttachments}
								className={activityModalPrimaryButtonClassName}
							>
								{reportSubmitAction === "send" ? (
									<>
										<Loader2 className="me-2 h-4 w-4 animate-spin" />
										جارٍ الإرسال...
									</>
								) : (
									"إرسال التقرير"
								)}
							</Button>
						)}
						<Button
							type="button"
							variant="outline"
							onClick={closeReportDialog}
							disabled={!!reportSubmitAction}
							className={activityModalCancelButtonClassName}
						>
							إلغاء
						</Button>
					</DialogFooter>
					</div>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={!!approvalDialog} onOpenChange={(open) => !open && setApprovalDialog(null)}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>
							{approvalDialog?.decision === "approve" ? "اعتماد التقرير" : "رفض التقرير"}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						{approvalDialog?.decision !== "approve" && (
							<Textarea
								value={approvalDialog?.reason || ""}
								onChange={(event) =>
									setApprovalDialog((current) =>
										current ? { ...current, reason: event.target.value } : current
									)
								}
								rows={5}
								placeholder="اكتب سبب الرفض..."
							/>
						)}
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setApprovalDialog(null)}>
							إلغاء
						</Button>
						<Button type="button" onClick={handleApprovalAction} disabled={actioningReportId === approvalDialog?.reportId}>
							{actioningReportId === approvalDialog?.reportId ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : approvalDialog?.decision === "approve" ? (
								"اعتماد وإرسال"
							) : (
								"تأكيد الرفض"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={whatsAppComingSoonDialogOpen} onOpenChange={setWhatsAppComingSoonDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>قريبًا</DialogTitle>
					</DialogHeader>
					<p className="text-sm leading-7 text-muted-foreground">
						سيتم تطوير ميزة الإرسال عبر واتساب لاحقًا.
						<br />
						حاليًا إرسال التقارير يتم عبر البريد الإلكتروني فقط.
					</p>
					<DialogFooter>
						<Button type="button" onClick={() => setWhatsAppComingSoonDialogOpen(false)}>
							حسنًا
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
