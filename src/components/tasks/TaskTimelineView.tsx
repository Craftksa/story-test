"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	addDays,
	differenceInCalendarDays,
	endOfMonth,
	endOfWeek,
	format,
	startOfDay,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import { ar, enUS } from "date-fns/locale";
import {
	CalendarDays,
	ChevronDown,
	ChevronRight,
	Download,
	Eye,
	Filter,
	Plus,
	Search,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useCheckedLocale } from "@/lib/client-utils";
import { cn, formatStatus } from "@/lib/utils";

import {
	createTimelineRows,
	getThisWeekTasks,
	getTimelineRangeFromRows,
	type TimelineSourceTask,
	type TimelineRow,
	type TimelineTask,
	type TimelineTeamMember,
} from "./task-timeline-utils";

type TimelineLayoutMetrics = {
	leftColumnWidth: number;
	dayColumnWidth: number;
	groupRowHeight: number;
	taskRowHeight: number;
	barHeight: number;
	bodyViewportHeight: string;
};

type TimelineHeaderSegment = {
	key: string;
	label: string;
	subLabel?: string;
	startOffsetDays: number;
	days: number;
};

type TimelineTaskLayout = {
	rowTop: number;
	rowHeight: number;
	barLeft: number | null;
	barWidth: number | null;
	barRight: number | null;
	markerCenter: number | null;
	durationDays: number;
	isRenderable: boolean;
	isMilestone: boolean;
};

type PositionedTimelineRow =
	| (Extract<TimelineRow, { rowType: "group" }> & {
			top: number;
			height: number;
	  })
	| (Extract<TimelineRow, { rowType: "task" | "milestone" }> & {
			top: number;
			height: number;
	  });

type GroupSection = {
	group: Extract<TimelineRow, { rowType: "group" }>;
	tasks: Extract<TimelineRow, { rowType: "task" | "milestone" }>[];
};

type DependencyEdge = {
	key: string;
	fromId: string;
	toId: string;
};

const ZOOM_LEVELS = [0.8, 1, 1.2, 1.45] as const;
const TABLE_COLUMN_TEMPLATE = "minmax(0,2.1fr) minmax(108px,0.95fr) minmax(94px,0.88fr) 76px";
const TOOLBAR_BUTTON_CLASS =
	"h-8 rounded-[2px] border-[#D6DDE7] bg-white px-2.5 text-[12px] font-medium text-[#1E293B] shadow-none hover:bg-[#F8FAFC] dark:border-[#3A3128] dark:bg-[#17120E] dark:text-stone-100 dark:hover:bg-[#211A14]";
const HEADER_CAPTION_CLASS =
	"text-[10px] font-semibold uppercase tracking-[0.18em] text-[#66758A] dark:text-stone-500";

const DEFAULT_LAYOUT: TimelineLayoutMetrics = {
	leftColumnWidth: 420,
	dayColumnWidth: 24,
	groupRowHeight: 38,
	taskRowHeight: 52,
	barHeight: 10,
	bodyViewportHeight: "min(78vh, 960px)",
};

const DENSE_LAYOUT: TimelineLayoutMetrics = {
	leftColumnWidth: 420,
	dayColumnWidth: 20,
	groupRowHeight: 36,
	taskRowHeight: 48,
	barHeight: 8,
	bodyViewportHeight: "min(74vh, 880px)",
};

function getResolvedLayout(totalDays: number, dense: boolean, zoomFactor: number): TimelineLayoutMetrics {
	const base = dense ? DENSE_LAYOUT : DEFAULT_LAYOUT;
	let dayColumnWidth = base.dayColumnWidth;

	if (totalDays > 365) {
		dayColumnWidth = 8;
	} else if (totalDays > 240) {
		dayColumnWidth = 10;
	} else if (totalDays > 180) {
		dayColumnWidth = 12;
	} else if (totalDays > 120) {
		dayColumnWidth = 14;
	} else if (totalDays > 90) {
		dayColumnWidth = 16;
	} else if (totalDays > 60) {
		dayColumnWidth = 18;
	} else if (totalDays > 30) {
		dayColumnWidth = 22;
	}

	return {
		...base,
		dayColumnWidth: Math.max(8, Math.min(40, Math.round(dayColumnWidth * zoomFactor))),
	};
}

function buildMonthSegments(start: Date, end: Date, locale: typeof enUS): TimelineHeaderSegment[] {
	const segments: TimelineHeaderSegment[] = [];
	let cursor = startOfMonth(start);

	while (cursor.getTime() <= end.getTime()) {
		const segmentStart = cursor.getTime() < start.getTime() ? start : cursor;
		const rawSegmentEnd = endOfMonth(segmentStart);
		const segmentEnd = rawSegmentEnd.getTime() > end.getTime() ? end : rawSegmentEnd;

		segments.push({
			key: `${segmentStart.toISOString()}-${segmentEnd.toISOString()}`,
			label: format(segmentStart, "MMMM yyyy", { locale }),
			startOffsetDays: differenceInCalendarDays(segmentStart, start),
			days: differenceInCalendarDays(segmentEnd, segmentStart) + 1,
		});

		cursor = addDays(segmentEnd, 1);
	}

	return segments;
}

function buildWeekSegments(start: Date, end: Date, locale: typeof enUS): TimelineHeaderSegment[] {
	const segments: TimelineHeaderSegment[] = [];
	let cursor = startOfWeek(start, { weekStartsOn: 1 });

	while (cursor.getTime() <= end.getTime()) {
		const segmentStart = cursor.getTime() < start.getTime() ? start : cursor;
		const rawSegmentEnd = endOfWeek(segmentStart, { weekStartsOn: 1 });
		const segmentEnd = rawSegmentEnd.getTime() > end.getTime() ? end : rawSegmentEnd;
		const startLabel = format(segmentStart, "d MMM", { locale });
		const endLabel =
			segmentStart.getMonth() === segmentEnd.getMonth()
				? format(segmentEnd, "d", { locale })
				: format(segmentEnd, "d MMM", { locale });

		segments.push({
			key: `${segmentStart.toISOString()}-${segmentEnd.toISOString()}`,
			label: startLabel,
			subLabel: endLabel,
			startOffsetDays: differenceInCalendarDays(segmentStart, start),
			days: differenceInCalendarDays(segmentEnd, segmentStart) + 1,
		});

		cursor = addDays(segmentEnd, 1);
	}

	return segments;
}

function getTaskVisualState(status: string) {
	const normalizedStatus = status.trim().toLowerCase();

	if (["completed", "done", "complete"].includes(normalizedStatus)) {
		return "completed";
	}

	if (["on_hold", "paused", "stopped", "blocked"].includes(normalizedStatus)) {
		return "blocked";
	}

	if (["not_started", "pending"].includes(normalizedStatus)) {
		return "not_started";
	}

	return "in_progress";
}

function getTaskBarClasses(task: TimelineTask) {
	if (task.isOverdue && task.status !== "completed") {
		return "border-[#D97706] bg-[#F59E0B] text-white";
	}

	switch (getTaskVisualState(task.status)) {
		case "completed":
			return "border-[#0F766E] bg-[#14B8A6] text-white";
		case "blocked":
			return "border-[#B45309] bg-[#F59E0B] text-white";
		case "not_started":
			return "border-[#94A3B8] bg-[#CBD5E1] text-[#334155]";
		case "in_progress":
		default:
			return "border-[#1D4ED8] bg-[#60A5FA] text-white";
	}
}

function getProgressIndicatorClasses(task: TimelineTask) {
	switch (getTaskVisualState(task.status)) {
		case "completed":
			return "bg-emerald-500";
		case "blocked":
			return "bg-rose-500";
		case "not_started":
			return "bg-slate-400";
		case "in_progress":
		default:
			return "bg-blue-500";
	}
}

function getTaskStatusBadgeClasses(task: TimelineTask) {
	if (task.isOverdue && task.status !== "completed") {
		return "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]";
	}

	switch (getTaskVisualState(task.status)) {
		case "completed":
			return "border-[#99F6E4] bg-[#F0FDFA] text-[#115E59]";
		case "blocked":
			return "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]";
		case "not_started":
			return "border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]";
		case "in_progress":
		default:
			return "border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF]";
	}
}

function getGroupAccentClasses(groupKey: string) {
	switch (groupKey) {
		case "foundations":
		case "construction":
			return "bg-[#C0841A]";
		case "finishes":
		case "architectural":
			return "bg-[#64748B]";
		case "mechanical":
			return "bg-[#0F766E]";
		case "electrical":
			return "bg-[#2563EB]";
		default:
			return "bg-[#475569]";
	}
}

function getTranslatedTaskStatusLabel(task: TimelineTask, t: ReturnType<typeof useTranslations>) {
	switch (task.status) {
		case "completed":
		case "in_progress":
		case "not_started":
		case "on_hold":
		case "needs_review":
		case "pending":
		case "paused":
		case "blocked":
		case "working":
		case "active":
			return t(task.status);
		default:
			return formatStatus(task.status);
	}
}

function getTranslatedTaskTypeLabel(task: TimelineTask, t: ReturnType<typeof useTranslations>) {
	switch (task.groupKey) {
		case "foundations":
		case "finishes":
		case "general":
		case "construction":
		case "architectural":
		case "mechanical":
		case "electrical":
			return t(task.groupKey);
		default:
			return task.groupLabel || formatStatus(task.type);
	}
}

function getOwnerInitials(owner: string | null | undefined) {
	if (!owner?.trim()) return "—";

	const tokens = owner
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2);

	return tokens.map((token) => token.charAt(0).toUpperCase()).join("");
}

function formatTimelineCellDate(date: Date | null | undefined, locale: typeof enUS) {
	if (!date) return "—";
	return format(date, "d MMM", { locale });
}

function getTimelineAxisPosition(position: number, timelineWidth: number, rtlTimeline: boolean) {
	return rtlTimeline ? timelineWidth - position : position;
}

function getTaskLayouts(
	timelineStart: Date,
	layout: TimelineLayoutMetrics,
	timelineRows: TimelineRow[],
	timelineWidth: number,
	rtlTimeline: boolean
) {
	const taskLayouts = new Map<string, TimelineTaskLayout>();
	const rows: PositionedTimelineRow[] = [];
	let currentTop = 0;

	for (const row of timelineRows) {
		if (row.rowType === "group") {
			rows.push({
				...row,
				top: currentTop,
				height: layout.groupRowHeight,
			});
			currentTop += layout.groupRowHeight;
			continue;
		}

		const isRenderable = row.hasValidSchedule && Boolean(row.startDate && row.endDate);
		const durationDays =
			row.startDate && row.endDate
				? Math.max(1, differenceInCalendarDays(row.endDate, row.startDate) + 1)
				: 1;
		let barLeft: number | null = null;
		let barWidth: number | null = null;
		let markerCenter: number | null = null;

		if (isRenderable && row.startDate) {
			const startOffset = Math.max(0, differenceInCalendarDays(row.startDate, timelineStart));
			const logicalStartLeft = startOffset * layout.dayColumnWidth;

			if (row.rowType === "milestone") {
				barWidth = Math.max(layout.barHeight + 2, 12);
				markerCenter = getTimelineAxisPosition(
					logicalStartLeft + layout.dayColumnWidth / 2,
					timelineWidth,
					rtlTimeline
				);
				barLeft = markerCenter - barWidth / 2;
			} else {
				barWidth = Math.max(14, durationDays * layout.dayColumnWidth - 8);
				barLeft = rtlTimeline
					? timelineWidth - logicalStartLeft - barWidth - 4
					: logicalStartLeft + 4;
			}
		}

		taskLayouts.set(row.task.id, {
			rowTop: currentTop,
			rowHeight: layout.taskRowHeight,
			barLeft,
			barWidth,
			barRight: barLeft !== null && barWidth !== null ? barLeft + barWidth : null,
			markerCenter,
			durationDays,
			isRenderable,
			isMilestone: row.rowType === "milestone",
		});

		rows.push({
			...row,
			top: currentTop,
			height: layout.taskRowHeight,
		});
		currentTop += layout.taskRowHeight;
	}

	return {
		rows,
		taskLayouts,
		bodyHeight: Math.max(currentTop, layout.taskRowHeight * 2),
	};
}

function extractProjectName(title: string | undefined, lang: string) {
	if (!title?.trim()) {
		return lang === "ar" ? "المشروع الحالي" : "Current Project";
	}

	const trimmed = title.trim();
	const parts = trimmed.split(/[:：]/);

	if (parts.length > 1) {
		const candidate = parts.slice(1).join(":").trim();
		return candidate || trimmed;
	}

	return trimmed;
}

function getOriginalTaskField(task: TimelineTask, fieldName: string) {
	const originalTask = task.originalTask as Record<string, unknown>;
	return originalTask[fieldName];
}

function parseDependencyValue(value: unknown): string[] {
	if (!value) return [];

	if (typeof value === "string") {
		return value
			.split(/[,\s;|]+/)
			.map((item) => item.trim())
			.filter(Boolean);
	}

	if (Array.isArray(value)) {
		return value
			.flatMap((item) => {
				if (typeof item === "string") return item.trim();
				if (typeof item === "number") return String(item);
				if (item && typeof item === "object") {
					if ("taskId" in item && typeof item.taskId === "string") return item.taskId.trim();
					if ("id" in item && typeof item.id === "string") return item.id.trim();
				}
				return "";
			})
			.filter(Boolean);
	}

	if (typeof value === "object") {
		if ("taskId" in value && typeof value.taskId === "string") return [value.taskId.trim()];
		if ("id" in value && typeof value.id === "string") return [value.id.trim()];
	}

	return [];
}

function extractDependencyIds(task: TimelineTask) {
	const candidates = [
		"dependencies",
		"dependencyIds",
		"dependencyTaskIds",
		"dependsOn",
		"dependsOnIds",
		"predecessors",
		"predecessorIds",
		"predecessorTaskIds",
		"linkedTaskIds",
		"blockedBy",
		"blockedByTaskIds",
	];

	const dependencyIds = new Set<string>();

	for (const candidate of candidates) {
		for (const id of parseDependencyValue(getOriginalTaskField(task, candidate))) {
			if (id && id !== task.id) {
				dependencyIds.add(id);
			}
		}
	}

	return Array.from(dependencyIds);
}

function matchesTaskFilter(
	taskRow: Extract<TimelineRow, { rowType: "task" | "milestone" }>,
	query: string,
	statusFilter: "all" | "active" | "completed" | "late" | "scheduled",
	t: ReturnType<typeof useTranslations>
) {
	const { task } = taskRow;
	const matchesStatus =
		statusFilter === "all"
			? true
			: statusFilter === "active"
				? ["in_progress", "working", "active", "needs_review"].includes(task.status)
				: statusFilter === "completed"
					? task.status === "completed"
					: statusFilter === "late"
						? task.isOverdue
						: task.isScheduled;

	if (!matchesStatus) return false;
	if (!query) return true;

	const searchableText = [
		task.name,
		task.ownerLabel,
		task.groupLabel,
		task.type,
		getTranslatedTaskStatusLabel(task, t),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	return searchableText.includes(query);
}

function getDependencyPath(fromX: number, fromY: number, toX: number, toY: number) {
	const elbowOffset = toX >= fromX ? Math.max(12, Math.min(30, (toX - fromX) / 2)) : 20;
	const midX = toX >= fromX ? fromX + elbowOffset : fromX + elbowOffset;
	const destinationX = toX >= fromX ? toX - 8 : toX + 8;

	return `M ${fromX} ${fromY} H ${midX} V ${toY} H ${destinationX}`;
}

type TaskTimelineViewProps = {
	projectId?: string;
	tasks: TimelineSourceTask[];
	timelineRows?: TimelineRow[];
	projectTeam?: TimelineTeamMember[];
	getTaskHref?: (taskId: string) => string | null;
	showWeeklyTable?: boolean;
	compact?: boolean;
	title?: string;
	isLoading?: boolean;
};

export default function TaskTimelineView({
	projectId,
	tasks,
	timelineRows: providedTimelineRows,
	projectTeam = [],
	getTaskHref,
	showWeeklyTable = true,
	compact = false,
	title,
	isLoading = false,
}: TaskTimelineViewProps) {
	const t = useTranslations();
	const router = useRouter();
	const { lang, isRTL } = useCheckedLocale();
	const locale = lang === "ar" ? ar : enUS;
	const today = startOfDay(new Date());
	const headerScrollRef = useRef<HTMLDivElement | null>(null);
	const bodyScrollRef = useRef<HTMLDivElement | null>(null);
	const [searchValue, setSearchValue] = useState("");
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "late" | "scheduled">("all");
	const [denseView, setDenseView] = useState(compact);
	const [zoomIndex, setZoomIndex] = useState(compact ? 0 : 1);
	const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
	const projectName = extractProjectName(title, lang);
	const fallbackLabels = useMemo(
		() => ({
			scheduling: "Scheduling",
			project: lang === "ar" ? "المشروع" : "Project",
			table: lang === "ar" ? "جدول الأنشطة" : "Task Table",
			timeline: lang === "ar" ? "المخطط الزمني" : "Timeline",
			name: lang === "ar" ? "الاسم" : "Name",
			assignee: lang === "ar" ? "المسؤول / الشركة" : "Assignee / Company",
			status: lang === "ar" ? "الحالة" : "Status",
			complete: lang === "ar" ? "% الإنجاز" : "% Complete",
			search: lang === "ar" ? "ابحث عن نشاط أو مسؤول" : "Search activities or assignees",
			today: lang === "ar" ? "اليوم" : "Today",
			export: lang === "ar" ? "تصدير" : "Export",
			filters: lang === "ar" ? "الفلاتر" : "Filters",
			view: lang === "ar" ? "العرض" : "View",
			addActivity: lang === "ar" ? "إضافة نشاط" : "Add Activity",
			all: lang === "ar" ? "الكل" : "All",
			active: lang === "ar" ? "نشطة" : "Active",
			completed: lang === "ar" ? "مكتملة" : "Completed",
			late: lang === "ar" ? "متأخرة" : "Late",
			scheduled: lang === "ar" ? "مجدولة" : "Scheduled",
			noRows: lang === "ar" ? "لا توجد أنشطة مطابقة للبحث أو الفلتر." : "No activities match the current search or filter.",
			noTasks: lang === "ar" ? "لا توجد مهام لعرضها في الجدول الزمني حتى الآن." : "No tasks are available for this schedule yet.",
			loading: lang === "ar" ? "جارِ تحميل الجدول الزمني..." : "Loading schedule...",
			noOwner: lang === "ar" ? "غير محدد" : "Not set",
			activities: lang === "ar" ? "أنشطة" : "activities",
			group: lang === "ar" ? "مجموعة" : "Group",
			compactView: lang === "ar" ? "عرض مضغوط" : "Compact view",
			standardView: lang === "ar" ? "عرض قياسي" : "Standard view",
			thisWeek: lang === "ar" ? "هذا الأسبوع" : "This Week",
			weeklyFocus:
				lang === "ar"
					? "قائمة سريعة للأنشطة الواقعة ضمن أسبوع التنفيذ الحالي"
					: "Quick list of activities scheduled within the current execution week",
			noWeekTasks:
				lang === "ar" ? "لا توجد أنشطة مجدولة لهذا الأسبوع" : "No scheduled tasks for this week",
			start: lang === "ar" ? "البداية" : "Start",
			finish: lang === "ar" ? "النهاية" : "Finish",
			timelineWindow: lang === "ar" ? "النافذة الزمنية" : "Timeline window",
			milestone: lang === "ar" ? "مرحلة" : "Milestone",
			unscheduled: lang === "ar" ? "غير مجدولة" : "Unscheduled",
			day: lang === "ar" ? "يوم" : "day",
			days: lang === "ar" ? "أيام" : "days",
		}),
		[lang]
	);

	const resolveTaskHref = (taskId: string) =>
		getTaskHref?.(taskId) ?? (projectId ? `/projects/${projectId}/tasks/${taskId}` : null);

	const openTask = (taskId: string) => {
		const href = resolveTaskHref(taskId);
		if (!href) return;
		router.push(href);
	};

	const openTasksPage = () => {
		if (projectId) {
			router.push(`/projects/${projectId}/tasks?create=1`);
		}
	};

	const { timelineTasks: generatedTimelineTasks, timelineRows: generatedTimelineRows } = createTimelineRows(tasks, projectTeam, {
		referenceDate: today,
	});

	const timelineTasks = useMemo(
		() =>
			providedTimelineRows
				? providedTimelineRows
						.filter((row): row is Extract<TimelineRow, { rowType: "task" | "milestone" }> => row.rowType !== "group")
						.map((row) => row.task)
				: generatedTimelineTasks,
		[generatedTimelineTasks, providedTimelineRows]
	);

	const timelineRows = providedTimelineRows ?? generatedTimelineRows;
	const translatedTimelineRows = useMemo(
		() =>
			timelineRows.map((row) =>
				row.rowType === "group"
					? {
							...row,
							title: row.groupKey ? t(row.groupKey) : row.title,
					  }
					: {
							...row,
							groupLabel: getTranslatedTaskTypeLabel(row.task, t),
					  }
			),
		[t, timelineRows]
	);

	const groupedSections = useMemo(() => {
		const sections: GroupSection[] = [];
		let currentSection: GroupSection | null = null;

		for (const row of translatedTimelineRows) {
			if (row.rowType === "group") {
				if (currentSection) {
					sections.push(currentSection);
				}

				currentSection = {
					group: row,
					tasks: [],
				};
				continue;
			}

			if (!currentSection) continue;
			currentSection.tasks.push(row);
		}

		if (currentSection) {
			sections.push(currentSection);
		}

		return sections;
	}, [translatedTimelineRows]);

	useEffect(() => {
		setCollapsedGroups((current) => {
			let hasChanges = false;
			const next = { ...current };

			for (const section of groupedSections) {
				if (!(section.group.key in next)) {
					next[section.group.key] = false;
					hasChanges = true;
				}
			}

			return hasChanges ? next : current;
		});
	}, [groupedSections]);

	const groupMetrics = useMemo(() => {
		const metrics = new Map<
			string,
			{
				ownersLabel: string;
				averageProgress: number;
				completedCount: number;
				totalCount: number;
			}
		>();

		for (const section of groupedSections) {
			const ownerLabels = Array.from(
				new Set(section.tasks.map((row) => row.task.ownerLabel?.trim()).filter(Boolean))
			) as string[];
			const totalProgress = section.tasks.reduce((sum, row) => sum + row.task.progress, 0);
			const completedCount = section.tasks.filter((row) => row.task.status === "completed").length;

			metrics.set(section.group.key, {
				ownersLabel:
					ownerLabels.length === 0
						? fallbackLabels.noOwner
						: ownerLabels.length === 1
							? ownerLabels[0]
							: `${ownerLabels.length} ${fallbackLabels.activities}`,
				averageProgress:
					section.tasks.length > 0 ? Math.round(totalProgress / section.tasks.length) : 0,
				completedCount,
				totalCount: section.tasks.length,
			});
		}

		return metrics;
	}, [fallbackLabels.activities, fallbackLabels.noOwner, groupedSections]);

	const visibleTimelineRows = useMemo(() => {
		const query = searchValue.trim().toLowerCase();
		const rows: TimelineRow[] = [];

		for (const section of groupedSections) {
			const groupTitleMatches = query ? section.group.title.toLowerCase().includes(query) : false;
			const visibleTasks = query
				? section.tasks.filter((taskRow) => matchesTaskFilter(taskRow, query, statusFilter, t) || groupTitleMatches)
				: section.tasks.filter((taskRow) => matchesTaskFilter(taskRow, query, statusFilter, t));

			if (!groupTitleMatches && visibleTasks.length === 0) {
				continue;
			}

			rows.push(section.group);

			if (!collapsedGroups[section.group.key]) {
				rows.push(...visibleTasks);
			}
		}

		return rows;
	}, [collapsedGroups, groupedSections, searchValue, statusFilter, t]);

	const visibleTaskCount = visibleTimelineRows.filter((row) => row.rowType !== "group").length;
	const timelineRange = getTimelineRangeFromRows(translatedTimelineRows, today);
	const layout = useMemo(
		() => getResolvedLayout(timelineRange.totalDays, denseView, ZOOM_LEVELS[zoomIndex]),
		[denseView, timelineRange.totalDays, zoomIndex]
	);
	const thisWeekTasks = getThisWeekTasks(timelineTasks, today);
	const monthSegments = useMemo(
		() => buildMonthSegments(timelineRange.start, timelineRange.end, locale),
		[locale, timelineRange.end, timelineRange.start]
	);
	const weekSegments = useMemo(
		() => buildWeekSegments(timelineRange.start, timelineRange.end, locale),
		[locale, timelineRange.end, timelineRange.start]
	);
	const rtlTimeline = isRTL;
	const timelineWidth = timelineRange.totalDays * layout.dayColumnWidth;
	const todayOffset = differenceInCalendarDays(today, timelineRange.start);
	const todayLeft = getTimelineAxisPosition(
		todayOffset * layout.dayColumnWidth + layout.dayColumnWidth / 2,
		timelineWidth,
		rtlTimeline
	);
	const { rows: positionedTimelineRows, taskLayouts, bodyHeight } = useMemo(
		() => getTaskLayouts(timelineRange.start, layout, visibleTimelineRows, timelineWidth, rtlTimeline),
		[layout, rtlTimeline, timelineRange.start, timelineWidth, visibleTimelineRows]
	);

	const groupSummaryLayouts = useMemo(() => {
		const summaries = new Map<string, { left: number; width: number }>();
		let activeGroupKey: string | null = null;
		let minLeft = Number.POSITIVE_INFINITY;
		let maxRight = Number.NEGATIVE_INFINITY;

		const commitGroup = () => {
			if (!activeGroupKey || !Number.isFinite(minLeft) || !Number.isFinite(maxRight)) return;
			summaries.set(activeGroupKey, {
				left: minLeft,
				width: Math.max(18, maxRight - minLeft),
			});
		};

		for (const row of positionedTimelineRows) {
			if (row.rowType === "group") {
				commitGroup();
				activeGroupKey = row.key;
				minLeft = Number.POSITIVE_INFINITY;
				maxRight = Number.NEGATIVE_INFINITY;
				continue;
			}

			const rowLayout = taskLayouts.get(row.task.id);
			if (!rowLayout || !rowLayout.isRenderable) continue;

			if (rowLayout.isMilestone && rowLayout.markerCenter !== null) {
				const halfWidth = Math.max((rowLayout.barWidth ?? layout.barHeight) / 2, 8);
				minLeft = Math.min(minLeft, rowLayout.markerCenter - halfWidth);
				maxRight = Math.max(maxRight, rowLayout.markerCenter + halfWidth);
			} else if (rowLayout.barLeft !== null && rowLayout.barRight !== null) {
				minLeft = Math.min(minLeft, rowLayout.barLeft);
				maxRight = Math.max(maxRight, rowLayout.barRight);
			}
		}

		commitGroup();
		return summaries;
	}, [layout.barHeight, positionedTimelineRows, taskLayouts]);

	const dependencyEdges = useMemo(() => {
		const edges: DependencyEdge[] = [];
		const seen = new Set<string>();
		const taskRows = positionedTimelineRows.filter(
			(row): row is Extract<PositionedTimelineRow, { rowType: "task" | "milestone" }> => row.rowType !== "group"
		);
		const visibleTaskIds = new Set(taskRows.map((row) => row.task.id));
		let explicitEdgeCount = 0;

		for (const row of taskRows) {
			const dependencies = extractDependencyIds(row.task).filter((id) => visibleTaskIds.has(id));

			if (dependencies.length > 0) {
				for (const dependencyId of dependencies) {
					const key = `${dependencyId}->${row.task.id}`;
					if (seen.has(key)) continue;
					seen.add(key);
					explicitEdgeCount += 1;
					edges.push({
						key,
						fromId: dependencyId,
						toId: row.task.id,
					});
				}
			}
		}

		return explicitEdgeCount > 0 ? edges : [];
	}, [positionedTimelineRows]);

	useEffect(() => {
		const header = headerScrollRef.current;
		const body = bodyScrollRef.current;
		if (!header || !body) return;

		let syncingFrom: "header" | "body" | null = null;

		const syncScroll = (source: HTMLDivElement, target: HTMLDivElement, origin: "header" | "body") => {
			if (syncingFrom && syncingFrom !== origin) return;
			syncingFrom = origin;

			if (Math.abs(source.scrollLeft - target.scrollLeft) > 1) {
				target.scrollLeft = source.scrollLeft;
			}

			window.requestAnimationFrame(() => {
				syncingFrom = null;
			});
		};

		const handleHeaderScroll = () => syncScroll(header, body, "header");
		const handleBodyScroll = () => syncScroll(body, header, "body");

		header.addEventListener("scroll", handleHeaderScroll, { passive: true });
		body.addEventListener("scroll", handleBodyScroll, { passive: true });

		const defaultScrollLeft =
			todayOffset >= 0 && todayOffset < timelineRange.totalDays
				? Math.max(0, todayLeft - body.clientWidth * 0.3)
				: 0;
		header.scrollLeft = defaultScrollLeft;
		body.scrollLeft = defaultScrollLeft;

		return () => {
			header.removeEventListener("scroll", handleHeaderScroll);
			body.removeEventListener("scroll", handleBodyScroll);
		};
	}, [timelineRange.totalDays, todayLeft, todayOffset]);

	const handleScrollToToday = () => {
		const header = headerScrollRef.current;
		const body = bodyScrollRef.current;
		if (!header || !body) return;

		const nextScrollLeft = Math.max(0, todayLeft - body.clientWidth * 0.3);
		header.scrollTo({ left: nextScrollLeft, behavior: "smooth" });
		body.scrollTo({ left: nextScrollLeft, behavior: "smooth" });
	};

	const timelineWindowLabel = `${format(timelineRange.start, "d MMM yyyy", {
		locale,
	})} - ${format(timelineRange.end, "d MMM yyyy", { locale })}`;
	const hasAnyTasks = timelineTasks.length > 0;
	const hasQueryOrFilter = searchValue.trim().length > 0 || statusFilter !== "all";
	const emptyStateLabel = isLoading
		? fallbackLabels.loading
		: hasAnyTasks && hasQueryOrFilter
			? fallbackLabels.noRows
			: hasAnyTasks
				? fallbackLabels.noRows
				: fallbackLabels.noTasks;
	const shouldShowEmptyState = isLoading || !hasAnyTasks || visibleTimelineRows.length === 0;

	return (
		<div className="w-full min-w-0 overflow-hidden border-x-0 border-y border-[#D7DEE8] bg-[#FBFCFD] text-[#0F172A] shadow-none dark:border-[#2E261E] dark:bg-[#14110D] dark:text-stone-100">
			<div className="border-b border-[#D7DEE8] bg-[#F8FAFC] px-4 py-2 sm:px-5 dark:border-[#2E261E] dark:bg-[#17120E]">
				<div className="flex min-h-[52px] flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
					<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
						<h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#0F172A] dark:text-stone-100">
							{fallbackLabels.scheduling}
						</h2>
						<span className="h-4 w-px bg-[#D7DEE8] dark:bg-[#2E261E]" />
						<span className="truncate text-[12px] font-medium text-[#334155] dark:text-stone-200">
							{projectName}
						</span>
						<span className="text-[11px] text-[#94A3B8] dark:text-stone-600">/</span>
						<span className="text-[11px] text-[#66758A] dark:text-stone-400">
							{fallbackLabels.timelineWindow}
						</span>
						<span className="text-[11px] font-medium text-[#526173] dark:text-stone-300">
							{timelineWindowLabel}
						</span>
					</div>

					<div className="flex w-full flex-col gap-2 xl:w-auto">
						<div className="flex w-full flex-col gap-2 xl:flex-row xl:items-center xl:justify-end">
							<div className="relative min-w-0 xl:w-[220px]">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B] dark:text-stone-400" />
								<Input
									value={searchValue}
									onChange={(event) => setSearchValue(event.target.value)}
									placeholder={fallbackLabels.search}
									className={cn(
										"h-8 rounded-[2px] border-[#D6DDE7] bg-white pl-8 text-[12px] shadow-none dark:border-[#3A3128] dark:bg-[#17120E]",
										isRTL && "text-right"
									)}
								/>
							</div>

							<div className="flex flex-wrap items-center gap-1.5">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleScrollToToday}
									className={TOOLBAR_BUTTON_CLASS}
								>
									<CalendarDays className="me-1.5 h-3.5 w-3.5" />
									{fallbackLabels.today}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => {
										if (typeof window !== "undefined") {
											window.print();
										}
									}}
									className={TOOLBAR_BUTTON_CLASS}
								>
									<Download className="me-1.5 h-3.5 w-3.5" />
									{fallbackLabels.export}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setFiltersOpen((current) => !current)}
									className={TOOLBAR_BUTTON_CLASS}
								>
									<Filter className="me-1.5 h-3.5 w-3.5" />
									{fallbackLabels.filters}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setDenseView((current) => !current)}
									className={TOOLBAR_BUTTON_CLASS}
								>
									<Eye className="me-1.5 h-3.5 w-3.5" />
									{fallbackLabels.view}
								</Button>
								<div className="flex h-8 items-center rounded-sm border border-[#D6DDE7] bg-white px-0.5 shadow-none dark:border-[#3A3128] dark:bg-[#17120E]">
									<Button
										type="button"
										variant="ghost"
										size="icon"
										disabled={zoomIndex === 0}
										onClick={() => setZoomIndex((current) => Math.max(0, current - 1))}
										className="h-7 w-7 rounded-sm text-[#0F172A] hover:bg-[#EFF6FF] dark:text-stone-100 dark:hover:bg-[#221b15]"
									>
										<ZoomOut className="h-3.5 w-3.5" />
									</Button>
									<span className="min-w-[48px] text-center text-[11px] font-semibold text-[#475569] dark:text-stone-300">
										{Math.round(ZOOM_LEVELS[zoomIndex] * 100)}%
									</span>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										disabled={zoomIndex === ZOOM_LEVELS.length - 1}
										onClick={() =>
											setZoomIndex((current) => Math.min(ZOOM_LEVELS.length - 1, current + 1))
										}
										className="h-7 w-7 rounded-sm text-[#0F172A] hover:bg-[#EFF6FF] dark:text-stone-100 dark:hover:bg-[#221b15]"
									>
										<ZoomIn className="h-3.5 w-3.5" />
									</Button>
								</div>
								<Button
									type="button"
									size="sm"
									disabled={!projectId}
									onClick={openTasksPage}
									className="h-8 rounded-sm bg-[#0F172A] px-3 text-[12px] font-medium text-white hover:bg-[#1E293B] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#E7D7BC] dark:text-[#1A140F] dark:hover:bg-[#F4E9D4]"
								>
									<Plus className="me-1.5 h-3.5 w-3.5" />
									{fallbackLabels.addActivity}
								</Button>
							</div>
						</div>

						{filtersOpen ? (
							<div className="flex flex-wrap items-center gap-1.5 border-t border-[#E9EEF5] pt-2 dark:border-[#2A221B]">
								{(
									[
										["all", fallbackLabels.all],
										["active", fallbackLabels.active],
										["completed", fallbackLabels.completed],
										["late", fallbackLabels.late],
										["scheduled", fallbackLabels.scheduled],
									] as const
								).map(([value, label]) => (
									<button
										key={value}
										type="button"
										onClick={() => setStatusFilter(value)}
										className={cn(
											"inline-flex h-7 items-center rounded-sm border px-2.5 text-[11px] font-semibold transition-colors",
											statusFilter === value
												? "border-[#0F172A] bg-[#0F172A] text-white dark:border-[#E7D7BC] dark:bg-[#E7D7BC] dark:text-[#1A140F]"
												: "border-[#D7DEE8] bg-white text-[#334155] hover:border-[#94A3B8] dark:border-[#3A3128] dark:bg-[#1A1511] dark:text-stone-200"
										)}
									>
										{label}
									</button>
								))}
								<span className="text-[11px] text-[#64748B] dark:text-stone-400">
									{denseView ? fallbackLabels.compactView : fallbackLabels.standardView}
								</span>
							</div>
						) : null}
					</div>
				</div>
			</div>

			<div className="min-w-0 overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
				<div
					className="sticky top-0 z-30 grid border-b border-[#D7DEE8] bg-[#F7F9FC] dark:border-[#2E261E] dark:bg-[#17120E]"
					style={{ gridTemplateColumns: `${layout.leftColumnWidth}px minmax(0, 1fr)` }}
				>
					<div
						className={cn(
							"bg-[#F7F9FC] dark:bg-[#17120E]",
							isRTL ? "border-l border-[#D7DEE8] dark:border-[#2E261E]" : "border-r border-[#D7DEE8] dark:border-[#2E261E]"
						)}
					>
						<div className="flex h-8 items-center border-b border-[#D7DEE8] px-4 dark:border-[#2E261E]">
							<span className={HEADER_CAPTION_CLASS}>
								{fallbackLabels.table}
							</span>
						</div>
						<div
							className="grid h-10 items-center gap-3 px-4"
							style={{ gridTemplateColumns: TABLE_COLUMN_TEMPLATE }}
						>
							<span className={HEADER_CAPTION_CLASS}>
								{fallbackLabels.name}
							</span>
							<span className={HEADER_CAPTION_CLASS}>
								{fallbackLabels.assignee}
							</span>
							<span className={HEADER_CAPTION_CLASS}>
								{fallbackLabels.status}
							</span>
							<span className={HEADER_CAPTION_CLASS}>
								{fallbackLabels.complete}
							</span>
						</div>
					</div>

					<div className="min-w-0 bg-[#F7F9FC] dark:bg-[#17120E]" dir="ltr">
						<div className="flex h-8 items-center border-b border-[#D7DEE8] px-4 dark:border-[#2E261E]">
							<span className={HEADER_CAPTION_CLASS}>
								{fallbackLabels.timeline}
							</span>
						</div>
						<div
							ref={headerScrollRef}
							className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						>
							<div className="relative" style={{ width: timelineWidth }}>
								<div className={cn("flex h-9 border-b border-[#D7DEE8] dark:border-[#2E261E]", rtlTimeline && "flex-row-reverse")}>
									{monthSegments.map((segment) => (
										<div
											key={segment.key}
											className="flex shrink-0 items-center justify-center border-r border-[#D7DEE8] bg-[#F7F9FC] px-2 dark:border-[#2E261E] dark:bg-[#17120E]"
											style={{ width: segment.days * layout.dayColumnWidth }}
										>
											<span className="whitespace-nowrap text-[11px] font-semibold text-[#334155] dark:text-stone-200">
												{segment.label}
											</span>
										</div>
									))}
								</div>
								<div className={cn("flex h-8", rtlTimeline && "flex-row-reverse")}>
									{weekSegments.map((segment) => (
										<div
											key={segment.key}
											className="flex shrink-0 items-center justify-center border-r border-[#E2E8F0] bg-white px-2 dark:border-[#2E261E] dark:bg-[#15110D]"
											style={{ width: segment.days * layout.dayColumnWidth }}
										>
											<span className="whitespace-nowrap text-[10px] font-medium text-[#64748B] dark:text-stone-400">
												{segment.subLabel ? `${segment.label} - ${segment.subLabel}` : segment.label}
											</span>
										</div>
									))}
								</div>
								{todayOffset >= 0 && todayOffset < timelineRange.totalDays ? (
									<div className="pointer-events-none absolute inset-y-0 z-20" style={{ left: todayLeft }}>
										<div className="absolute left-1/2 top-1 -translate-x-1/2 rounded-sm bg-[#2563EB] px-1 py-0.5 text-[9px] font-semibold text-white">
											{fallbackLabels.today}
										</div>
										<div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[#2563EB]" />
									</div>
								) : null}
							</div>
						</div>
					</div>
				</div>

				<div className="overflow-y-auto bg-white dark:bg-[#15110D]" style={{ height: layout.bodyViewportHeight }}>
					<div
						className="grid min-w-0"
						style={{ gridTemplateColumns: `${layout.leftColumnWidth}px minmax(0, 1fr)` }}
					>
						<div
							className={cn(
								"relative bg-[#FCFDFE] dark:bg-[#15110D]",
								isRTL ? "border-l border-[#D7DEE8] dark:border-[#2E261E]" : "border-r border-[#D7DEE8] dark:border-[#2E261E]"
							)}
							style={{ height: bodyHeight }}
						>
							{shouldShowEmptyState ? (
								<div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#64748B] dark:text-stone-400">
									{emptyStateLabel}
								</div>
							) : null}

							{!shouldShowEmptyState && positionedTimelineRows.map((row) =>
								row.rowType === "group" ? (
									(() => {
										const metrics = groupMetrics.get(row.key);
										const isCollapsed = collapsedGroups[row.key];

										return (
											<div
												key={row.key}
												className="absolute inset-x-0 border-b border-[#E2E8F0] bg-[#F3F6FA] px-4 dark:border-[#2E261E] dark:bg-[#19140F]"
												style={{ top: row.top, height: row.height }}
											>
												<div
													className="grid h-full items-center gap-3"
													style={{ gridTemplateColumns: TABLE_COLUMN_TEMPLATE }}
												>
													<button
														type="button"
														onClick={() =>
															setCollapsedGroups((current) => ({
																...current,
																[row.key]: !current[row.key],
															}))
														}
														className={cn(
															"flex min-w-0 items-center gap-2 text-left",
															isRTL && "justify-end text-right"
														)}
													>
														{isCollapsed ? (
															<ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#475569] dark:text-stone-300" />
														) : (
															<ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#475569] dark:text-stone-300" />
														)}
														<span
															className={cn(
																"h-2 w-2 shrink-0 rounded-full",
																getGroupAccentClasses(row.groupKey)
															)}
														/>
														<div className="min-w-0">
															<p className="truncate text-[12px] font-semibold text-[#0F172A] dark:text-stone-100">
																{row.title}
															</p>
														</div>
													</button>
													<p className="truncate text-[11px] text-[#526173] dark:text-stone-300">
														{metrics?.ownersLabel ?? fallbackLabels.noOwner}
													</p>
													<p className="truncate text-[11px] font-medium text-[#526173] dark:text-stone-300">
														{metrics ? `${metrics.completedCount}/${metrics.totalCount}` : "-"}
													</p>
													<p className="text-[11px] font-semibold text-[#334155] dark:text-stone-200">
														{metrics?.averageProgress ?? 0}%
													</p>
												</div>
											</div>
										);
									})()
								) : (
									(() => {
										const task = row.task;
										const taskHref = resolveTaskHref(task.id);
										const taskStatusLabel = getTranslatedTaskStatusLabel(task, t);
										const durationLabel = !task.isScheduled
											? fallbackLabels.unscheduled
											: task.isMilestone
												? fallbackLabels.milestone
												: `${task.durationDays} ${task.durationDays === 1 ? fallbackLabels.day : fallbackLabels.days}`;

										return (
											<div
												key={row.key}
												className="absolute inset-x-0 border-b border-[#EEF2F7] bg-[#FCFDFE] px-4 dark:border-[#241D17] dark:bg-[#15110D]"
												style={{ top: row.top, height: row.height }}
											>
												<div
													className="grid h-full items-center gap-3"
													style={{ gridTemplateColumns: TABLE_COLUMN_TEMPLATE }}
												>
													<div className={cn("min-w-0", isRTL && "text-right")}>
														<button
															type="button"
															onClick={() => openTask(task.id)}
															disabled={!taskHref}
															className={cn(
																"block max-w-full truncate text-[12px] font-medium leading-5 text-[#0F172A] transition-colors hover:text-[#2563EB] disabled:cursor-default disabled:hover:text-[#0F172A] dark:text-stone-100 dark:disabled:hover:text-stone-100",
																isRTL && "ms-auto text-right"
															)}
														>
															{task.name}
														</button>
														<div
															className={cn(
																"mt-0.5 flex items-center gap-1.5 text-[10px] text-[#6B7A8C] dark:text-stone-400",
																isRTL && "justify-end"
															)}
														>
															<span>{formatTimelineCellDate(task.startDate, locale)}</span>
															<span className="text-[#CBD5E1] dark:text-stone-600">/</span>
															<span>{durationLabel}</span>
														</div>
													</div>

													<div className="min-w-0">
														<div className="flex items-center gap-1.5">
															<span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EEF3F8] text-[9px] font-bold text-[#334155] dark:bg-[#211A14] dark:text-stone-100">
																{getOwnerInitials(task.ownerLabel || fallbackLabels.noOwner)}
															</span>
															<span className="truncate text-[11px] text-[#334155] dark:text-stone-200">
																{task.ownerLabel || fallbackLabels.noOwner}
															</span>
														</div>
													</div>

													<div>
														<span
															className={cn(
																"inline-flex max-w-full items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold",
																getTaskStatusBadgeClasses(task)
															)}
														>
															<span className="truncate">{taskStatusLabel}</span>
														</span>
													</div>

													<div className="min-w-0">
														<div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-[#334155] dark:text-stone-200">
															<span>{task.progress}%</span>
														</div>
														<Progress
															value={task.progress}
															showValueLabel={false}
															className="mt-1 h-1 bg-[#E2E8F0] dark:bg-[#2E261E]"
															indicatorClassName={getProgressIndicatorClasses(task)}
														/>
													</div>
												</div>
											</div>
										);
									})()
								)
							)}
						</div>

						<div className="min-w-0 overflow-hidden bg-white dark:bg-[#15110D]" dir="ltr">
							<div
								ref={bodyScrollRef}
								className="overflow-x-auto overflow-y-hidden"
							>
								<div
									className="relative"
									style={{
										width: timelineWidth,
										height: bodyHeight,
										backgroundImage:
											layout.dayColumnWidth >= 18
												? `repeating-linear-gradient(to right, rgba(148,163,184,0.03) 0, rgba(148,163,184,0.03) ${layout.dayColumnWidth - 1}px, rgba(148,163,184,0.16) ${layout.dayColumnWidth - 1}px, rgba(148,163,184,0.16) ${layout.dayColumnWidth}px)`
												: undefined,
									}}
								>
									{shouldShowEmptyState ? (
										<div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-sm text-[#64748B] dark:text-stone-400">
											{emptyStateLabel}
										</div>
									) : null}
									{monthSegments.slice(1).map((segment) => (
										<div
											key={`month-line-${segment.key}`}
											className="pointer-events-none absolute inset-y-0 z-[2] border-l border-[#B9C5D3] dark:border-[#3A3128]"
											style={{
												left: getTimelineAxisPosition(
													segment.startOffsetDays * layout.dayColumnWidth,
													timelineWidth,
													rtlTimeline
												),
											}}
										/>
									))}
									{weekSegments.slice(1).map((segment) => (
										<div
											key={`week-line-${segment.key}`}
											className="pointer-events-none absolute inset-y-0 z-[1] border-l border-[#E6ECF3] dark:border-[#2E261E]"
											style={{
												left: getTimelineAxisPosition(
													segment.startOffsetDays * layout.dayColumnWidth,
													timelineWidth,
													rtlTimeline
												),
											}}
										/>
									))}
									{todayOffset >= 0 && todayOffset < timelineRange.totalDays ? (
										<div className="pointer-events-none absolute inset-y-0 z-20" style={{ left: todayLeft }}>
											<div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[#2563EB]" />
										</div>
									) : null}

									{!shouldShowEmptyState && positionedTimelineRows.map((row) =>
										row.rowType === "group" ? (
											<div
												key={`timeline-row-${row.key}`}
												className="absolute inset-x-0 border-b border-[#E2E8F0] bg-[#F4F7FA] dark:border-[#2E261E] dark:bg-[#19140F]"
												style={{ top: row.top, height: row.height }}
											>
												{(() => {
													const summaryLayout = groupSummaryLayouts.get(row.key);
													return summaryLayout ? (
														<div
															className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[#475569] opacity-80 dark:bg-stone-400"
															style={{
																left: summaryLayout.left,
																width: summaryLayout.width,
															}}
														/>
													) : null;
												})()}
											</div>
										) : (
											<div
												key={`timeline-row-${row.key}`}
												className="absolute inset-x-0 border-b border-[#EEF2F7] bg-white dark:border-[#241D17] dark:bg-[#15110D]"
												style={{ top: row.top, height: row.height }}
											/>
										)
									)}

									<svg
										className="pointer-events-none absolute inset-0 z-10 overflow-visible"
										width={timelineWidth}
										height={bodyHeight}
										viewBox={`0 0 ${timelineWidth} ${bodyHeight}`}
										fill="none"
									>
										<defs>
											<marker
												id="task-dependency-arrow"
												viewBox="0 0 6 6"
												refX="5"
												refY="3"
												markerWidth="6"
												markerHeight="6"
												orient="auto-start-reverse"
											>
												<path d="M 0 0 L 6 3 L 0 6 z" fill="#A8B4C4" />
											</marker>
										</defs>

										{!shouldShowEmptyState && dependencyEdges.map((edge) => {
											const sourceLayout = taskLayouts.get(edge.fromId);
											const targetLayout = taskLayouts.get(edge.toId);
											if (!sourceLayout || !targetLayout) return null;
											if (!sourceLayout.isRenderable || !targetLayout.isRenderable) return null;

											const fromX = sourceLayout.isMilestone
												? sourceLayout.markerCenter
												: sourceLayout.barRight;
											const toX = targetLayout.isMilestone
												? targetLayout.markerCenter
												: targetLayout.barLeft;

											if (fromX === null || toX === null) return null;

											const fromY = sourceLayout.rowTop + sourceLayout.rowHeight / 2;
											const toY = targetLayout.rowTop + targetLayout.rowHeight / 2;

											return (
												<path
													key={edge.key}
													d={getDependencyPath(fromX, fromY, toX, toY)}
													stroke="#A8B4C4"
													strokeWidth="1"
													strokeLinecap="round"
													strokeLinejoin="round"
													markerEnd="url(#task-dependency-arrow)"
												/>
											);
										})}
									</svg>

									{!shouldShowEmptyState && positionedTimelineRows.map((row) => {
										if (row.rowType === "group") return null;

										const task = row.task;
										const taskLayout = taskLayouts.get(task.id);
										if (!taskLayout || !taskLayout.isRenderable) return null;

										const taskHref = resolveTaskHref(task.id);
										const barClasses = getTaskBarClasses(task);
										const showInlineLabel =
											!taskLayout.isMilestone && Boolean(taskLayout.barWidth && taskLayout.barWidth >= 110);
										const labelPosition = Math.max(
											12,
											(taskLayout.barRight ?? taskLayout.markerCenter ?? 0) + 8
										);

										return (
											<div
												key={`task-bar-${row.key}`}
												className="absolute inset-x-0 z-20"
												style={{ top: row.top, height: row.height }}
											>
												{taskLayout.isMilestone ? (
													<>
														<button
															type="button"
															onClick={() => openTask(task.id)}
															disabled={!taskHref}
															title={task.name}
															aria-label={task.name}
															className={cn(
																"absolute border shadow-none transition-transform hover:-translate-y-px disabled:cursor-default disabled:hover:translate-y-0",
																barClasses
															)}
															style={{
																left: taskLayout.barLeft ?? 0,
																top: (row.height - 10) / 2,
																width: 10,
																height: 10,
																transform: "rotate(45deg)",
															}}
														/>
														<span
															dir={isRTL ? "rtl" : "ltr"}
															className={cn(
																"absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-medium text-[#475569] dark:text-stone-300",
																isRTL && "text-right"
															)}
															style={{ left: labelPosition }}
														>
															{task.name}
														</span>
													</>
												) : (
													<>
														<button
															type="button"
															onClick={() => openTask(task.id)}
															disabled={!taskHref}
															title={task.name}
															aria-label={task.name}
															className={cn(
																"absolute flex items-center overflow-hidden rounded-[2px] border px-1.5 text-left shadow-none transition-transform hover:-translate-y-px disabled:cursor-default disabled:hover:translate-y-0",
																barClasses
															)}
															style={{
																left: taskLayout.barLeft ?? 0,
																top: (row.height - layout.barHeight) / 2,
																width: taskLayout.barWidth ?? 0,
																height: layout.barHeight,
															}}
														>
															{showInlineLabel ? (
																<span
																	dir={isRTL ? "rtl" : "ltr"}
																	className={cn("block min-w-0 truncate text-[10px] font-semibold", isRTL && "text-right")}
																>
																	{task.name}
																</span>
															) : null}
														</button>
														{!showInlineLabel ? (
															<span
																dir={isRTL ? "rtl" : "ltr"}
																className={cn(
																	"absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-medium text-[#475569] dark:text-stone-300",
																	isRTL && "text-right"
																)}
																style={{ left: labelPosition }}
															>
																{task.name}
															</span>
														) : null}
													</>
												)}
											</div>
										);
									})}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{showWeeklyTable ? (
				<div className="border-t border-[#D7DEE8] bg-white px-4 py-5 sm:px-5 lg:px-6 dark:border-[#2E261E] dark:bg-[#17120E]">
					<div className="mb-4 flex flex-col gap-1">
						<h3 className="text-base font-semibold">{fallbackLabels.thisWeek}</h3>
						<p className="text-sm text-[#64748B] dark:text-stone-400">{fallbackLabels.weeklyFocus}</p>
					</div>

					<div className="overflow-hidden border border-[#E2E8F0] dark:border-[#2E261E]">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-[#E2E8F0] dark:divide-[#2E261E]">
								<thead className="bg-[#F8FAFC] dark:bg-[#18130F]">
									<tr className="text-left">
										{[
											fallbackLabels.name,
											fallbackLabels.assignee,
											fallbackLabels.status,
											fallbackLabels.timelineWindow,
											fallbackLabels.finish,
										].map((label) => (
											<th
												key={label}
												className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B] dark:text-stone-400"
											>
												{label}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-[#EEF2F7] dark:divide-[#241D17]">
									{thisWeekTasks.length === 0 ? (
										<tr>
											<td colSpan={5} className="px-4 py-10 text-center text-sm text-[#64748B] dark:text-stone-400">
												{fallbackLabels.noWeekTasks}
											</td>
										</tr>
									) : (
										thisWeekTasks.map((task) => (
											<tr key={task.id} className="bg-white hover:bg-[#F8FAFC] dark:bg-[#17120E] dark:hover:bg-[#1C1611]">
												<td className="px-4 py-4">
													<button
														type="button"
														onClick={() => openTask(task.id)}
														disabled={!resolveTaskHref(task.id)}
														className={cn(
															"max-w-[220px] truncate text-sm font-medium text-[#0F172A] transition-colors hover:text-[#2563EB] disabled:cursor-default disabled:hover:text-[#0F172A] dark:text-stone-100 dark:disabled:hover:text-stone-100",
															isRTL && "text-right"
														)}
													>
														{task.name}
													</button>
												</td>
												<td className="whitespace-nowrap px-4 py-4 text-sm text-[#475569] dark:text-stone-300">
													{task.ownerLabel || fallbackLabels.noOwner}
												</td>
												<td className="px-4 py-4">
													<span
														className={cn(
															"inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
															getTaskStatusBadgeClasses(task)
														)}
													>
														{getTranslatedTaskStatusLabel(task, t)}
													</span>
												</td>
												<td className="whitespace-nowrap px-4 py-4 text-sm text-[#475569] dark:text-stone-300">
													{task.startDate && task.endDate
														? `${formatTimelineCellDate(task.startDate, locale)} - ${formatTimelineCellDate(task.endDate, locale)}`
														: fallbackLabels.unscheduled}
												</td>
												<td className="whitespace-nowrap px-4 py-4 text-sm text-[#475569] dark:text-stone-300">
													{format(task.dueDate ?? task.placementDate, "d MMM yyyy", { locale })}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
