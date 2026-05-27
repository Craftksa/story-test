"use client";

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
	AlertCircle,
	CheckCircle2,
	Clock3,
	FilePlus2,
	FileText,
	Filter,
	Loader2,
	MessageSquarePlus,
	RefreshCcw,
	Send,
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

type ActivityFilter = "all" | "recent" | "waiting_client_action" | "overdue";

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
};

type ActivityProjectsResponse = {
	projects: ProjectSummary[];
	internalUsers: InternalUser[];
};

type ActivityMutationResponse = {
	details: ProjectDetails | null;
	message?: string | null;
};

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

const EMPTY_RECIPIENT: ReportRecipient = { name: "", email: "", phone: "", channel: "both" };

const EMPTY_REPORT_FORM: ReportFormState = {
	reportId: null,
	projectId: "",
	reportType: "client",
	deliveryOption: "draft",
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

const truncate = (value?: string | null, max = 110) => {
	if (!value) return "";
	if (value.length <= max) return value;
	return `${value.slice(0, max).trim()}...`;
};

const inferDeliveryOption = (report: ProjectReport): ReportDeliveryOption => {
	if (report.status === "draft") return "draft";
	if (report.recipients.length === 0) return "pdf_only";

	const channels = new Set(report.recipients.map((recipient) => recipient.channel ?? "both"));
	if (channels.size === 1 && channels.has("none")) return "pdf_only";
	if (channels.size === 1 && channels.has("email")) return "email";
	if (channels.size === 1 && channels.has("whatsapp")) return "whatsapp";

	return "email_whatsapp";
};

const extractApiErrorMessage = (error: unknown, fallbackMessage: string) => {
	if (axios.isAxiosError(error)) {
		const apiMessage = error.response?.data?.error;
		if (typeof apiMessage === "string" && apiMessage.trim()) {
			return apiMessage;
		}
	}

	if (error instanceof Error && error.message.trim()) {
		return error.message;
	}

	return fallbackMessage;
};

const priorityClasses: Record<"high" | "medium" | "low", string> = {
	high: "border-rose-500/20 bg-rose-500/10 text-rose-300",
	medium: "border-amber-500/20 bg-amber-500/10 text-amber-200",
	low: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
};

const reportStatusClasses: Record<ProjectReport["status"], string> = {
	draft: "border-border/60 bg-muted/40 text-muted-foreground",
	pending_admin_approval: "border-amber-500/25 bg-amber-500/10 text-amber-200",
	approved: "border-sky-500/25 bg-sky-500/10 text-sky-200",
	rejected: "border-rose-500/25 bg-rose-500/10 text-rose-200",
	sent: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
};

const activityPanelScrollHeightClass = "h-[calc(100vh-320px)]";
const activityPanelScrollContainerClass =
	"overflow-y-scroll overscroll-contain [scrollbar-gutter:stable] [scrollbar-color:rgba(218,197,143,0.55)_rgba(255,255,255,0.05)] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.05] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#9f8a58] hover:[&::-webkit-scrollbar-thumb]:bg-[#dac58f]";
const activityModalOverlayClassName = "fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm";
const activityModalContentClassName =
	"fixed left-1/2 top-1/2 z-[9999] w-full max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#dac58f]/20 bg-[#111315] p-0 text-white shadow-2xl shadow-black/60";
const activityModalFieldClassName =
	"w-full rounded-xl border border-[#dac58f]/15 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#8f8a7d] focus:border-[#dac58f]/45 focus:bg-white/[0.07] focus:ring-2 focus:ring-[#dac58f]/10";
const activityModalSelectContentClassName =
	"z-[10001] border border-[#dac58f]/20 bg-[#111315] text-white shadow-2xl shadow-black/60";
const activityModalLabelClassName = "mb-2 block text-sm font-medium text-[#e8dfc8]";
const activityModalPrimaryButtonClassName =
	"rounded-xl bg-[#dac58f] px-5 py-2.5 text-sm font-semibold text-[#111315] transition hover:bg-[#e7d3a3] disabled:cursor-not-allowed disabled:opacity-50";
const activityModalSecondaryButtonClassName =
	"rounded-xl border border-[#dac58f]/25 bg-[#dac58f]/10 px-5 py-2.5 text-sm font-semibold text-[#e8dfc8] transition hover:border-[#dac58f]/45 hover:bg-[#dac58f]/15 disabled:cursor-not-allowed disabled:opacity-50";
const activityModalCancelButtonClassName =
	"rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-[#b8b2a3] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white";
const activityModalCloseButtonClassName =
	"rounded-full border border-white/10 bg-white/5 p-2 text-[#b8b2a3] transition hover:border-[#dac58f]/30 hover:bg-[#dac58f]/10 hover:text-white";
const activityModalCardClassName = "rounded-2xl border border-[#dac58f]/12 bg-white/[0.03] p-4";

export function ActivityCenter({ currentUser }: ActivityCenterProps) {
	const { lang, dir } = useCheckedLocale();
	const activityDirection = dir === "rtl" ? "rtl" : "ltr";
	const activityTextAlignClass = activityDirection === "rtl" ? "text-right" : "text-left";
	const isAdmin = ["admin", "moderator"].includes(currentUser.role ?? "");
	const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
	const [projects, setProjects] = useState<ProjectSummary[]>([]);
	const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);
	const [loadingProjects, setLoadingProjects] = useState(true);
	const [selectedProjectId, setSelectedProjectId] = useState("");
	const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
	const [loadingDetails, setLoadingDetails] = useState(false);
	const [noteDialogOpen, setNoteDialogOpen] = useState(false);
	const [reportDialogOpen, setReportDialogOpen] = useState(false);
	const [letterDialogOpen, setLetterDialogOpen] = useState(false);
	const [viewingReportId, setViewingReportId] = useState<string | null>(null);
	const [viewingLetterId, setViewingLetterId] = useState<string | null>(null);
	const [approvalDialog, setApprovalDialog] = useState<ApprovalDialogState | null>(null);
	const [noteProjectId, setNoteProjectId] = useState("");
	const [noteText, setNoteText] = useState("");
	const [reportForm, setReportForm] = useState<ReportFormState>(EMPTY_REPORT_FORM);
	const [letterForm, setLetterForm] = useState<LetterFormState>(EMPTY_LETTER_FORM);
	const [submittingNote, setSubmittingNote] = useState(false);
	const [submittingReport, setSubmittingReport] = useState(false);
	const [submittingLetter, setSubmittingLetter] = useState(false);
	const [uploadingAttachments, setUploadingAttachments] = useState(false);
	const [uploadingLetterAttachments, setUploadingLetterAttachments] = useState(false);
	const [actioningReportId, setActioningReportId] = useState<string | null>(null);

	const formatDate = (value?: string | null) => {
		if (!value) return "غير متوفر";
		return new Date(value).toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
			dateStyle: "medium",
			timeStyle: "short",
		});
	};

	const loadProjects = async () => {
		setLoadingProjects(true);
		try {
			const response = await axios.get<ActivityProjectsResponse>("/api/activity/projects");
			setProjects(response.data.projects);
			setInternalUsers(response.data.internalUsers);
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
			return;
		}

		setLoadingDetails(true);
		try {
			const response = await axios.get<ProjectDetails>(`/api/activity/projects/${projectId}`);
			setProjectDetails(response.data);
		} catch (error) {
			console.error("Failed to load project activity details", error);
			toast.error("تعذر تحميل تفاصيل النشاط لهذا المشروع.");
			setProjectDetails(null);
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
		return projects.filter((summary) => {
			if (activityFilter === "recent") return isRecentProject(summary);
			if (activityFilter === "waiting_client_action") return summary.clientActionTaskCount > 0;
			if (activityFilter === "overdue") return summary.overdueTaskCount > 0;
			return true;
		});
	}, [activityFilter, projects]);

	useEffect(() => {
		if (!filteredProjects.length) return;
		if (filteredProjects.some((project) => project.id === selectedProjectId)) return;
		setSelectedProjectId(filteredProjects[0].id);
	}, [filteredProjects, selectedProjectId]);

	const selectedSummary = projects.find((project) => project.id === selectedProjectId) ?? null;
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
			letterDate: new Date().toISOString().slice(0, 10),
		});
		setLetterDialogOpen(true);
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
							channel: recipient.channel || "both",
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
					};

		if (payload.details) {
			setProjectDetails(payload.details);
			setSelectedProjectId(payload.details.project.id);
		}
		await loadProjects();
		return payload.message || null;
	};

	const handleReportSubmit = async () => {
		if (!reportForm.projectId || !reportForm.title.trim() || !reportForm.details.trim()) {
			toast.error("أكمل بيانات التقرير الأساسية أولًا.");
			return;
		}

		const cleanedRecipients = reportForm.recipients
			.map((recipient) => ({
				name: recipient.name.trim(),
				email: recipient.email?.trim() || null,
				phone: recipient.phone?.trim() || null,
				channel: recipient.channel || "both",
			}))
			.filter((recipient) => recipient.name);

		setSubmittingReport(true);
		try {
			const payload = {
				projectId: reportForm.projectId,
				reportType: reportForm.reportType,
				deliveryOption: reportForm.deliveryOption,
				title: reportForm.title.trim(),
				summary: reportForm.summary.trim() || null,
				details: reportForm.details.trim(),
				workDetails: reportForm.workDetails.trim() || null,
				attachments: reportForm.attachments,
				recipients: cleanedRecipients,
				permissions: reportForm.permissions,
			};

			if (reportForm.reportId) {
				const message = await upsertProjectDetails(
					axios.patch<ActivityMutationResponse>(`/api/activity/reports/${reportForm.reportId}`, payload)
				);
				toast.success(message || "تم تحديث التقرير.");
			} else {
				const message = await upsertProjectDetails(
					axios.post<ActivityMutationResponse>("/api/activity/reports", payload)
				);
				toast.success(message || "تم إنشاء التقرير بنجاح.");
			}

			setReportDialogOpen(false);
			setReportForm({
				...EMPTY_REPORT_FORM,
				projectId: selectedProjectId,
			});
		} catch (error) {
			console.error("Failed to submit report", error);
			toast.error(extractApiErrorMessage(error, "تعذر حفظ التقرير."));
		} finally {
			setSubmittingReport(false);
		}
	};

	const handleLetterSubmit = async () => {
		if (
			!letterForm.projectId ||
			!letterForm.recipientName.trim() ||
			!letterForm.subject.trim() ||
			!letterForm.body.trim()
		) {
			toast.error("أكمل بيانات الخطاب الأساسية أولًا.");
			return;
		}

		setSubmittingLetter(true);
		try {
			const payload = {
				projectId: letterForm.projectId,
				recipientName: letterForm.recipientName.trim(),
				subject: letterForm.subject.trim(),
				letterDate: letterForm.letterDate || null,
				body: letterForm.body.trim(),
				attachments: letterForm.attachments,
			};

			if (letterForm.letterId) {
				const message = await upsertProjectDetails(
					axios.patch<ActivityMutationResponse>(
						`/api/activity/letters/${letterForm.letterId}`,
						payload
					)
				);
				toast.success(message || "تم تحديث الخطاب.");
			} else {
				const message = await upsertProjectDetails(
					axios.post<ActivityMutationResponse>("/api/activity/letters", payload)
				);
				toast.success(message || "تم إنشاء الخطاب بنجاح.");
			}

			setLetterDialogOpen(false);
			setLetterForm({
				...EMPTY_LETTER_FORM,
				projectId: selectedProjectId,
			});
		} catch (error) {
			console.error("Failed to submit letter", error);
			toast.error(extractApiErrorMessage(error, "تعذر حفظ الخطاب."));
		} finally {
			setSubmittingLetter(false);
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
			const message = await upsertProjectDetails(
				axios.patch<ActivityMutationResponse>(`/api/activity/reports/${approvalDialog.reportId}/approval`, {
					decision: approvalDialog.decision,
					reason: approvalDialog.reason.trim() || null,
				})
			);
			toast.success(
				message ||
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
			const message = await upsertProjectDetails(
				axios.post<ActivityMutationResponse>(`/api/activity/reports/${report.id}/send`, {})
			);
			toast.success(message || "تم إرسال التقرير للعميل.");
		} catch (error) {
			console.error("Failed to send report", error);
			toast.error(extractApiErrorMessage(error, "تعذر إرسال التقرير."));
		} finally {
			setActioningReportId(null);
		}
	};

	const handleOpenReportPdf = (report: ProjectReport) => {
		const printUrl = `/activity/reports/${report.id}/print`;
		const printWindow = window.open(printUrl, "_blank", "noopener,noreferrer");

		if (!printWindow) {
			const link = document.createElement("a");
			link.href = printUrl;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			link.click();
		}
	};

	const handleOpenLetterPrint = (letter: ProjectLetter) => {
		const printUrl = `/activity/letters/${letter.id}/print`;
		const printWindow = window.open(printUrl, "_blank", "noopener,noreferrer");

		if (!printWindow) {
			const link = document.createElement("a");
			link.href = printUrl;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			link.click();
		}
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

	return (
		<div dir={activityDirection} className={cn("space-y-4", activityTextAlignClass)}>
			<Card className="border-border/70 shadow-sm">
				<CardHeader className="gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div className={cn("space-y-1", activityTextAlignClass)}>
						<CardTitle>مركز النشاط</CardTitle>
					</div>
					<div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
						<Select value={activityFilter} onValueChange={(value) => setActivityFilter(value as ActivityFilter)}>
							<SelectTrigger className="w-full min-w-44 bg-background sm:w-48">
								<Filter className="me-2 h-4 w-4 text-muted-foreground" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">كل المشاريع</SelectItem>
								<SelectItem value="recent">محدث مؤخرًا</SelectItem>
								<SelectItem value="waiting_client_action">بانتظار إجراء العميل</SelectItem>
								<SelectItem value="overdue">متأخر</SelectItem>
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
												<div className="mt-3 inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-200">
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
									<div className="grid gap-3 sm:grid-cols-2">
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
																	<Badge variant="outline">{letterStatusLabel[letter.status]}</Badge>
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
																	<Badge className={reportStatusClasses[report.status]}>
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
					className={cn(activityModalContentClassName, "sm:max-w-4xl")}
				>
					<div dir={activityDirection} className={cn("overflow-hidden", activityTextAlignClass)}>
						<DialogHeader className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#dac58f]/10 bg-[#111315]/95 px-6 py-5 backdrop-blur">
							<div>
								<DialogTitle className="text-xl font-semibold text-white">
									{viewedLetter?.subject || "عرض الخطاب"}
								</DialogTitle>
							</div>
							<Button
								type="button"
								variant="ghost"
								onClick={() => setViewingLetterId(null)}
								className={activityModalCloseButtonClassName}
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
									</div>

									<div className="grid gap-3 sm:grid-cols-2">
										<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
											<p className="text-xs text-[#8f8a7d]">اسم المشروع</p>
											<p className="text-sm text-[#f5f1e8]">{projectDetails?.project.name || "غير متوفر"}</p>
										</div>
										<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
											<p className="text-xs text-[#8f8a7d]">الجهة الموجه لها</p>
											<p className="text-sm text-[#f5f1e8]">{viewedLetter.recipientName}</p>
										</div>
										<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
											<p className="text-xs text-[#8f8a7d]">الموضوع</p>
											<p className="text-sm text-[#f5f1e8]">{viewedLetter.subject}</p>
										</div>
										<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
											<p className="text-xs text-[#8f8a7d]">التاريخ</p>
											<p className="text-sm text-[#f5f1e8]">
												{formatDate(viewedLetter.letterDate || viewedLetter.createdAt)}
											</p>
										</div>
										<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
											<p className="text-xs text-[#8f8a7d]">الحالة</p>
											<p className="text-sm text-[#f5f1e8]">{letterStatusLabel[viewedLetter.status]}</p>
										</div>
										<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
											<p className="text-xs text-[#8f8a7d]">الكاتب</p>
											<p className="text-sm text-[#f5f1e8]">{viewedLetter.authorName}</p>
										</div>
									</div>

									<div className="space-y-4 rounded-2xl border border-[#dac58f]/12 bg-black/20 px-5 py-5">
										<p className="text-base text-[#f5f1e8]">تحية طيبة وبعد،</p>
										<p className="whitespace-pre-line text-sm leading-8 text-[#d6d0c2]">
											{viewedLetter.body || "لا يوجد نص مضاف لهذا الخطاب."}
										</p>
										<section className="space-y-1 pt-2">
											<p className="text-sm text-[#f5f1e8]">وتفضلوا بقبول فائق التحية والتقدير،</p>
											<p className="text-sm text-[#f5f1e8]">فريق شركة كرافت</p>
										</section>
									</div>

									{viewedLetter.attachments.length > 0 && (
										<div className={cn(activityModalCardClassName, "space-y-3")}>
											<p className="text-sm font-medium text-[#e8dfc8]">المرفقات</p>
											<div className="flex flex-wrap gap-2">
												{viewedLetter.attachments.map((attachment, index) => (
													<a
														key={`${attachment.url}-${index}`}
														href={attachment.url}
														target="_blank"
														rel="noreferrer"
														className="rounded-xl border border-[#dac58f]/15 bg-white/[0.03] px-3 py-2 text-xs text-[#f5f1e8] transition hover:border-[#dac58f]/35"
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
							<div className="px-6 py-8 text-sm text-[#b8b2a3]">تعذر تحميل بيانات الخطاب المحدد.</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={!!viewingReportId} onOpenChange={(open) => !open && setViewingReportId(null)}>
				<DialogContent
					overlayClassName={activityModalOverlayClassName}
					className={cn(activityModalContentClassName, "sm:max-w-5xl")}
				>
					<div dir={activityDirection} className={cn("overflow-hidden", activityTextAlignClass)}>
						<DialogHeader className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#dac58f]/10 bg-[#111315]/95 px-6 py-5 backdrop-blur">
							<div>
								<DialogTitle className="text-xl font-semibold text-white">
									{viewedReport?.title || "عرض التقرير"}
								</DialogTitle>
							</div>
							<Button
								type="button"
								variant="ghost"
								onClick={() => setViewingReportId(null)}
								className={activityModalCloseButtonClassName}
							>
								X
							</Button>
						</DialogHeader>

						{viewedReport ? (
							<div className="space-y-5 px-6 py-6">
								<div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
									<div className={cn(activityModalCardClassName, "space-y-5")}>
										<div className="space-y-3">
											<h3 className="text-2xl font-semibold text-white">{viewedReport.title}</h3>
										</div>

										<div className="grid gap-3 sm:grid-cols-2">
											<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
												<p className="text-xs text-[#8f8a7d]">اسم المشروع</p>
												<p className="text-sm text-[#f5f1e8]">{projectDetails?.project.name || "غير متوفر"}</p>
											</div>
											<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
												<p className="text-xs text-[#8f8a7d]">نوع التقرير</p>
												<p className="text-sm text-[#f5f1e8]">{reportTypeLabel[viewedReport.reportType]}</p>
											</div>
											<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
												<p className="text-xs text-[#8f8a7d]">التاريخ</p>
												<p className="text-sm text-[#f5f1e8]">{formatDate(viewedReport.createdAt)}</p>
											</div>
											<div className="space-y-1 rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
												<p className="text-xs text-[#8f8a7d]">إعداد</p>
												<p className="text-sm text-[#f5f1e8]">{viewedReport.authorName}</p>
											</div>
										</div>

										<div className="space-y-4 rounded-2xl border border-[#dac58f]/12 bg-black/20 px-5 py-5">
											<p className="text-base text-[#f5f1e8]">السلام عليكم ورحمة الله وبركاته،</p>
											<p className="text-sm leading-8 text-[#d6d0c2]">
												نقدم لكم هذا التقرير الذي يعرض أحدث مستجدات المشروع، موضحًا أبرز ما تم إنجازه من أعمال، والنتائج المحققة حتى تاريخ إعداد هذا التقرير، وذلك في إطار الحرص على تعزيز الشفافية ومتابعة سير العمل بكفاءة وفعالية.
											</p>

											<section className="space-y-2">
												<h4 className="text-sm font-semibold text-white">ملخص التقرير</h4>
												<p className="whitespace-pre-line text-sm leading-8 text-[#d6d0c2]">
													{viewedReport.summary || "لا يوجد ملخص لهذا التقرير."}
												</p>
											</section>

											<section className="space-y-2">
												<h4 className="text-sm font-semibold text-white">متن التقرير</h4>
												<p className="whitespace-pre-line text-sm leading-8 text-[#d6d0c2]">
													{viewedReport.details}
												</p>
												{viewedReport.workDetails && (
													<p className="whitespace-pre-line text-sm leading-8 text-[#d6d0c2]">
														{viewedReport.workDetails}
													</p>
												)}
											</section>

											<section className="space-y-1 pt-2">
												<p className="text-sm text-[#f5f1e8]">أطيب التحيات،</p>
												<p className="text-sm text-[#f5f1e8]">فريق شركة كرافت</p>
											</section>
										</div>
									</div>

									<div className="space-y-4">
										<div className={cn(activityModalCardClassName, "space-y-4")}>
											<div className="flex flex-wrap gap-2">
												{(viewedReport.status === "approved" || viewedReport.status === "sent") && (
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => handleOpenReportPdf(viewedReport)}
														className={activityModalCancelButtonClassName}
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
														className={activityModalCancelButtonClassName}
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
															className={activityModalPrimaryButtonClassName}
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
															className={activityModalCancelButtonClassName}
														>
															رفض
														</Button>
													</>
												)}
											</div>

											<div className="grid gap-3 sm:grid-cols-2">
												<div className="rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
													<p className="text-xs text-[#8f8a7d]">حالة التقرير</p>
													<p className="mt-1 text-sm text-[#f5f1e8]">{reportStatusLabel[viewedReport.status]}</p>
												</div>
												<div className="rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
													<p className="text-xs text-[#8f8a7d]">حالة PDF</p>
													<p className="mt-1 text-sm text-[#f5f1e8]">{pdfStatusLabel[viewedReport.pdfStatus]}</p>
												</div>
												<div className="rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
													<p className="text-xs text-[#8f8a7d]">إرسال البريد</p>
													<p className="mt-1 text-sm text-[#f5f1e8]">{deliveryStatusLabel[viewedReport.emailStatus]}</p>
												</div>
												<div className="rounded-xl border border-[#dac58f]/10 bg-white/[0.03] px-4 py-3">
													<p className="text-xs text-[#8f8a7d]">إرسال الواتساب</p>
													<p className="mt-1 text-sm text-[#f5f1e8]">{deliveryStatusLabel[viewedReport.whatsappStatus]}</p>
												</div>
											</div>
										</div>

										<div className={cn(activityModalCardClassName, "space-y-4")}>
											<div className="space-y-2">
												<p className="text-sm font-medium text-[#e8dfc8]">معلومات الإرسال</p>
												<p className="text-sm text-[#c7c0af]">
													{viewedReport.recipients.length > 0
														? viewedReport.recipients
																.map((recipient) => `${recipient.name}${recipient.channel && recipient.channel !== "both" ? ` - ${recipient.channel === "email" ? "بريد" : recipient.channel === "whatsapp" ? "واتساب" : "بدون إرسال"}` : ""}`)
																.join("، ")
														: "لا يوجد مستلمون محددون لهذا التقرير."}
												</p>
											</div>

											{viewedReport.permissions.length > 0 && (
												<div className="space-y-2">
													<p className="text-sm font-medium text-[#e8dfc8]">صلاحيات التقرير</p>
													<p className="text-sm text-[#c7c0af]">
														{viewedReport.permissions
															.map((permission) => `${permission.userName} (${permission.accessLevel === "edit" ? "تعديل" : "مشاهدة"})`)
															.join("، ")}
													</p>
												</div>
											)}

											{viewedReport.attachments.length > 0 && (
												<div className="space-y-2">
													<p className="text-sm font-medium text-[#e8dfc8]">المرفقات</p>
													<div className="flex flex-wrap gap-2">
														{viewedReport.attachments.map((attachment, index) => (
															<a
																key={`${attachment.url}-${index}`}
																href={attachment.url}
																target="_blank"
																rel="noreferrer"
																className="rounded-xl border border-[#dac58f]/15 bg-white/[0.03] px-3 py-2 text-xs text-[#f5f1e8] transition hover:border-[#dac58f]/35"
															>
																{attachment.name || `مرفق ${index + 1}`}
															</a>
														))}
													</div>
												</div>
											)}
										</div>

										{viewedReport.rejectionReason && (
											<div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
												سبب الرفض: {viewedReport.rejectionReason}
											</div>
										)}

										{viewedReport.lastDeliveryError && (
											<div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-sm text-amber-200">
												{viewedReport.lastDeliveryError}
											</div>
										)}
									</div>
								</div>
							</div>
						) : (
							<div className="px-6 py-8 text-sm text-[#b8b2a3]">تعذر تحميل بيانات التقرير المحدد.</div>
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
						<DialogHeader className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#dac58f]/10 bg-[#111315]/95 px-6 py-5 backdrop-blur">
							<div>
								<DialogTitle className="text-xl font-semibold text-white">إضافة ملاحظة</DialogTitle>
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
						<DialogFooter className="sticky bottom-0 border-t border-[#dac58f]/10 bg-[#111315]/95 px-6 py-4 backdrop-blur">
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
						<DialogHeader className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#dac58f]/10 bg-[#111315]/95 px-6 py-5 backdrop-blur">
							<div>
								<DialogTitle className="text-xl font-semibold text-white">
									{letterForm.letterId ? "تعديل خطاب" : "إنشاء خطاب"}
								</DialogTitle>
							</div>
							<Button
								type="button"
								variant="ghost"
								onClick={() => setLetterDialogOpen(false)}
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
											<p className="text-sm font-medium text-[#e8dfc8]">المرفقات</p>
										</div>
										<label className="inline-flex cursor-pointer items-center rounded-xl border border-[#dac58f]/25 bg-[#dac58f]/10 px-4 py-2 text-sm font-semibold text-[#e8dfc8] transition hover:border-[#dac58f]/45 hover:bg-[#dac58f]/15">
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
											<div className="rounded-xl border border-dashed border-[#dac58f]/15 bg-white/[0.03] px-4 py-4 text-sm text-[#8f8a7d]">
												لا توجد مرفقات بعد.
											</div>
										) : (
											letterForm.attachments.map((attachment, index) => (
												<div
													key={`${attachment.url}-${index}`}
													className="flex items-center justify-between gap-3 rounded-xl border border-[#dac58f]/15 bg-white/[0.03] px-3 py-3 text-sm"
												>
													<div className="min-w-0">
														<p className="truncate font-medium text-[#e8dfc8]">
															{attachment.name || attachment.url}
														</p>
														<p className="truncate text-xs text-[#8f8a7d]">{attachment.url}</p>
													</div>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="text-[#b8b2a3] hover:bg-white/[0.06] hover:text-white"
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

						<DialogFooter className="sticky bottom-0 border-t border-[#dac58f]/10 bg-[#111315]/95 px-6 py-4 backdrop-blur">
							<Button
								type="button"
								variant="outline"
								onClick={() => setLetterDialogOpen(false)}
								className={activityModalCancelButtonClassName}
							>
								إلغاء
							</Button>
							<Button
								type="button"
								onClick={handleLetterSubmit}
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
						<DialogHeader className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#dac58f]/10 bg-[#111315]/95 px-6 py-5 backdrop-blur">
							<div>
								<DialogTitle className="text-xl font-semibold text-white">
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
									<p className="text-sm font-medium text-[#e8dfc8]">خيارات الإرسال</p>
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
									<SelectItem value="pdf_only">{deliveryOptionLabel.pdf_only}</SelectItem>
									<SelectItem value="email">{deliveryOptionLabel.email}</SelectItem>
									<SelectItem value="whatsapp">{deliveryOptionLabel.whatsapp}</SelectItem>
									<SelectItem value="email_whatsapp">{deliveryOptionLabel.email_whatsapp}</SelectItem>
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
									<p className="text-sm font-medium text-[#e8dfc8]">الصور أو المرفقات</p>
								</div>
								<label className="inline-flex cursor-pointer items-center rounded-xl border border-[#dac58f]/25 bg-[#dac58f]/10 px-4 py-2 text-sm font-semibold text-[#e8dfc8] transition hover:border-[#dac58f]/45 hover:bg-[#dac58f]/15">
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
									<div className="rounded-xl border border-dashed border-[#dac58f]/15 bg-white/[0.03] px-4 py-4 text-sm text-[#8f8a7d]">
										لا توجد مرفقات بعد.
									</div>
								) : (
									reportForm.attachments.map((attachment, index) => (
										<div key={`${attachment.url}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#dac58f]/15 bg-white/[0.03] px-3 py-3 text-sm">
											<div className="min-w-0">
												<p className="truncate font-medium text-[#e8dfc8]">{attachment.name || attachment.url}</p>
												<p className="truncate text-xs text-[#8f8a7d]">{attachment.url}</p>
											</div>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="text-[#b8b2a3] hover:bg-white/[0.06] hover:text-white"
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
									<p className="text-sm font-medium text-[#e8dfc8]">المستلمون</p>
								</div>
								<Button type="button" variant="outline" size="sm" onClick={addRecipient} className={activityModalSecondaryButtonClassName}>
									إضافة مستلم
								</Button>
							</div>
							<div className="space-y-3">
								{reportForm.recipients.map((recipient, index) => (
									<div key={`recipient-${index}`} className="grid gap-3 rounded-2xl border border-[#dac58f]/15 bg-white/[0.03] p-4 md:grid-cols-4">
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
										<Input
											value={recipient.phone || ""}
											onChange={(event) => updateRecipient(index, "phone", event.target.value)}
											placeholder="WhatsApp number"
											className={activityModalFieldClassName}
										/>
										<div className="flex gap-2">
											<Select
												value={recipient.channel || "both"}
												onValueChange={(value) => updateRecipient(index, "channel", value)}
											>
												<SelectTrigger className={activityModalFieldClassName}>
													<SelectValue />
												</SelectTrigger>
												<SelectContent className={activityModalSelectContentClassName}>
													<SelectItem value="both">البريد والواتساب</SelectItem>
													<SelectItem value="email">البريد فقط</SelectItem>
													<SelectItem value="whatsapp">الواتساب فقط</SelectItem>
													<SelectItem value="none">بدون إرسال مباشر</SelectItem>
												</SelectContent>
											</Select>
											<Button type="button" variant="ghost" onClick={() => removeRecipient(index)} className="text-[#b8b2a3] hover:bg-white/[0.06] hover:text-white">
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
										<p className="text-sm font-medium text-[#e8dfc8]">صلاحيات التقرير</p>
									</div>
									<Button type="button" variant="outline" size="sm" onClick={addPermission} className={activityModalSecondaryButtonClassName}>
										إضافة صلاحية
									</Button>
								</div>
								<div className="space-y-3">
									{reportForm.permissions.length === 0 ? (
										<div className="rounded-xl border border-dashed border-[#dac58f]/15 bg-white/[0.03] px-4 py-4 text-sm text-[#8f8a7d]">
											لم يتم تعيين صلاحيات إضافية بعد.
										</div>
									) : (
										reportForm.permissions.map((permission, index) => (
											<div key={`permission-${index}`} className="grid gap-3 rounded-2xl border border-[#dac58f]/15 bg-white/[0.03] p-4 md:grid-cols-[minmax(0,1fr)_180px_80px]">
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
												<Button type="button" variant="ghost" onClick={() => removePermission(index)} className="text-[#b8b2a3] hover:bg-white/[0.06] hover:text-white">
													حذف
												</Button>
											</div>
										))
									)}
								</div>
							</div>
						)}

						<div className="rounded-2xl border border-[#dac58f]/15 bg-white/[0.03] p-4 md:col-span-2">
							<div className="grid gap-3 sm:grid-cols-3">
								<div>
									<p className="text-xs text-[#8f8a7d]">كاتب التقرير</p>
									<p className="mt-1 text-sm font-medium text-[#e8dfc8]">{currentUser.name || currentUser.email || "غير محدد"}</p>
								</div>
								<div>
									<p className="text-xs text-[#8f8a7d]">تاريخ الإنشاء</p>
									<p className="mt-1 text-sm font-medium text-[#e8dfc8]">{formatDate(new Date().toISOString())}</p>
								</div>
								<div>
									<p className="text-xs text-[#8f8a7d]">الحالة المتوقعة</p>
									<p className="mt-1 text-sm font-medium text-[#e8dfc8]">
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

					<DialogFooter className="sticky bottom-0 border-t border-[#dac58f]/10 bg-[#111315]/95 px-6 py-4 backdrop-blur">
						<Button type="button" variant="outline" onClick={() => setReportDialogOpen(false)} className={activityModalCancelButtonClassName}>
							إلغاء
						</Button>
						<Button type="button" onClick={handleReportSubmit} disabled={submittingReport || uploadingAttachments} className={activityModalPrimaryButtonClassName}>
							{submittingReport ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : reportForm.reportId ? (
								"حفظ التعديلات"
							) : (
								deliveryOptionLabel[reportForm.deliveryOption]
							)}
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
		</div>
	);
}
