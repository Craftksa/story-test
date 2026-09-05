'use client';

import React, {useEffect, useMemo, useState} from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import axios from "axios";
import Spinner from "@/components/Spinner";
import {useTranslations} from "use-intl";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { useUserStore } from "@/store/userStore";
import TaskTimelineView from "@/components/tasks/TaskTimelineView";
import { createTimelineRows, type TimelineSourceTask } from "@/components/tasks/task-timeline-utils";
import { ProjectVisibilityFilter } from "@/components/project-visibility-filter";
import { useCheckedLocale } from "@/lib/client-utils";
import {
	filterProjectsByVisibility,
	ProjectVisibilityScope,
} from "@/lib/project-visibility";
import { cn, formatStatus } from "@/lib/utils";
import { DashboardWorkspace } from "@/components/dashboard/DashboardWorkspace";
import { CalendarDays, List } from "lucide-react";

type ProjectStatus = 'in_progress' | 'not_started' | 'completed' | 'on_hold';
type RecentActivityStatus = ProjectStatus | 'needs_review';
type ActionCategory = 'overdue' | 'client_action' | 'recent';
type ActionPriority = 'high' | 'medium' | 'low';
type DashboardTab = 'projects' | 'tasks' | 'analysis';

type DashboardData = {
	overview: {
		totalProjects: number;
		activeProjects: number;
		completedProjects: number;
		totalUsers: number;
		adminUsers: number;
		employeeUsers: number;
		clientUsers: number;
	};
	projectsByStatus: Array<{
		status: ProjectStatus;
		count: number;
		fill: string;
	}>;
	projectsByType: Array<{
		name: string;
		count: number;
		percentage: number;
	}>;
	cityDistribution: Array<{
		city: string;
		projects: number;
		tasks: number;
	}>;
	monthlyProgress: Array<{
		month: string;
		completed: number;
		started: number;
	}>;
	taskMetrics: {
		totalTasks: number;
		foundationTasks: number;
		finishTasks: number;
		completedTasks: number;
		pendingTasks: number;
	};
	taskTypes: Array<{
		type: 'foundation' | 'finish';
		count: number;
		fill: string;
	}>;
	recentActivity: Array<{
		project: string;
		status: RecentActivityStatus;
		city: string;
		date: string;
	}>;
};

type DetailedTask = {
	taskId: string;
	taskName?: string | null;
	taskStatus?: string | null;
	taskType?: string | null;
	startDate?: string | Date | null;
	endDate?: string | Date | null;
	updatedAt?: string | Date | null;
	createdAt?: string | Date | null;
	notes?: string | null;
};

type DetailedProject = {
	id: string;
	name: string;
	city?: string | null;
	client?: {
		id?: string | null;
		name?: string | null;
		email?: string | null;
	} | null;
	employees?: Array<{
		id?: string | null;
		name?: string | null;
		email?: string | null;
		role?: string | null;
	}> | null;
	tasks?: DetailedTask[] | null;
};

type DashboardTimelineTask = TimelineSourceTask & {
	projectId: string;
	ownerName?: string | null;
	projectName?: string | null;
};

type EmployeeAnalysisSummary = {
	id: string;
	name: string;
	assignedProjects: number;
	totalTasks: number;
	completedTasks: number;
	overdueTasks: number;
	completionRate: number;
	lastActivity: string | null;
};

type EmployeeAnalysisSection = 'assignedTasks' | 'completedTasks' | 'overdueTasks' | 'assignedProjects';

type EmployeeTaskDetail = {
	id: string;
	taskName: string;
	projectName: string;
	status: string | null;
	dueDate: string | null;
	updatedAt: string | null;
	completedAt: string | null;
	overdueDays: number | null;
	delayReason: string | null;
};

type EmployeeProjectDetail = {
	id: string;
	projectName: string;
	totalTasks: number;
	completedTasks: number;
	overdueTasks: number;
};

type EmployeeAnalysisDetails = {
	id: string;
	name: string;
	assignedTasks: EmployeeTaskDetail[];
	completedTasks: EmployeeTaskDetail[];
	overdueTasks: EmployeeTaskDetail[];
	assignedProjects: EmployeeProjectDetail[];
};

type WeeklyLocationSummary = {
	city: string;
	activityCount: number;
	activeProjects: number;
	totalProjects: number;
	sharePercentage: number;
	latestActivity: string | null;
	statusText: string;
	adminNote: string;
};

type ActivityActionItem = {
	id: string;
	labelKey: string;
	category: ActionCategory;
	projectId: string;
	projectName: string;
	taskId: string;
	taskName: string;
	description: string;
	date: string;
	priority: ActionPriority;
};

type ActivityNote = {
	content: string;
	authorName: string;
};

type SessionUserLike = {
	name?: string | null;
	username?: string | null;
};

const ANALYTICS_EMPTY_STATE = 'لا توجد بيانات كافية للتحليل حاليًا.';
const WEEKLY_ANALYSIS_EMPTY_STATE = 'لا توجد بيانات كافية لهذا الأسبوع';
const EMPLOYEE_ANALYSIS_SECTION_EMPTY_STATE = 'لا توجد تفاصيل متاحة لهذا القسم';

const EMPLOYEE_ANALYSIS_SECTION_META: Record<
	EmployeeAnalysisSection,
	{
		title: string;
		description: string;
	}
> = {
	assignedTasks: {
		title: 'المهام المسندة',
		description: 'يعرض جميع المهام المرتبطة بالمشاريع المسندة لهذا الموظف.',
	},
	completedTasks: {
		title: 'المهام المكتملة',
		description: 'يعرض المهام المكتملة فقط مع معلومات الإكمال الأساسية.',
	},
	overdueTasks: {
		title: 'المهام المتأخرة',
		description: 'يعرض المهام المتأخرة مع مدة التأخير وأي ملاحظات مرتبطة بها.',
	},
	assignedProjects: {
		title: 'المشاريع المسندة',
		description: 'يعرض المشاريع المسندة لهذا الموظف مع ملخص المهام داخل كل مشروع.',
	},
};

const getAllowedDashboardTabs = (role?: string | null): DashboardTab[] =>
	role === 'admin'
		? ['projects', 'tasks', 'analysis']
		: ['projects', 'tasks'];

const DEFAULT_DASHBOARD_TAB: DashboardTab = 'projects';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getDefaultDashboardTab = (_role?: string | null): DashboardTab => DEFAULT_DASHBOARD_TAB;

const resolveDashboardTab = (
	tabParam: string | null | undefined,
	allowedTabs: DashboardTab[],
	fallback: DashboardTab = DEFAULT_DASHBOARD_TAB
): DashboardTab =>
	tabParam && allowedTabs.includes(tabParam as DashboardTab)
		? (tabParam as DashboardTab)
		: fallback;

const getDateValue = (value?: string | Date | null) => {
	if (!value) return null;

	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
};

const getSafeArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const getSafePercentage = (value: number, total: number) =>
	total > 0 ? Math.round((value / total) * 100) : 0;

const getNormalizedCityName = (city?: string | null) => city?.trim() || 'غير محدد';

const getProjectTaskOwnerLabel = (project: DetailedProject) => {
	const teamMembers = (project.employees ?? [])
		.map((member) => member.name?.trim() || member.email?.trim() || '')
		.filter(Boolean);

	return teamMembers.length > 0 ? teamMembers.join(', ') : null;
};

const buildDashboardTimelineTasks = (
	projects: DetailedProject[]
): DashboardTimelineTask[] =>
	projects.flatMap((project) => {
		const ownerName = getProjectTaskOwnerLabel(project);

		return (project.tasks ?? []).map((task) => ({
			...task,
			projectId: project.id,
			projectName: project.name,
			ownerName,
		})) as DashboardTimelineTask[];
	});

const getEmployeeProgressIndicatorClassName = (completionRate: number) => {
	if (completionRate > 85) return 'bg-emerald-500';
	if (completionRate >= 70) return 'bg-amber-400';
	return 'bg-rose-500';
};

const getStartOfWeek = (referenceDate = new Date()) => {
	const date = new Date(referenceDate);
	date.setHours(0, 0, 0, 0);
	date.setDate(date.getDate() - date.getDay());
	return date;
};

const getEndOfWeek = (referenceDate = new Date()) => {
	const date = getStartOfWeek(referenceDate);
	date.setDate(date.getDate() + 6);
	date.setHours(23, 59, 59, 999);
	return date;
};

const isDateWithinWeek = (date: Date, referenceDate = new Date()) => {
	const startOfWeek = getStartOfWeek(referenceDate);
	const endOfWeek = getEndOfWeek(referenceDate);
	return date.getTime() >= startOfWeek.getTime() && date.getTime() <= endOfWeek.getTime();
};

const getTaskActivityDate = (task: DetailedTask) =>
	getDateValue(task.updatedAt) ?? getDateValue(task.createdAt) ?? getDateValue(task.startDate);

const isTaskCompleted = (status?: string | null) => status === 'completed';

const isTaskOverdue = (task: DetailedTask, referenceDate = new Date()) => {
	const taskEndDate = getDateValue(task.endDate);
	if (!taskEndDate) return false;

	return taskEndDate.getTime() < referenceDate.getTime() && !isTaskCompleted(task.taskStatus);
};

const formatAnalyticsDate = (value?: string | Date | null) => {
	const date = getDateValue(value);
	if (!date) return null;

	return date.toISOString().split('T')[0];
};

const buildActivityItemsFromProjects = (
	projects: DetailedProject[],
	t: ReturnType<typeof useTranslations>,
	referenceDate = new Date()
): ActivityActionItem[] => {
	const overdueItems: Array<ActivityActionItem & { sortTime: number }> = [];
	const clientActionItems: Array<ActivityActionItem & { sortTime: number }> = [];
	const recentItems: Array<ActivityActionItem & { sortTime: number }> = [];

	projects.forEach((project) => {
		(project.tasks ?? []).forEach((task) => {
			const taskId = typeof task.taskId === 'string' ? task.taskId.trim() : '';
			const taskName = typeof task.taskName === 'string' ? task.taskName.trim() : '';
			if (!project.id || !taskId || !taskName) return;

			const activityDate = getTaskActivityDate(task);
			const sortTime = activityDate?.getTime() ?? 0;
			const formattedActivityDate = formatAnalyticsDate(activityDate) ?? t("Not set");
			const formattedDueDate = formatAnalyticsDate(task.endDate) ?? t("Not set");

			if (isTaskOverdue(task, referenceDate)) {
				overdueItems.push({
					id: `overdue:${project.id}:${taskId}`,
					labelKey: 'activityTaskOverdue',
					category: 'overdue',
					projectId: project.id,
					projectName: project.name,
					taskId,
					taskName,
					description: `${taskName} • ${t("Due date")}: ${formattedDueDate}`,
					date: formattedDueDate,
					priority: 'high',
					sortTime,
				});
			}

			if (task.taskStatus === 'needs_review' || task.taskStatus === 'on_hold') {
				clientActionItems.push({
					id: `client:${project.id}:${taskId}`,
					labelKey:
						task.taskStatus === 'needs_review'
							? 'activityClientApprovalNeeded'
							: 'activityClientFeedbackPending',
					category: 'client_action',
					projectId: project.id,
					projectName: project.name,
					taskId,
					taskName,
					description: `${taskName} • ${t("Last Updated")}: ${formattedActivityDate}`,
					date: formattedActivityDate,
					priority: task.taskStatus === 'needs_review' ? 'high' : 'medium',
					sortTime,
				});
			}

			if (activityDate) {
				recentItems.push({
					id: `recent:${project.id}:${taskId}`,
					labelKey: 'activityProgressUpdate',
					category: 'recent',
					projectId: project.id,
					projectName: project.name,
					taskId,
					taskName,
					description: `${taskName} • ${t("Last Updated")}: ${formattedActivityDate}`,
					date: formattedActivityDate,
					priority: task.taskStatus === 'completed' ? 'low' : 'medium',
					sortTime,
				});
			}
		});
	});

	const sortAndTrim = (items: Array<ActivityActionItem & { sortTime: number }>) =>
		items
			.sort((left, right) => right.sortTime - left.sortTime)
			.slice(0, 6)
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
		.map(({ sortTime: _sortTime, ...item }) => item);

	return [
		...sortAndTrim(overdueItems),
		...sortAndTrim(clientActionItems),
		...sortAndTrim(recentItems),
	];
};

const getTaskStatusLabel = (status?: string | null) => {
	switch (status) {
		case 'completed':
			return 'مكتملة';
		case 'in_progress':
			return 'قيد التنفيذ';
		case 'not_started':
			return 'لم تبدأ';
		case 'on_hold':
			return 'متوقفة';
		case 'needs_review':
			return 'تحتاج مراجعة';
		default:
			return 'غير متوفر';
	}
};

const getTaskStatusBadgeClassName = (status?: string | null) => {
	switch (status) {
		case 'completed':
			return 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/35 dark:text-emerald-200';
		case 'in_progress':
			return 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-400/30 dark:bg-sky-950/35 dark:text-sky-200';
		case 'not_started':
			return 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-400/30 dark:bg-slate-900/45 dark:text-slate-200';
		case 'on_hold':
			return 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/35 dark:text-amber-200';
		case 'needs_review':
			return 'border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-400/30 dark:bg-violet-950/35 dark:text-violet-200';
		default:
			return 'border-border/60 bg-muted/30 text-muted-foreground';
	}
};

const getOverdueDays = (task: DetailedTask, referenceDate = new Date()) => {
	const taskEndDate = getDateValue(task.endDate);
	if (!taskEndDate || !isTaskOverdue(task, referenceDate)) return null;

	const diffInMs = referenceDate.getTime() - taskEndDate.getTime();
	return Math.max(1, Math.ceil(diffInMs / (1000 * 60 * 60 * 24)));
};

const getWeeklyDistributionStatus = (weeklyLocations: WeeklyLocationSummary[]) => {
	const topLocation = weeklyLocations[0];
	if (!topLocation) {
		return {
			label: 'غير متاح',
			detail: WEEKLY_ANALYSIS_EMPTY_STATE,
		};
	}

	if (topLocation.sharePercentage >= 60) {
		return {
			label: 'متركز',
			detail: `العمل هذا الأسبوع متركز بوضوح في ${topLocation.city}.`,
		};
	}

	if (weeklyLocations.length >= 3 && topLocation.sharePercentage <= 45) {
		return {
			label: 'متوازن',
			detail: 'النشاط موزع بشكل جيد بين المواقع النشطة.',
		};
	}

	return {
		label: 'شبه متوازن',
		detail: 'هناك موقع متقدم نسبيًا مع حضور مناسب لبقية المواقع.',
	};
};

const getWeeklyReportSummary = (weeklyLocations: WeeklyLocationSummary[]) => {
	const topLocation = weeklyLocations[0];
	if (!topLocation) return WEEKLY_ANALYSIS_EMPTY_STATE;

	if (topLocation.sharePercentage >= 60) {
		return `هذا الأسبوع كان النشاط متركزًا في ${topLocation.city} مع استقرار نسبي في بقية المواقع.`;
	}

	if (weeklyLocations.length >= 3 && topLocation.sharePercentage <= 45) {
		return 'هذا الأسبوع يظهر توزيع متوازن للنشاط مع عدم وجود مؤشرات حرجة.';
	}

	if (weeklyLocations.length === 1) {
		return `هذا الأسبوع سجل ${topLocation.city} الجزء الأكبر من الحركة التشغيلية مع حضور محدود لبقية المواقع.`;
	}

	return `هذا الأسبوع حافظت ${topLocation.city} على الصدارة مع توزيع مقبول للنشاط بين المواقع الأخرى.`;
};

const buildWeeklyHighlights = (weeklyLocations: WeeklyLocationSummary[]) => {
	if (weeklyLocations.length === 0) return [];

	const topLocation = weeklyLocations[0];
	const secondLocation = weeklyLocations[1];
	const distributionStatus = getWeeklyDistributionStatus(weeklyLocations);

	const highlights = [
		`${topLocation.city} هي الموقع الأعلى نشاطًا هذا الأسبوع.`,
		secondLocation
			? `${secondLocation.city} ${secondLocation.sharePercentage >= 25 ? 'مستقرة ولا تحتاج تدخل عاجل.' : 'أهدأ نسبيًا وتحتاج متابعة خفيفة فقط.'}`
			: 'بقية المواقع حضورها محدود مقارنة بالموقع الرئيسي.',
		distributionStatus.label === 'متوازن'
			? 'توزيع العمل هذا الأسبوع متوازن ولا توجد مؤشرات حرجة.'
			: 'توزيع العمل يميل للتركز في موقع واحد ويحتاج متابعة إدارية.',
	];

	return highlights.slice(0, 3);
};

const getWeeklyLocationDecision = (location: WeeklyLocationSummary, topSharePercentage: number) => {
	if (location.sharePercentage >= 55 || (location.sharePercentage === topSharePercentage && topSharePercentage >= 45)) {
		return {
			status: 'يحتاج مراقبة',
			reason: 'النشاط مركز بشكل واضح في هذا الموقع.',
			action: 'مراجعة توزيع المهام أو متابعة الموقع إداريًا.',
		};
	}

	if (location.activityCount <= 1 && location.totalProjects > location.activeProjects) {
		return {
			status: 'يحتاج تدخل',
			reason: 'الحضور الأسبوعي منخفض مقارنة بحجم الموقع.',
			action: 'مراجعة أسباب بطء الحركة والتأكد من عدم وجود عوائق تشغيلية.',
		};
	}

	return {
		status: 'مستقر',
		reason: 'النشاط الحالي متوازن ولا يظهر ضغط استثنائي.',
		action: 'لا يوجد إجراء عاجل مع الاستمرار في المتابعة الدورية.',
	};
};

const buildWeeklyLocationSummaries = (
	detailedProjects: DetailedProject[],
	referenceDate = new Date()
): WeeklyLocationSummary[] => {
	const cityMap = new Map<
		string,
		{
			city: string;
			activityCount: number;
			totalProjectIds: Set<string>;
			activeProjectIds: Set<string>;
			latestActivityDate: Date | null;
		}
	>();

	detailedProjects.forEach((project) => {
		const city = getNormalizedCityName(project.city);
		const current = cityMap.get(city) ?? {
			city,
			activityCount: 0,
			totalProjectIds: new Set<string>(),
			activeProjectIds: new Set<string>(),
			latestActivityDate: null,
		};

		current.totalProjectIds.add(project.id);

		(project.tasks ?? []).forEach((task) => {
			const activityDate = getTaskActivityDate(task);
			if (!activityDate || !isDateWithinWeek(activityDate, referenceDate)) {
				return;
			}

			current.activityCount += 1;
			current.activeProjectIds.add(project.id);

			if (!current.latestActivityDate || activityDate.getTime() > current.latestActivityDate.getTime()) {
				current.latestActivityDate = activityDate;
			}
		});

		cityMap.set(city, current);
	});

	const activityEntries = [...cityMap.values()].filter((entry) => entry.activityCount > 0);
	const totalActivityCount = activityEntries.reduce((sum, entry) => sum + entry.activityCount, 0);

	return activityEntries
		.map((entry) => {
			const sharePercentage = getSafePercentage(entry.activityCount, totalActivityCount);
			const statusText =
				sharePercentage >= 50
					? 'الأعلى نشاطًا هذا الأسبوع'
					: sharePercentage >= 25
						? 'أداء مستقر'
						: 'تحتاج مراقبة';
			const adminNote =
				sharePercentage >= 50
					? 'يستحسن الحفاظ على نفس وتيرة المتابعة الحالية.'
					: sharePercentage >= 25
						? 'لا توجد ملاحظات إدارية حرجة حاليًا.'
						: 'يفضل مراجعة مستوى التفاعل خلال الأيام القادمة.';

			return {
				city: entry.city,
				activityCount: entry.activityCount,
				activeProjects: entry.activeProjectIds.size,
				totalProjects: entry.totalProjectIds.size,
				sharePercentage,
				latestActivity: formatAnalyticsDate(entry.latestActivityDate),
				statusText,
				adminNote,
			};
		})
		.sort((left, right) => right.activityCount - left.activityCount || right.activeProjects - left.activeProjects);
};

const buildEmployeeAnalysisSummaries = (detailedProjects: DetailedProject[]): EmployeeAnalysisSummary[] => {
	const employeeMap = new Map<
		string,
		EmployeeAnalysisSummary & {
			projectIds: Set<string>;
			lastActivityDate: Date | null;
		}
	>();

	detailedProjects.forEach((project) => {
		const projectTasks = project.tasks ?? [];
		const completedTasks = projectTasks.filter((task) => isTaskCompleted(task.taskStatus)).length;
		const overdueTasks = projectTasks.filter((task) => isTaskOverdue(task)).length;
		const latestActivityDate = projectTasks.reduce<Date | null>((latest, task) => {
			const taskDate = getDateValue(task.updatedAt) ?? getDateValue(task.createdAt);
			if (!taskDate) return latest;
			if (!latest || taskDate.getTime() > latest.getTime()) return taskDate;
			return latest;
		}, null);

		(project.employees ?? []).forEach((employee, index) => {
			const employeeKey =
				employee.id?.trim() || employee.email?.trim() || employee.name?.trim() || `${project.id}-employee-${index}`;
			const employeeName = employee.name?.trim() || employee.email?.trim() || 'غير معروف';
			const current = employeeMap.get(employeeKey) ?? {
				id: employeeKey,
				name: employeeName,
				assignedProjects: 0,
				totalTasks: 0,
				completedTasks: 0,
				overdueTasks: 0,
				completionRate: 0,
				lastActivity: null,
				projectIds: new Set<string>(),
				lastActivityDate: null,
			};

			if (!current.projectIds.has(project.id)) {
				current.projectIds.add(project.id);
				current.assignedProjects += 1;
			}

			current.totalTasks += projectTasks.length;
			current.completedTasks += completedTasks;
			current.overdueTasks += overdueTasks;

			if (latestActivityDate && (!current.lastActivityDate || latestActivityDate.getTime() > current.lastActivityDate.getTime())) {
				current.lastActivityDate = latestActivityDate;
			}

			current.completionRate = getSafePercentage(current.completedTasks, current.totalTasks);
			current.lastActivity = formatAnalyticsDate(current.lastActivityDate);

			employeeMap.set(employeeKey, current);
		});
	});

	return [...employeeMap.values()]
		.map((entry) => ({
			id: entry.id,
			name: entry.name,
			assignedProjects: entry.assignedProjects,
			totalTasks: entry.totalTasks,
			completedTasks: entry.completedTasks,
			overdueTasks: entry.overdueTasks,
			completionRate: entry.completionRate,
			lastActivity: entry.lastActivity,
		}))
		.sort(
			(left, right) =>
				right.completionRate - left.completionRate ||
				right.completedTasks - left.completedTasks ||
				right.assignedProjects - left.assignedProjects
		);
};

const buildEmployeeAnalysisDetails = (
	detailedProjects: DetailedProject[],
	referenceDate = new Date()
) => {
	const employeeMap = new Map<
		string,
		EmployeeAnalysisDetails & {
			projectIds: Set<string>;
		}
	>();

	detailedProjects.forEach((project) => {
		const projectName = project.name?.trim() || 'غير متوفر';
		const projectTasks = project.tasks ?? [];
		const projectCompletedTasks = projectTasks.filter((task) => isTaskCompleted(task.taskStatus)).length;
		const projectOverdueTasks = projectTasks.filter((task) => isTaskOverdue(task, referenceDate)).length;

		(project.employees ?? []).forEach((employee, employeeIndex) => {
			const employeeKey =
				employee.id?.trim() || employee.email?.trim() || employee.name?.trim() || `${project.id}-employee-${employeeIndex}`;
			const employeeName = employee.name?.trim() || employee.email?.trim() || 'غير معروف';
			const current = employeeMap.get(employeeKey) ?? {
				id: employeeKey,
				name: employeeName,
				assignedTasks: [],
				completedTasks: [],
				overdueTasks: [],
				assignedProjects: [],
				projectIds: new Set<string>(),
			};

			if (!current.projectIds.has(project.id)) {
				current.projectIds.add(project.id);
				current.assignedProjects.push({
					id: project.id,
					projectName,
					totalTasks: projectTasks.length,
					completedTasks: projectCompletedTasks,
					overdueTasks: projectOverdueTasks,
				});
			}

			projectTasks.forEach((task, taskIndex) => {
				const taskDetail: EmployeeTaskDetail = {
					id: `${project.id}-${task.taskId || taskIndex}`,
					taskName: task.taskName?.trim() || 'بدون اسم',
					projectName,
					status: task.taskStatus ?? null,
					dueDate: formatAnalyticsDate(task.endDate),
					updatedAt: formatAnalyticsDate(getTaskActivityDate(task)),
					completedAt: formatAnalyticsDate(getDateValue(task.updatedAt) ?? getDateValue(task.endDate)),
					overdueDays: getOverdueDays(task, referenceDate),
					delayReason: task.notes?.trim() || null,
				};

				current.assignedTasks.push(taskDetail);

				if (isTaskCompleted(task.taskStatus)) {
					current.completedTasks.push(taskDetail);
				}

				if (isTaskOverdue(task, referenceDate)) {
					current.overdueTasks.push(taskDetail);
				}
			});

			employeeMap.set(employeeKey, current);
		});
	});

	return new Map(
		[...employeeMap.entries()].map(([employeeKey, entry]) => {
			const assignedTasks = [...entry.assignedTasks].sort((left, right) => {
				const rightDate = getDateValue(right.updatedAt)?.getTime() ?? 0;
				const leftDate = getDateValue(left.updatedAt)?.getTime() ?? 0;
				return rightDate - leftDate;
			});

			const completedTasks = [...entry.completedTasks].sort((left, right) => {
				const rightDate = getDateValue(right.completedAt)?.getTime() ?? 0;
				const leftDate = getDateValue(left.completedAt)?.getTime() ?? 0;
				return rightDate - leftDate;
			});

			const overdueTasks = [...entry.overdueTasks].sort(
				(left, right) => (right.overdueDays ?? 0) - (left.overdueDays ?? 0)
			);

			const assignedProjects = [...entry.assignedProjects].sort(
				(left, right) => right.totalTasks - left.totalTasks || right.completedTasks - left.completedTasks
			);

			return [
				employeeKey,
				{
					id: entry.id,
					name: entry.name,
					assignedTasks,
					completedTasks,
					overdueTasks,
					assignedProjects,
				},
			];
		})
	);
};

const getActivityNoteKey = ({ projectId, taskId }: Pick<ActivityActionItem, 'projectId' | 'taskId'>) =>
	`${projectId}:${taskId}`;

const ACTIVITY_NOTE_AUTHOR_PREFIX = '__activity_note_author__:';
const USE_LEGACY_ACTIVITY_CENTER = false;
const UNKNOWN_ACTIVITY_NOTE_AUTHOR = 'غير معروف';

const getActivityNoteAuthorName = (user?: SessionUserLike | null) => {
	const normalizedName = user?.name?.trim();
	if (normalizedName) return normalizedName;

	const normalizedUsername = user?.username?.trim();
	if (normalizedUsername) return normalizedUsername;

	return UNKNOWN_ACTIVITY_NOTE_AUTHOR;
};

const parseActivityNote = (note: string): ActivityNote => {
	const trimmedNote = note.trim();
	const noteLines = trimmedNote.split('\n');
	const trailingLine = noteLines.at(-1)?.trim();

	if (trailingLine?.startsWith(ACTIVITY_NOTE_AUTHOR_PREFIX)) {
		const parsedAuthorName = trailingLine.slice(ACTIVITY_NOTE_AUTHOR_PREFIX.length).trim();
		const content = noteLines.slice(0, -1).join('\n').trim();

		return {
			content: content || trimmedNote,
			authorName: parsedAuthorName || UNKNOWN_ACTIVITY_NOTE_AUTHOR,
		};
	}

	return {
		content: trimmedNote,
		authorName: UNKNOWN_ACTIVITY_NOTE_AUTHOR,
	};
};

const parseActivityNotes = (notes?: string | null) =>
	(notes ?? '')
		.split(/\n\s*\n+/)
		.map((note) => parseActivityNote(note))
		.filter(Boolean);



// const dashboardData = {
// 	overview: {
// 		totalProjects: 24,
// 		activeProjects: 18,
// 		completedProjects: 6,
// 		totalUsers: 156,
// 		// role: admin
// 		adminUsers: 3,
// 		// role: employee, moderator
// 		employeeUsers: 28,
// 		// role: client
// 		clientUsers: 125
// 	},
// 	projectsByStatus: [
// 		{ status: "in_progress", count: 12, fill: "var(--color-in_progress)" },
// 		{ status: "not_started", count: 6, fill: "var(--color-not_started)" },
// 		{ status: "completed", count: 4, fill: "var(--color-completed)" },
// 		{ status: "on_hold", count: 2, fill: "var(--color-on_hold)" }
// 	],
// 	projectsByType: [
// 		{ name: 'Villa', count: 16, percentage: 67 },
// 		{ name: 'Palace', count: 8, percentage: 33 }
// 	],
// 	cityDistribution: [
// 		{ city: 'Riyadh', projects: 10, tasks: 60 },
// 		{ city: 'Jeddah', projects: 8, tasks: 45 },
// 		{ city: 'Dammam', projects: 6, tasks: 30 },
// 		{ city: 'Mecca', projects: 12, tasks: 52 },
// 		{ city: 'Medina', projects: 4, tasks: 20 },
// 		{ city: 'Khobar', projects: 6, tasks: 23 }
// 	],
// 	monthlyProgress: [
// 		{ month: 'January', completed: 2, started: 4 },
// 		{ month: 'February', completed: 3, started: 3 },
// 		{ month: 'March', completed: 1, started: 5 },
// 		{ month: 'April', completed: 4, started: 2 },
// 		{ month: 'May', completed: 2, started: 6 },
// 		{ month: 'June', completed: 3, started: 4 }
// 	],
// 	taskMetrics: {
// 		totalTasks: 138,
// 		foundationTasks: 82,
// 		finishTasks: 56,
// 		completedTasks: 89,
// 		pendingTasks: 49
// 	},
// 	taskTypes: [
// 		{ type: "foundation", count: 82, fill: "var(--color-foundation)" },
// 		{ type: "finish", count: 56, fill: "var(--color-finish)" }
// 	],
// 	// latest 3 activities of the project it should be the latest updatedAt
// 	recentActivity: [
// 		{ project: 'Villa Heights Phase 1', status: 'completed', city: 'Riyadh', date: '2025-06-01' },
// 		{ project: 'Royal Palace Complex', status: 'in_progress', city: 'Jeddah', date: '2025-05-28' },
// 		{ project: 'Green Valley Villas', status: 'needs_review', city: 'Medina', date: '2025-05-25' },
// 	]
// };


export default function AdminDashboard() {
	const t = useTranslations();
	const { data: session } = useSession();
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const initialDashboardTab = resolveDashboardTab(
		searchParams.get('tab'),
		getAllowedDashboardTabs(null)
	);
	const [activeTab, setActiveTab] = useState<DashboardTab>(initialDashboardTab);
	const [selectedEmployeePanel, setSelectedEmployeePanel] = useState<{
		employeeId: string;
		section: EmployeeAnalysisSection;
	} | null>(null);
	const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedActionItem, setSelectedActionItem] = useState<ActivityActionItem | null>(null);
	const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
	const [noteText, setNoteText] = useState('');
	const [existingNotes, setExistingNotes] = useState('');
	const [isLoadingTaskNote, setIsLoadingTaskNote] = useState(false);
	const [isSavingNote, setIsSavingNote] = useState(false);
	const [activityNotesByTaskKey, setActivityNotesByTaskKey] = useState<Record<string, ActivityNote[]>>({});
	const [activityNotesLoadErrors, setActivityNotesLoadErrors] = useState<Record<string, boolean>>({});
	const [loadingActivityNotes, setLoadingActivityNotes] = useState<Record<string, boolean>>({});
	const [taskTimelineProjectDetails, setTaskTimelineProjectDetails] = useState<DetailedProject[]>([]);
	const [, setIsTaskTimelineLoading] = useState(false);
	const [, setTaskTimelineLoadError] = useState(false);
	const [loadedTaskTimelineProjectIdsKey, setLoadedTaskTimelineProjectIdsKey] = useState('');
	const [selectedTimelineProjectId, setSelectedTimelineProjectId] = useState("");
	const [selectedTimelineProjectDetails, setSelectedTimelineProjectDetails] = useState<DetailedProject | null>(null);
	const [isSelectedTimelineProjectLoading, setIsSelectedTimelineProjectLoading] = useState(false);
	const [selectedTimelineProjectLoadError, setSelectedTimelineProjectLoadError] = useState(false);
	const [activeTaskModal, setActiveTaskModal] = useState<null | "addTask" | "approval" | "delay">(null);
	const [approvalTaskId, setApprovalTaskId] = useState("");
	const [approvalDeadline, setApprovalDeadline] = useState("");
	const [addTaskOwnerId, setAddTaskOwnerId] = useState("");
	const [delayTaskId, setDelayTaskId] = useState("");
	const [isDelayLinkedToApproval, setIsDelayLinkedToApproval] = useState("no");
	const [linkedApprovalRequestId, setLinkedApprovalRequestId] = useState("");
	const [analysisProjectDetails, setAnalysisProjectDetails] = useState<DetailedProject[]>([]);
	const [isAnalysisDetailsLoading, setIsAnalysisDetailsLoading] = useState(false);
	const [analysisDetailsLoadError, setAnalysisDetailsLoadError] = useState(false);
	const [loadedAnalysisProjectIdsKey, setLoadedAnalysisProjectIdsKey] = useState('');
	const [projectVisibilityScope, setProjectVisibilityScope] = useState<ProjectVisibilityScope>('all');
	const noteTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
	const user = session?.user;
	const currentActivityNoteAuthor = getActivityNoteAuthorName(user as SessionUserLike | undefined);
	const { projects, fetchProjects } = useProjectStore();
	const { users, fetchUsers: fetchUsersList } = useUserStore();
	const { dir, lang } = useCheckedLocale();
	const userRole = typeof user?.role === 'string' ? user.role : null;
	const isAdmin = userRole === 'admin';
	const allowedTabs = getAllowedDashboardTabs(userRole);

	useEffect(() => {
		const getDashboard = async () => {
			try {
				const response = await axios.get<DashboardData>('/api/dashboard');
				setDashboardData(response.data);
			} catch (err) {
				console.error('Failed to fetch dashboard data:', err);
				setError('Failed to load dashboard data');
			} finally {
				setLoading(false);
			}
		};

		getDashboard();
	}, []);

	useEffect(() => {
		if (!user || user.role === "client") return;

		fetchProjects();
	}, [fetchProjects, user]);

	useEffect(() => {
		if (!user || user.role === "client") return;

		fetchUsersList();
	}, [fetchUsersList, user]);

	useEffect(() => {
		const nextAllowedTabs = getAllowedDashboardTabs(userRole);
		if (!nextAllowedTabs.includes(activeTab)) {
			setActiveTab(nextAllowedTabs[0]);
		}
	}, [activeTab, userRole]);

	useEffect(() => {
		const tabParam = searchParams.get('tab');
		const nextTab = resolveDashboardTab(
			tabParam,
			allowedTabs,
			getDefaultDashboardTab(userRole)
		);

		if (activeTab !== nextTab) {
			setActiveTab(nextTab);
		}
	}, [activeTab, allowedTabs, searchParams, userRole]);

	const activitySections: Array<{
		key: ActionCategory;
		titleKey: string;
		descriptionKey: string;
	}> = [
		{
			key: 'overdue',
			titleKey: 'activityOverdue',
			descriptionKey: 'activityOverdueDescription',
		},
		{
			key: 'client_action',
			titleKey: 'activityNeedsClientAction',
			descriptionKey: 'activityNeedsClientActionDescription',
		},
		{
			key: 'recent',
			titleKey: 'activityRecentlyUpdated',
			descriptionKey: 'activityRecentlyUpdatedDescription',
		},
	];

	const getPriorityClasses = (priority: ActionPriority) => {
		const classes: Record<ActionPriority, string> = {
			high: 'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-400/30 dark:bg-rose-950/35 dark:text-rose-200',
			medium: 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/35 dark:text-amber-200',
			low: 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/35 dark:text-emerald-200',
		};

		return classes[priority];
	};

	const showProjectVisibilityFilter = !!user && user.role !== "client";
	const visibleProjects = filterProjectsByVisibility(projects, user, projectVisibilityScope);
	const timelineProjectOptions = visibleProjects
		.map((project) => {
			const projectId =
				typeof project?.id === 'string' && project.id.trim()
					? project.id
					: typeof project?.projectId === 'string' && project.projectId.trim()
						? project.projectId
						: null;
			const projectName =
				typeof project?.name === 'string' && project.name.trim()
					? project.name.trim()
					: null;

			if (!projectId || !projectName) return null;
			return { id: projectId, name: projectName };
		})
		.filter((project): project is { id: string; name: string } => !!project);
	const visibleActionItems = buildActivityItemsFromProjects(taskTimelineProjectDetails, t);
	const taskTimelineProjectIds = visibleProjects
		.map((project) => {
			if (typeof project?.id === 'string' && project.id.trim()) return project.id;
			if (typeof project?.projectId === 'string' && project.projectId.trim()) return project.projectId;
			return null;
		})
		.filter((projectId): projectId is string => !!projectId);
	const taskTimelineProjectIdsKey = [...taskTimelineProjectIds].sort().join('|');
	const analysisProjectIds = useMemo(() => (
		isAdmin
			? projects
				.map((project) => {
					if (typeof project?.id === 'string' && project.id.trim()) return project.id;
					if (typeof project?.projectId === 'string' && project.projectId.trim()) return project.projectId;
					return null;
				})
				.filter((projectId): projectId is string => !!projectId)
			: []
	), [isAdmin, projects]);
	const analysisProjectIdsKey = [...analysisProjectIds].sort().join('|');

	useEffect(() => {
		if (
			selectedTimelineProjectId &&
			!timelineProjectOptions.some((project) => project.id === selectedTimelineProjectId)
		) {
			setSelectedTimelineProjectId("");
			setSelectedTimelineProjectDetails(null);
			setSelectedTimelineProjectLoadError(false);
		}
	}, [selectedTimelineProjectId, timelineProjectOptions]);

	useEffect(() => {
		if (!USE_LEGACY_ACTIVITY_CENTER) return;

		let isCancelled = false;
		const uniqueItems = visibleActionItems.filter(
			(item, index, items) =>
				items.findIndex((candidate) => getActivityNoteKey(candidate) === getActivityNoteKey(item)) === index
		);
		const pendingItems = uniqueItems.filter((item) => {
			const noteKey = getActivityNoteKey(item);
			return (
				activityNotesByTaskKey[noteKey] === undefined &&
				!activityNotesLoadErrors[noteKey] &&
				!loadingActivityNotes[noteKey]
			);
		});

		if (pendingItems.length === 0) {
			return () => {
				isCancelled = true;
			};
		}

		const pendingKeys = pendingItems.map((item) => getActivityNoteKey(item));
		setLoadingActivityNotes((current) => {
			const next = { ...current };
			pendingKeys.forEach((key) => {
				next[key] = true;
			});
			return next;
		});

		void Promise.allSettled(
			pendingItems.map(async (item) => {
				const response = await axios.get<{ notes?: string | null }>(`/api/projects/${item.projectId}/tasks/${item.taskId}`);
				return {
					noteKey: getActivityNoteKey(item),
					notes: parseActivityNotes(response.data.notes),
				};
			})
		)
			.then((results) => {
				if (isCancelled) return;

				const nextNotes: Record<string, ActivityNote[]> = {};
				const nextErrors: Record<string, boolean> = {};

				results.forEach((result, index) => {
					const noteKey = pendingKeys[index];
					if (result.status === 'fulfilled') {
						nextNotes[noteKey] = result.value.notes;
						nextErrors[noteKey] = false;
						return;
					}

					console.error('Failed to load activity card notes:', result.reason);
					nextErrors[noteKey] = true;
				});

				if (Object.keys(nextNotes).length > 0) {
					setActivityNotesByTaskKey((current) => ({
						...current,
						...nextNotes,
					}));
				}

				setActivityNotesLoadErrors((current) => ({
					...current,
					...nextErrors,
				}));
			})
			.finally(() => {
				if (isCancelled) return;

				setLoadingActivityNotes((current) => {
					const next = { ...current };
					pendingKeys.forEach((key) => {
						next[key] = false;
					});
					return next;
				});
			});

		return () => {
			isCancelled = true;
		};
	}, [activeTab, activityNotesByTaskKey, activityNotesLoadErrors, loadingActivityNotes, visibleActionItems]);

	useEffect(() => {
		if (!USE_LEGACY_ACTIVITY_CENTER) return;

		if (!taskTimelineProjectIdsKey) {
			setTaskTimelineProjectDetails([]);
			setLoadedTaskTimelineProjectIdsKey('');
			setTaskTimelineLoadError(false);
			return;
		}

		if (loadedTaskTimelineProjectIdsKey === taskTimelineProjectIdsKey) {
			return;
		}

		let isCancelled = false;
		setIsTaskTimelineLoading(true);
		setTaskTimelineLoadError(false);

		void Promise.allSettled(
			taskTimelineProjectIds.map(async (projectId) => {
				const response = await axios.get<DetailedProject>(`/api/projects/${projectId}`);
				return response.data;
			})
		)
			.then((results) => {
				if (isCancelled) return;

				const fulfilledProjects = results
					.filter((result): result is PromiseFulfilledResult<DetailedProject> => result.status === 'fulfilled')
					.map((result) => result.value);

				setTaskTimelineProjectDetails(fulfilledProjects);
				setTaskTimelineLoadError(fulfilledProjects.length === 0 && taskTimelineProjectIds.length > 0);

				if (fulfilledProjects.length > 0 || taskTimelineProjectIds.length === 0) {
					setLoadedTaskTimelineProjectIdsKey(taskTimelineProjectIdsKey);
				}
			})
			.finally(() => {
				if (isCancelled) return;
				setIsTaskTimelineLoading(false);
			});

		return () => {
			isCancelled = true;
		};
	}, [
		activeTab,
		loadedTaskTimelineProjectIdsKey,
		taskTimelineProjectIds,
		taskTimelineProjectIdsKey,
	]);

	useEffect(() => {
		if (activeTab !== 'tasks') return;

		if (!selectedTimelineProjectId) {
			setSelectedTimelineProjectDetails(null);
			setSelectedTimelineProjectLoadError(false);
			setIsSelectedTimelineProjectLoading(false);
			return;
		}

		let isCancelled = false;
		setIsSelectedTimelineProjectLoading(true);
		setSelectedTimelineProjectLoadError(false);

		void axios
			.get<DetailedProject>(`/api/projects/${selectedTimelineProjectId}`)
			.then((response) => {
				if (isCancelled) return;
				setSelectedTimelineProjectDetails(response.data);
				setSelectedTimelineProjectLoadError(false);
			})
			.catch((err) => {
				if (isCancelled) return;
				console.error('Failed to load selected timeline project:', err);
				setSelectedTimelineProjectDetails(null);
				setSelectedTimelineProjectLoadError(true);
			})
			.finally(() => {
				if (isCancelled) return;
				setIsSelectedTimelineProjectLoading(false);
			});

		return () => {
			isCancelled = true;
		};
	}, [activeTab, selectedTimelineProjectId]);

	useEffect(() => {
		if (!isAdmin || activeTab !== 'analysis') return;

		if (!analysisProjectIdsKey) {
			setAnalysisProjectDetails([]);
			setLoadedAnalysisProjectIdsKey('');
			setAnalysisDetailsLoadError(false);
			return;
		}

		if (loadedAnalysisProjectIdsKey === analysisProjectIdsKey) {
			return;
		}

		let isCancelled = false;
		setIsAnalysisDetailsLoading(true);
		setAnalysisDetailsLoadError(false);

		void Promise.allSettled(
			analysisProjectIds.map(async (projectId) => {
				const response = await axios.get<DetailedProject>(`/api/projects/${projectId}`);
				return response.data;
			})
		)
			.then((results) => {
				if (isCancelled) return;

				const fulfilledProjects = results
					.filter((result): result is PromiseFulfilledResult<DetailedProject> => result.status === 'fulfilled')
					.map((result) => result.value);

				setAnalysisProjectDetails(fulfilledProjects);
				setAnalysisDetailsLoadError(fulfilledProjects.length === 0);

				if (fulfilledProjects.length > 0 || analysisProjectIds.length === 0) {
					setLoadedAnalysisProjectIdsKey(analysisProjectIdsKey);
				}
			})
			.finally(() => {
				if (isCancelled) return;
				setIsAnalysisDetailsLoading(false);
			});

		return () => {
			isCancelled = true;
		};
	}, [activeTab, analysisProjectIds, analysisProjectIdsKey, isAdmin, loadedAnalysisProjectIdsKey]);

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
				<Spinner className="h-6 w-6 text-muted-foreground" />
				<span className="mx-2 text-muted-foreground">{t("Loading dashboard please wait")}...</span>
			</div>
		);

	}

	if (error) {
		return <div className="text-destructive">{error}</div>;
	}

	if (!dashboardData) {
		return null;
	}

	const safeSelectedTimelineProjectDetails = selectedTimelineProjectDetails
		? {
				...selectedTimelineProjectDetails,
				tasks: getSafeArray<DetailedTask>(selectedTimelineProjectDetails.tasks).filter(
					(task): task is DetailedTask => Boolean(task) && typeof task === "object"
				),
				employees: getSafeArray<NonNullable<DetailedProject["employees"]>[number]>(
					selectedTimelineProjectDetails.employees
				).filter((employee) => Boolean(employee) && typeof employee === "object"),
			}
		: null;
	const selectedTimelineProjectName =
		safeSelectedTimelineProjectDetails?.name ||
		timelineProjectOptions.find((project) => project.id === selectedTimelineProjectId)?.name ||
		"";
	const dashboardTimelineTasks = safeSelectedTimelineProjectDetails
		? buildDashboardTimelineTasks([safeSelectedTimelineProjectDetails])
		: [];
	const dashboardTimelineModel = createTimelineRows(
		dashboardTimelineTasks,
		safeSelectedTimelineProjectDetails?.employees ?? []
	);
	const dashboardTimelineRows = dashboardTimelineModel.timelineRows;
	const selectedProjectTasks = dashboardTimelineTasks;
	const availableProjectTasks = selectedProjectTasks.filter(
		(task): task is DashboardTimelineTask & { taskId: string; taskName: string } =>
			typeof task.taskId === 'string' &&
			task.taskId.trim().length > 0 &&
			typeof task.taskName === 'string' &&
			task.taskName.trim().length > 0
	);
	const selectedApprovalTask =
		selectedProjectTasks.find((task) => task.taskId === approvalTaskId) ?? null;
	const internalAssigneeOptions = (users ?? [])
		.filter((dashboardUser) => {
			const role = typeof dashboardUser?.role === "string" ? dashboardUser.role.toLowerCase() : "";
			return ["employee", "engineer", "moderator", "admin"].includes(role);
		})
		.map((dashboardUser) => {
			const idCandidate =
				typeof dashboardUser?.id === "string" || typeof dashboardUser?.id === "number"
					? String(dashboardUser.id)
					: typeof dashboardUser?.userId === "string" || typeof dashboardUser?.userId === "number"
						? String(dashboardUser.userId)
						: "";
			const labelCandidate = [
				typeof dashboardUser?.name === "string" ? dashboardUser.name.trim() : "",
				typeof dashboardUser?.username === "string" ? dashboardUser.username.trim() : "",
				typeof dashboardUser?.email === "string" ? dashboardUser.email.trim() : "",
			].find(Boolean);

			return {
				id: idCandidate,
				label: labelCandidate || idCandidate,
			};
		})
		.filter((dashboardUser) => dashboardUser.id && dashboardUser.label);
	const approvalPreviewTaskName =
		selectedApprovalTask?.taskName || t("Selected task");
	const approvalPreviewDeadline =
		approvalDeadline || t("Pending response date");
	const getDashboardTaskStatusText = (status?: string | null) => {
		if (typeof status !== "string" || !status.trim()) return "-";

		switch (status.trim().toLowerCase()) {
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
				return t(status.trim().toLowerCase());
			default:
				return formatStatus(status.trim());
		}
	};
	const getDashboardTaskStatusClassName = (status?: string | null) => {
		switch (status?.trim().toLowerCase()) {
			case "completed":
				return "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/35 dark:text-emerald-200";
			case "on_hold":
			case "blocked":
			case "paused":
				return "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-400/30 dark:bg-rose-950/35 dark:text-rose-200";
			case "in_progress":
			case "needs_review":
			case "working":
			case "active":
				return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/35 dark:text-amber-200";
			case "not_started":
			case "pending":
				return "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-400/30 dark:bg-slate-900/45 dark:text-slate-200";
			default:
				return "border-border/60 bg-muted/40 text-muted-foreground";
		}
	};
	const dashboardTaskHrefById = new Map(
		dashboardTimelineTasks.map((task) => [
			task.taskId,
			typeof task.taskId === 'string' && task.taskId.trim()
				? `/projects/${task.projectId}/tasks/${task.taskId}`
				: null,
		])
	);
	const taskModalOverlayClassName =
		"fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm";
	const taskModalContentClassName =
		"fixed left-1/2 top-1/2 z-[9999] w-full max-w-4xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#dac58f]/20 bg-[#111315] p-0 text-white shadow-2xl shadow-black/60";
	const taskModalFieldClassName =
		"w-full rounded-xl border border-[#dac58f]/15 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#8f8a7d] focus:border-[#dac58f]/45 focus:bg-white/[0.07] focus:ring-2 focus:ring-[#dac58f]/10";
	const taskModalSelectContentClassName =
		"z-[10001] border border-[#dac58f]/20 bg-[#111315] text-white shadow-2xl shadow-black/60";
	const taskModalLabelClassName = "mb-2 block text-sm font-medium text-[#e8dfc8]";
	const taskModalPrimaryButtonClassName =
		"rounded-xl bg-[#dac58f] px-5 py-2.5 text-sm font-semibold text-[#111315] transition hover:bg-[#e7d3a3] disabled:cursor-not-allowed disabled:opacity-50";
	const taskModalSecondaryButtonClassName =
		"rounded-xl border border-[#dac58f]/25 bg-[#dac58f]/10 px-5 py-2.5 text-sm font-semibold text-[#e8dfc8] transition hover:border-[#dac58f]/45 hover:bg-[#dac58f]/15 disabled:cursor-not-allowed disabled:opacity-50";
	const taskModalWarningButtonClassName =
		"rounded-xl border border-[rgba(201,160,168,0.26)] bg-[rgba(111,48,56,0.14)] px-5 py-2.5 text-sm font-semibold text-[#ead7d9] transition hover:border-[rgba(201,160,168,0.42)] hover:bg-[rgba(111,48,56,0.20)] disabled:cursor-not-allowed disabled:opacity-50";
	const taskModalCancelButtonClassName =
		"rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-[#b8b2a3] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white";
	const taskModalCloseButtonClassName =
		"rounded-full border border-white/10 bg-white/5 p-2 text-[#b8b2a3] transition hover:border-[#dac58f]/30 hover:bg-[#dac58f]/10 hover:text-white";
	const taskModalNoteClassName = "text-xs text-[#8f8a7d]";
	const openAddTaskModal = () => {
		console.debug("open add task modal");
		setActiveTaskModal("addTask");
	};
	const openApprovalModal = () => {
		console.debug("open approval modal");
		setActiveTaskModal("approval");
	};
	const openDelayModal = () => {
		console.debug("open delay modal");
		setActiveTaskModal("delay");
	};
	const weeklyLocationSummaries = buildWeeklyLocationSummaries(analysisProjectDetails);
	const weeklyReportSummary = getWeeklyReportSummary(weeklyLocationSummaries);
	const weeklyHighlights = buildWeeklyHighlights(weeklyLocationSummaries);
	const topWeeklyLocationShare = weeklyLocationSummaries[0]?.sharePercentage ?? 0;
	const employeeAnalysisSummaries = buildEmployeeAnalysisSummaries(analysisProjectDetails);
	const employeeAnalysisDetails = buildEmployeeAnalysisDetails(analysisProjectDetails);
	const selectedEmployeeDetails = selectedEmployeePanel
		? employeeAnalysisDetails.get(selectedEmployeePanel.employeeId) ?? null
		: null;
	const selectedEmployeeSectionMeta = selectedEmployeePanel
		? EMPLOYEE_ANALYSIS_SECTION_META[selectedEmployeePanel.section]
		: null;
	const selectedEmployeeSectionCount =
		selectedEmployeePanel && selectedEmployeeDetails
			? selectedEmployeeDetails[selectedEmployeePanel.section].length
			: 0;
	const handleActiveTabChange = (value: string) => {
		if (allowedTabs.includes(value as DashboardTab)) {
			const nextTab = value as DashboardTab;
			setActiveTab(nextTab);

			const nextParams = new URLSearchParams(searchParams.toString());
			if (nextTab === getDefaultDashboardTab(userRole)) {
				nextParams.delete('tab');
			} else {
				nextParams.set('tab', nextTab);
			}

			const nextQuery = nextParams.toString();
			router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
		}
	};

	const openAddNoteModal = async (item: ActivityActionItem) => {
		setSelectedActionItem(item);
		setNoteText('');
		setExistingNotes('');
		setIsAddNoteOpen(true);
		setIsLoadingTaskNote(true);

		try {
			const response = await axios.get<{ notes?: string | null }>(`/api/projects/${item.projectId}/tasks/${item.taskId}`);
			const normalizedNotes = response.data.notes?.trim() || '';
			setExistingNotes(normalizedNotes);
			setActivityNotesByTaskKey((current) => ({
				...current,
				[getActivityNoteKey(item)]: parseActivityNotes(normalizedNotes),
			}));
			setActivityNotesLoadErrors((current) => ({ ...current, [getActivityNoteKey(item)]: false }));
		} catch (err) {
			console.error('Failed to load task notes:', err);
			toast.error(t("activityAddNoteLoadError"));
		} finally {
			setIsLoadingTaskNote(false);
		}
	};

	const handleAddNoteSave = async () => {
		if (!selectedActionItem) return;

		const trimmedNote = noteText.trim();
		if (!trimmedNote) {
			toast.error(t("activityAddNoteEmptyError"));
			return;
		}

		setIsSavingNote(true);

		try {
			const noteEntry = [
				`[${new Date().toISOString().split('T')[0]}] ${t("activityNotePrefix")}: ${trimmedNote}`,
				`${ACTIVITY_NOTE_AUTHOR_PREFIX} ${currentActivityNoteAuthor}`,
			].join('\n');
			const appendedNotes = existingNotes ? `${noteEntry}\n\n${existingNotes}` : noteEntry;

			await axios.put(`/api/projects/${selectedActionItem.projectId}/tasks/${selectedActionItem.taskId}`, {
				notes: appendedNotes,
			});

			toast.success(t("activityAddNoteSuccess"));
			setExistingNotes(appendedNotes);
			setActivityNotesByTaskKey((current) => ({
				...current,
				[getActivityNoteKey(selectedActionItem)]: parseActivityNotes(appendedNotes),
			}));
			setActivityNotesLoadErrors((current) => ({
				...current,
				[getActivityNoteKey(selectedActionItem)]: false,
			}));
			setNoteText('');
			setIsAddNoteOpen(false);
			setSelectedActionItem(null);
		} catch (err) {
			console.error('Failed to save note:', err);
			toast.error(t("activityAddNoteSaveError"));
		} finally {
			setIsSavingNote(false);
		}
	};

	return (
		<div className="bg-background min-w-0 max-w-full space-y-4 overflow-x-hidden md:pt-4">
			{/*<div className="flex items-center justify-between">*/}
			{/*	<div>*/}
			{/*		<h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>*/}
			{/*		<p className="text-muted-foreground">Construction project management overview</p>*/}
			{/*	</div>*/}
			{/*	<Badge variant="outline" className="text-sm">*/}
			{/*		Last updated: {new Date().toLocaleDateString()}*/}
			{/*	</Badge>*/}
			{/*</div>*/}

			<Tabs value={activeTab} className="min-w-0 max-w-full gap-4 overflow-x-hidden" onValueChange={handleActiveTabChange}>
				<TabsContent value="projects" className="space-y-4">
					{activeTab === "projects" ? <DashboardWorkspace currentUser={user ?? {}} /> : null}
				</TabsContent>

				<TabsContent value="tasks" className="min-w-0 max-w-full space-y-4 overflow-hidden">
					<Tabs defaultValue="timeline" className="space-y-4">
						<Card className="relative z-10 rounded-2xl border border-border/60 bg-card shadow-sm">
							<CardHeader className="space-y-4">
								<div
									dir={dir}
									className={cn(
										"flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
										dir === "rtl" ? "text-right" : "text-left"
									)}
								>
									<div className="space-y-1">
										<CardTitle>{t("Tasks Operations Center")}</CardTitle>
										<CardDescription>
											{t("Select a project to manage tasks and timeline")}
										</CardDescription>
									</div>
									<div className="w-full max-w-sm">
										<Select value={selectedTimelineProjectId} onValueChange={setSelectedTimelineProjectId}>
											<SelectTrigger className="w-full rounded-xl border-border/60 bg-background/80 text-foreground">
												<SelectValue placeholder={t("Select a project")} />
											</SelectTrigger>
											<SelectContent>
												{timelineProjectOptions.map((project) => (
													<SelectItem key={project.id} value={project.id}>
														{project.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
								<div
									dir={dir}
									className={cn(
										"flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between",
										dir === "rtl" ? "xl:flex-row-reverse" : ""
									)}
								>
									<div
										className={cn(
											"relative z-10 flex flex-wrap gap-3 pointer-events-auto",
											dir === "rtl" ? "justify-end" : "justify-start"
										)}
									>
										<Button
											type="button"
											onClick={openAddTaskModal}
											className={taskModalPrimaryButtonClassName}
										>
											{t("Add Task")}
										</Button>
										<Button
											type="button"
											onClick={openApprovalModal}
											className={taskModalSecondaryButtonClassName}
										>
											{t("Request Client Approval")}
										</Button>
										<Button
											type="button"
											onClick={openDelayModal}
											className={taskModalWarningButtonClassName}
										>
											{t("Log Delay")}
										</Button>
									</div>
									<TabsList className="h-auto w-fit rounded-full border border-border/60 bg-muted/30 p-1">
										<TabsTrigger value="timeline" className="rounded-full px-4 py-2">
											<CalendarDays className="me-2 h-4 w-4" />
											الجدول الزمني
										</TabsTrigger>
										<TabsTrigger value="table" className="rounded-full px-4 py-2">
											<List className="me-2 h-4 w-4" />
											الجدول
										</TabsTrigger>
									</TabsList>
								</div>
							</CardHeader>
						</Card>

						{!selectedTimelineProjectId ? (
							<Card className="rounded-2xl border border-dashed border-border/60 bg-card shadow-sm">
								<CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
									{t("Select a project to view tasks and timeline")}
								</CardContent>
							</Card>
						) : isSelectedTimelineProjectLoading ? (
							<Card className="rounded-2xl border border-dashed border-border/60 bg-card shadow-sm">
								<CardContent className="flex items-center gap-2 px-6 py-6 text-sm text-muted-foreground">
									<Spinner className="h-4 w-4 text-muted-foreground" />
									<span>{t("Loading dashboard please wait")}...</span>
								</CardContent>
							</Card>
						) : selectedTimelineProjectLoadError ? (
							<Card className="rounded-2xl border border-dashed border-border/60 bg-card shadow-sm">
								<CardContent className="px-6 py-6 text-sm text-muted-foreground">
									{t("There are no tasks at this stage")}
								</CardContent>
							</Card>
						) : (
							<>
								<TabsContent value="timeline" className="mt-0">
									<Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
										<CardContent className="min-w-0 max-w-full p-4 sm:p-5 lg:p-6">
											<div className="min-w-0 max-w-full overflow-hidden">
											<TaskTimelineView
												projectId={selectedTimelineProjectId}
												title={
													lang === "ar"
														? `\u062E\u0627\u0631\u0637\u0629 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0645\u0634\u0631\u0648\u0639: ${selectedTimelineProjectName}`
														: `${t("Project Timeline")}: ${selectedTimelineProjectName}`
												}
												tasks={dashboardTimelineTasks}
												timelineRows={dashboardTimelineRows}
												projectTeam={safeSelectedTimelineProjectDetails?.employees ?? []}
												getTaskHref={(taskId) => dashboardTaskHrefById.get(taskId) ?? null}
												showWeeklyTable={false}
												compact
											/>
											</div>
										</CardContent>
									</Card>
								</TabsContent>
								<TabsContent value="table" className="mt-0">
									<Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
										<CardContent className="min-w-0 max-w-full p-0">
											<div className="overflow-x-auto">
												<table className="min-w-full divide-y divide-border/60">
													<thead className="bg-muted/30">
														<tr className={cn("text-sm", dir === "rtl" ? "text-right" : "text-left")}>
															<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">اسم المهمة</th>
															<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">النوع</th>
															<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">الحالة</th>
															<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">المسؤول</th>
															<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">المدة</th>
															<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">تاريخ البداية</th>
															<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">تاريخ النهاية / الاستحقاق</th>
															<th className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">إجراء</th>
														</tr>
													</thead>
													<tbody className="divide-y divide-border/60">
														{dashboardTimelineRows.length === 0 ? (
															<tr>
																<td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
																	{t("There are no tasks at this stage")}
																</td>
															</tr>
														) : (
															dashboardTimelineRows.map((row) => {
																if (row.rowType === "group") {
																	return (
																		<tr key={row.key} className="bg-muted/20">
																			<td colSpan={8} className="px-4 py-3">
																				<div className={cn("flex items-center justify-between gap-3", dir === "rtl" ? "flex-row-reverse" : "")}>
																					<div className="text-sm font-semibold text-foreground">{row.title}</div>
																					<span className="inline-flex rounded-full border border-border/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
																						{row.count}
																					</span>
																				</div>
																			</td>
																		</tr>
																	);
																}

																const task = row.task;
																const taskHref = dashboardTaskHrefById.get(task.id) ?? null;
																const taskTypeText = row.taskType?.trim() ? row.taskType : "-";
																const durationText = !row.hasValidSchedule
																	? "-"
																	: row.rowType === "milestone"
																		? t("Milestone")
																		: `${row.duration ?? 1}`;

																return (
																	<tr key={row.key} className="bg-background/40 transition-colors hover:bg-muted/20">
																		<td className="px-4 py-4 text-sm font-medium text-foreground">
																			<div className={cn("max-w-[20rem] truncate", dir === "rtl" ? "text-right" : "text-left")}>
																				{row.title}
																			</div>
																		</td>
																		<td className="px-4 py-4">
																			<span className="text-sm text-foreground">{taskTypeText}</span>
																		</td>
																		<td className="px-4 py-4">
																			<span
																				className={cn(
																					"inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
																					getDashboardTaskStatusClassName(row.status)
																				)}
																			>
																				{getDashboardTaskStatusText(row.status)}
																			</span>
																		</td>
																		<td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
																			{row.assignee?.trim() || "-"}
																		</td>
																		<td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
																			{durationText}
																		</td>
																		<td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
																			{row.startDate ? row.startDate.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US") : "-"}
																		</td>
																		<td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
																			{row.endDate ? row.endDate.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US") : "-"}
																		</td>
																		<td className="px-4 py-4">
																			<Button
																				type="button"
																				variant="outline"
																				size="sm"
																				onClick={() => {
																					if (taskHref) {
																						router.push(taskHref);
																					}
																				}}
																				disabled={!taskHref}
																				className="rounded-full"
																			>
																				فتح
																			</Button>
																		</td>
																	</tr>
																);
															})
														)}
													</tbody>
												</table>
											</div>
										</CardContent>
									</Card>
								</TabsContent>
							</>
						)}
					</Tabs>
				</TabsContent>

				{isAdmin && (
					<TabsContent value="analysis" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>التحليل</CardTitle>
								<CardDescription>
									عرض إداري لتحليل المدن والموظفين بالاعتماد على بيانات لوحة التحكم والمشاريع الحالية.
								</CardDescription>
							</CardHeader>
						</Card>

						<div dir={dir} className="space-y-4 text-right">
							<Card className="border border-border/70 bg-background shadow-sm">
								<CardHeader className="space-y-3">
									<div className="space-y-1">
										<CardTitle className="text-xl font-semibold">تقرير الأسبوع</CardTitle>
										<CardDescription>
											قراءة إدارية مختصرة لحالة المواقع خلال هذا الأسبوع دون تكرار تفاصيل صفحة النشاط.
										</CardDescription>
									</div>
									<p className="max-w-3xl text-sm leading-7 text-foreground/85">
										{isAnalysisDetailsLoading && weeklyLocationSummaries.length === 0
											? 'جارٍ تجهيز قراءة هذا الأسبوع...'
											: weeklyReportSummary}
									</p>
								</CardHeader>
								<CardContent className="space-y-5">
									{isAnalysisDetailsLoading && weeklyLocationSummaries.length === 0 ? (
										<div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
											<Spinner className="h-4 w-4 text-muted-foreground" />
											<span>جارٍ تحميل بيانات هذا الأسبوع...</span>
										</div>
									) : weeklyLocationSummaries.length === 0 ? (
										<div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
											{WEEKLY_ANALYSIS_EMPTY_STATE}
										</div>
									) : (
										<>
											<Card className="border border-border/60 bg-background/60 shadow-sm">
												<CardHeader>
													<CardTitle className="text-base font-semibold">تقرير المواقع الأسبوعي</CardTitle>
													<CardDescription>
														ملخص تنفيذي يركز على الاستنتاجات والقرارات الإدارية بدل الرسوم البيانية.
													</CardDescription>
												</CardHeader>
												<CardContent>
													<p className="text-sm leading-7 text-foreground/85">{weeklyReportSummary}</p>
												</CardContent>
											</Card>

											<Card className="border border-border/60 bg-background/60 shadow-sm">
												<CardHeader>
													<CardTitle className="text-base font-semibold">أبرز الملاحظات</CardTitle>
													<CardDescription>ثلاث ملاحظات سريعة تساعد على قراءة وضع المواقع هذا الأسبوع.</CardDescription>
												</CardHeader>
												<CardContent className="space-y-3">
													{weeklyHighlights.map((highlight, index) => (
														<div key={`weekly-highlight-${index}`} className="rounded-xl border border-border/50 bg-background/40 px-4 py-3">
															<p className="text-sm leading-6 text-foreground/85">{highlight}</p>
														</div>
													))}
												</CardContent>
											</Card>

											<div className="space-y-3">
												<div className="space-y-1">
													<h3 className="text-base font-semibold">قرارات مقترحة حسب الموقع</h3>
													<p className="text-sm text-muted-foreground">
														قراءة مختصرة لكل موقع مع الحالة والسبب والإجراء الإداري المقترح.
													</p>
												</div>
												<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
													{weeklyLocationSummaries.map((location) => {
														const decision = getWeeklyLocationDecision(location, topWeeklyLocationShare);

														return (
															<div key={location.city} className="rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm">
																<div className="flex items-start justify-between gap-3">
																	<div className="space-y-1">
																		<h4 className="text-sm font-semibold text-foreground">{location.city}</h4>
																		<p className="text-xs text-muted-foreground">
																			{location.latestActivity ? `آخر ظهور: ${location.latestActivity}` : 'هذا الأسبوع'}
																		</p>
																	</div>
																	<span className="rounded-full border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
																		{decision.status}
																	</span>
																</div>
																<div className="mt-4 space-y-3 text-sm">
																	<div>
																		<p className="text-xs text-muted-foreground">السبب المختصر</p>
																		<p className="mt-1 leading-6 text-foreground/85">{decision.reason}</p>
																	</div>
																	<div>
																		<p className="text-xs text-muted-foreground">القرار المقترح</p>
																		<p className="mt-1 leading-6 text-foreground/85">{decision.action}</p>
																	</div>
																</div>
															</div>
														);
													})}
												</div>
											</div>
										</>
									)}
								</CardContent>
							</Card>
						</div>

						<div className="space-y-4">
							<div className="space-y-1">
								<h3 className="text-lg font-semibold">تحليل الموظفين</h3>
								<p className="text-sm text-muted-foreground">
									يعتمد هذا القسم على المشاريع المسندة لكل موظف لأن إسناد المهمة على مستوى الفرد غير متوفر حاليًا.
								</p>
							</div>

							{isAnalysisDetailsLoading ? (
								<div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
									<Spinner className="h-4 w-4 text-muted-foreground" />
									<span>جارٍ تحميل بيانات التحليل...</span>
								</div>
							) : analysisDetailsLoadError && employeeAnalysisSummaries.length === 0 ? (
								<div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
									{ANALYTICS_EMPTY_STATE}
								</div>
							) : employeeAnalysisSummaries.length === 0 ? (
								<div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
									{ANALYTICS_EMPTY_STATE}
								</div>
							) : (
								<Card className="border border-border/70 bg-background shadow-sm">
									<CardHeader className="space-y-3">
										{selectedEmployeePanel ? (
											<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
												<div className="space-y-1">
													<CardTitle>{selectedEmployeeSectionMeta?.title ?? 'تفاصيل الموظف'}</CardTitle>
													<CardDescription>
														{selectedEmployeeDetails?.name ?? 'غير متوفر'}
														{selectedEmployeeSectionMeta ? ` • ${selectedEmployeeSectionMeta.description}` : ''}
													</CardDescription>
												</div>
												<div className="flex items-center gap-2">
													<Badge variant="outline" className="border-border/60 bg-background text-foreground">
														{selectedEmployeeSectionCount}
													</Badge>
													<Button
														type="button"
														variant="outline"
														onClick={() => setSelectedEmployeePanel(null)}
													>
														رجوع إلى أداء الموظفين
													</Button>
												</div>
											</div>
										) : (
											<>
												<CardTitle>أداء الموظفين</CardTitle>
												<CardDescription>ملخص الأداء وآخر النشاط اعتمادًا على المشاريع المسندة.</CardDescription>
											</>
										)}
									</CardHeader>
									<CardContent className="space-y-4">
										{!selectedEmployeePanel ? (
											employeeAnalysisSummaries.slice(0, 6).map((employee) => (
												<div key={employee.id} className="space-y-3 rounded-lg border border-border/60 bg-background/60 p-4">
													<div className="flex items-center justify-between gap-3">
														<div>
															<p className="text-sm font-semibold">{employee.name}</p>
															<p className="text-xs text-muted-foreground">
																آخر نشاط: {employee.lastActivity ?? 'غير متوفر'}
															</p>
														</div>
														<span className="text-sm font-semibold">{employee.completionRate}%</span>
													</div>
													<Progress
														value={employee.completionRate}
														showValueLabel={false}
														indicatorClassName={getEmployeeProgressIndicatorClassName(employee.completionRate)}
													/>
													<div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
														<button
															type="button"
															onClick={() => setSelectedEmployeePanel({ employeeId: employee.id, section: 'assignedTasks' })}
															className="block w-full rounded-md border border-border/50 px-3 py-2 text-right transition hover:border-border hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
														>
															<p className="text-xs">المهام المسندة</p>
															<p className="mt-1 font-medium text-foreground">{employee.totalTasks}</p>
														</button>
														<button
															type="button"
															onClick={() => setSelectedEmployeePanel({ employeeId: employee.id, section: 'completedTasks' })}
															className="block w-full rounded-md border border-border/50 px-3 py-2 text-right transition hover:border-border hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
														>
															<p className="text-xs">المهام المكتملة</p>
															<p className="mt-1 font-medium text-foreground">{employee.completedTasks}</p>
														</button>
														<button
															type="button"
															onClick={() => setSelectedEmployeePanel({ employeeId: employee.id, section: 'overdueTasks' })}
															className="block w-full rounded-md border border-border/50 px-3 py-2 text-right transition hover:border-border hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
														>
															<p className="text-xs">المهام المتأخرة</p>
															<p className="mt-1 font-medium text-foreground">{employee.overdueTasks}</p>
														</button>
														<button
															type="button"
															onClick={() => setSelectedEmployeePanel({ employeeId: employee.id, section: 'assignedProjects' })}
															className="block w-full rounded-md border border-border/50 px-3 py-2 text-right transition hover:border-border hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
														>
															<p className="text-xs">المشاريع المسندة</p>
															<p className="mt-1 font-medium text-foreground">{employee.assignedProjects}</p>
														</button>
													</div>
												</div>
											))
										) : !selectedEmployeeDetails || selectedEmployeeSectionCount === 0 ? (
											<div className="rounded-xl border border-dashed border-border/60 bg-background px-4 py-6 text-sm text-muted-foreground">
												{EMPLOYEE_ANALYSIS_SECTION_EMPTY_STATE}
											</div>
										) : (
											<>
												{selectedEmployeePanel.section === 'assignedTasks' &&
													selectedEmployeeDetails.assignedTasks.map((task) => (
														<div key={task.id} className="rounded-xl border border-border/60 bg-background p-4 shadow-sm">
															<div className="flex items-start justify-between gap-3">
																<div className="space-y-1">
																	<h4 className="text-sm font-semibold text-foreground">{task.taskName}</h4>
																	<p className="text-xs text-muted-foreground">{task.projectName}</p>
																</div>
																<Badge variant="outline" className={getTaskStatusBadgeClassName(task.status)}>
																	{getTaskStatusLabel(task.status)}
																</Badge>
															</div>
															<div className="mt-4 grid gap-3 sm:grid-cols-2">
																<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
																	<p className="text-xs text-muted-foreground">تاريخ الاستحقاق</p>
																	<p className="mt-1 text-sm font-medium text-foreground">{task.dueDate ?? 'غير متوفر'}</p>
																</div>
																<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
																	<p className="text-xs text-muted-foreground">آخر تحديث</p>
																	<p className="mt-1 text-sm font-medium text-foreground">{task.updatedAt ?? 'غير متوفر'}</p>
																</div>
															</div>
														</div>
													))}

												{selectedEmployeePanel.section === 'completedTasks' &&
													selectedEmployeeDetails.completedTasks.map((task) => (
														<div key={task.id} className="rounded-xl border border-border/60 bg-background p-4 shadow-sm">
															<div className="space-y-1">
																<h4 className="text-sm font-semibold text-foreground">{task.taskName}</h4>
																<p className="text-xs text-muted-foreground">{task.projectName}</p>
															</div>
															<div className="mt-4 rounded-lg border border-border/50 bg-background/70 px-3 py-2">
																<p className="text-xs text-muted-foreground">تاريخ اكتمال المهمة</p>
																<p className="mt-1 text-sm font-medium text-foreground">{task.completedAt ?? 'غير متوفر'}</p>
															</div>
														</div>
													))}

												{selectedEmployeePanel.section === 'overdueTasks' &&
													selectedEmployeeDetails.overdueTasks.map((task) => (
														<div key={task.id} className="rounded-xl border border-border/60 bg-background p-4 shadow-sm">
															<div className="flex items-start justify-between gap-3">
																<div className="space-y-1">
																	<h4 className="text-sm font-semibold text-foreground">{task.taskName}</h4>
																	<p className="text-xs text-muted-foreground">{task.projectName}</p>
																</div>
																<Badge variant="outline" className="border-rose-500/25 bg-rose-500/12 text-rose-300">
																	متأخرة
																</Badge>
															</div>
															<div className="mt-4 grid gap-3 sm:grid-cols-2">
																<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
																	<p className="text-xs text-muted-foreground">تاريخ الاستحقاق</p>
																	<p className="mt-1 text-sm font-medium text-foreground">{task.dueDate ?? 'غير متوفر'}</p>
																</div>
																<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
																	<p className="text-xs text-muted-foreground">عدد أيام التأخير</p>
																	<p className="mt-1 text-sm font-medium text-foreground">
																		{task.overdueDays !== null ? `${task.overdueDays} يوم` : 'غير متوفر'}
																	</p>
																</div>
															</div>
															<div className="mt-3 rounded-lg border border-border/50 bg-background/70 px-3 py-2">
																<p className="text-xs text-muted-foreground">سبب التأخير</p>
																<p className="mt-1 text-sm font-medium text-foreground">{task.delayReason ?? 'غير متوفر'}</p>
															</div>
														</div>
													))}

												{selectedEmployeePanel.section === 'assignedProjects' &&
													selectedEmployeeDetails.assignedProjects.map((project) => (
														<div key={project.id} className="rounded-xl border border-border/60 bg-background p-4 shadow-sm">
															<div className="space-y-1">
																<h4 className="text-sm font-semibold text-foreground">{project.projectName}</h4>
																<p className="text-xs text-muted-foreground">ملخص المشروع المرتبط بهذا الموظف</p>
															</div>
															<div className="mt-4 grid gap-3 sm:grid-cols-2">
																<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
																	<p className="text-xs text-muted-foreground">عدد المهام</p>
																	<p className="mt-1 text-sm font-medium text-foreground">{project.totalTasks}</p>
																</div>
																<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
																	<p className="text-xs text-muted-foreground">عدد المهام المكتملة</p>
																	<p className="mt-1 text-sm font-medium text-foreground">{project.completedTasks}</p>
																</div>
																<div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2 sm:col-span-2">
																	<p className="text-xs text-muted-foreground">عدد المهام المتأخرة</p>
																	<p className="mt-1 text-sm font-medium text-foreground">{project.overdueTasks}</p>
																</div>
															</div>
														</div>
													))}
											</>
										)}
									</CardContent>
								</Card>
							)}
						</div>
					</TabsContent>
				)}

				<TabsContent value="activity" className="hidden">
					{false && (
						<>
					<Card>
						<CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="space-y-1">
								<CardTitle>{t("activityCenterTitle")}</CardTitle>
								<CardDescription>{t("activityCenterDescription")}</CardDescription>
							</div>
							{showProjectVisibilityFilter && (
								<ProjectVisibilityFilter
									value={projectVisibilityScope}
									onValueChange={setProjectVisibilityScope}
								/>
							)}
						</CardHeader>
					</Card>

					{projectVisibilityScope === 'mine' && visibleProjects.length === 0 && (
						<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
							{t("No projects assigned to you yet")}
						</div>
					)}

					<div className="grid gap-4 lg:grid-cols-3">
						{activitySections.map((section) => {
							const sectionItems = visibleActionItems.filter((item) => item.category === section.key);

							return (
								<Card key={section.key} className="flex flex-col">
									<CardHeader>
										<CardTitle>{t(section.titleKey)}</CardTitle>
										<CardDescription>{t(section.descriptionKey)}</CardDescription>
									</CardHeader>
									<CardContent className="flex-1 space-y-3">
										{sectionItems.length === 0 ? (
											<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
												{t("activityEmptyState")}
											</div>
										) : (
											sectionItems.map((item) => (
												<div key={item.id} className="space-y-3 rounded-lg border p-4">
													{(() => {
														const noteKey = getActivityNoteKey(item);
														const itemNotes = activityNotesByTaskKey[noteKey] ?? [];
														const hasNotesLoadError = activityNotesLoadErrors[noteKey];
														const isNotesLoading = loadingActivityNotes[noteKey];

														return (
															<>
																<div className="space-y-3">
																	<div className="flex items-start justify-between gap-3">
																		<div className="space-y-1">
																			<p className="text-sm font-semibold">{item.projectName}</p>
																			<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
																				{t(item.labelKey)}
																			</p>
																		</div>
																		<span
																			className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${getPriorityClasses(item.priority)}`}
																		>
																			{t(item.priority === 'high' ? 'High' : item.priority === 'medium' ? 'Medium' : 'Low')}
																		</span>
																	</div>
																	<p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
																	<div className="text-xs text-muted-foreground">{item.date}</div>
																</div>
																<div className="border-t border-border/60 pt-4">
																	<div className="rounded-xl border border-border/60 bg-muted/15 p-4">
																		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
																			<div className="space-y-1">
																				<h4 className="text-sm font-semibold">{t("notes")}</h4>
																				<p className="text-xs text-muted-foreground">{t("activityAddNoteDialogDescription")}</p>
																			</div>
																			<Button
																				type="button"
																				variant="outline"
																				size="sm"
																				onClick={() => openAddNoteModal(item)}
																				className="w-full sm:w-auto"
																			>
																				{t("activityAddNote")}
																			</Button>
																		</div>
																		<div className="mt-4 space-y-2">
																			{hasNotesLoadError ? (
																				<p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
																					{t("Failed to load notes")}
																				</p>
																			) : isNotesLoading ? (
																				<div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">
																					<Spinner className="h-3.5 w-3.5 text-muted-foreground" />
																					<span>{t("Loading notes")}</span>
																				</div>
																			) : itemNotes.length === 0 ? (
																				<p className="rounded-lg border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">
																					{t("No notes yet")}
																				</p>
																			) : (
																				itemNotes.map((note, noteIndex) => (
																					<div
																						key={`${noteKey}-${noteIndex}`}
																						className="space-y-2 rounded-lg border border-border/60 bg-background/60 px-3 py-3"
																					>
																						<p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
																							{note.content}
																						</p>
																						<p className="text-xs text-muted-foreground/80">
																							{`كتبت بواسطة ${note.authorName || UNKNOWN_ACTIVITY_NOTE_AUTHOR}`}
																						</p>
																					</div>
																				))
																			)}
																		</div>
																	</div>
																</div>
															</>
														);
													})()}
												</div>
											))
										)}
									</CardContent>
								</Card>
							);
						})}
					</div>
						</>
					)}
				</TabsContent>
			</Tabs>

			{activeTaskModal === "addTask" ? (
			<Dialog
				open
				onOpenChange={(open) => !open && setActiveTaskModal(null)}
			>
				<DialogContent
					overlayClassName={taskModalOverlayClassName}
					className={taskModalContentClassName}
				>
					<div dir={dir} className={dir === "rtl" ? "text-right" : "text-left"}>
						<DialogHeader className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#dac58f]/10 bg-[#111315]/95 px-6 py-5 backdrop-blur">
							<div>
								<DialogTitle className="text-xl font-semibold text-white">{t("Add Task")}</DialogTitle>
								<DialogDescription className="mt-1 text-sm text-[#b8b2a3]">
									{t("Add a new task linked to the selected project")}
								</DialogDescription>
							</div>
							<Button type="button" variant="ghost" onClick={() => setActiveTaskModal(null)} className={taskModalCloseButtonClassName}>
								×
							</Button>
						</DialogHeader>
						<div className="space-y-5 px-6 py-6">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2 md:col-span-2">
									<label className={taskModalLabelClassName}>{t("Task Name")}</label>
									<Input className={taskModalFieldClassName} placeholder={t("Enter task name")} />
								</div>
								<div className="space-y-2 md:col-span-2">
									<label className={taskModalLabelClassName}>{t("Task Description")}</label>
									<Textarea className={`${taskModalFieldClassName} min-h-[110px] resize-y`} placeholder={t("Write a concise task description")} rows={3} />
								</div>
								<div className="space-y-2">
									<label className={taskModalLabelClassName}>{t("Task Type")}</label>
									<Select>
										<SelectTrigger className={taskModalFieldClassName}>
											<SelectValue placeholder={t("Select task type")} />
										</SelectTrigger>
										<SelectContent className={taskModalSelectContentClassName}>
											<SelectItem value="construction">{t("construction")}</SelectItem>
											<SelectItem value="architectural">{t("architectural")}</SelectItem>
											<SelectItem value="electrical">{t("electrical")}</SelectItem>
											<SelectItem value="mechanical">{t("mechanical")}</SelectItem>
											<SelectItem value="general">{t("general")}</SelectItem>
										</SelectContent>
									</Select>
								</div>
									<div className="space-y-2">
										<label className={taskModalLabelClassName}>{t("Internal Owner")}</label>
										<Select value={addTaskOwnerId} onValueChange={setAddTaskOwnerId}>
											<SelectTrigger className={taskModalFieldClassName}>
												<SelectValue placeholder={t("Select internal owner")} />
											</SelectTrigger>
											<SelectContent className={taskModalSelectContentClassName}>
												{internalAssigneeOptions.length > 0 ? (
													internalAssigneeOptions.map((internalUser) => (
														<SelectItem key={internalUser.id} value={internalUser.id}>
															{internalUser.label}
														</SelectItem>
													))
												) : (
													<SelectItem value="no-internal-users" disabled>
														{t("No internal users available")}
													</SelectItem>
												)}
											</SelectContent>
										</Select>
									</div>
								<div className="space-y-2">
									<label className={taskModalLabelClassName}>{t("Status")}</label>
									<Select>
										<SelectTrigger className={taskModalFieldClassName}>
											<SelectValue placeholder={t("Select status")} />
										</SelectTrigger>
										<SelectContent className={taskModalSelectContentClassName}>
											<SelectItem value="not_started">{t("not_started")}</SelectItem>
											<SelectItem value="in_progress">{t("in_progress")}</SelectItem>
											<SelectItem value="completed">{t("completed")}</SelectItem>
											<SelectItem value="paused">{t("paused")}</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<label className={taskModalLabelClassName}>{t("Start Date")}</label>
									<Input className={taskModalFieldClassName} type="date" />
								</div>
								<div className="space-y-2">
									<label className={taskModalLabelClassName}>{t("End Date")}</label>
									<Input className={taskModalFieldClassName} type="date" />
								</div>
								<div className="space-y-2">
									<label className={taskModalLabelClassName}>{t("Priority")}</label>
									<Select>
										<SelectTrigger className={taskModalFieldClassName}>
											<SelectValue placeholder={t("Select priority")} />
										</SelectTrigger>
										<SelectContent className={taskModalSelectContentClassName}>
											<SelectItem value="high">{t("High")}</SelectItem>
											<SelectItem value="medium">{t("Medium")}</SelectItem>
											<SelectItem value="low">{t("Low")}</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2 md:col-span-2">
									<label className={taskModalLabelClassName}>{t("Notes")}</label>
									<Textarea className={`${taskModalFieldClassName} min-h-[110px] resize-y`} placeholder={t("Task notes (optional)")} rows={4} />
								</div>
							</div>
						</div>
						<div className="sticky bottom-0 border-t border-[#dac58f]/10 bg-[#111315]/95 px-6 py-4 backdrop-blur">
							<p className={taskModalNoteClassName}>
								{t("Saving will be connected to the database in the next phase")}
							</p>
							<div
								dir={dir}
								className={cn(
									"mt-3 flex flex-wrap items-center gap-3",
									dir === "rtl" ? "justify-start" : "justify-end"
								)}
							>
								<Button type="button" disabled className={taskModalPrimaryButtonClassName}>
									{t("Save Task")}
								</Button>
								<Button type="button" variant="outline" onClick={() => setActiveTaskModal(null)} className={taskModalCancelButtonClassName}>
									{t("Cancel")}
								</Button>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
			) : null}

			{activeTaskModal === "approval" ? (
			<Dialog
				open
				onOpenChange={(open) => !open && setActiveTaskModal(null)}
			>
				<DialogContent
					overlayClassName={taskModalOverlayClassName}
					className={taskModalContentClassName}
				>
					<div dir={dir} className={dir === "rtl" ? "text-right" : "text-left"}>
						<DialogHeader className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#dac58f]/10 bg-[#111315]/95 px-6 py-5 backdrop-blur">
							<div>
								<DialogTitle className="text-xl font-semibold text-white">{t("Request Client Approval")}</DialogTitle>
								<DialogDescription className="mt-1 text-sm text-[#b8b2a3]">
									{t("Send a formal approval request linked to a project task")}
								</DialogDescription>
							</div>
							<Button type="button" variant="ghost" onClick={() => setActiveTaskModal(null)} className={taskModalCloseButtonClassName}>
								×
							</Button>
						</DialogHeader>
						<div className="space-y-5 px-6 py-6">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2 md:col-span-2">
									<label className={taskModalLabelClassName}>{t("Related Task")}</label>
									<Select value={approvalTaskId} onValueChange={setApprovalTaskId}>
										<SelectTrigger className={taskModalFieldClassName}>
											<SelectValue placeholder={t("Select related task")} />
										</SelectTrigger>
										<SelectContent className={taskModalSelectContentClassName}>
											{availableProjectTasks.map((task) => (
													<SelectItem key={task.taskId} value={task.taskId as string}>
														{task.taskName}
													</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2 md:col-span-2">
									<label className={taskModalLabelClassName}>{t("Request Title")}</label>
									<Input className={taskModalFieldClassName} placeholder={t("Enter request title")} />
								</div>
								<div className="space-y-2 md:col-span-2">
									<label className={taskModalLabelClassName}>{t("Description")}</label>
									<Textarea className={`${taskModalFieldClassName} min-h-[110px] resize-y`} placeholder={t("Describe the approval request")} rows={3} />
								</div>
								<div className="space-y-2">
									<label className={taskModalLabelClassName}>{t("Recipient Name")}</label>
									<Input className={taskModalFieldClassName} placeholder={t("Enter recipient name")} />
								</div>
								<div className="space-y-2">
									<label className={taskModalLabelClassName}>{t("Email")}</label>
									<Input className={taskModalFieldClassName} placeholder={t("Enter your email address")} type="email" />
								</div>
								<div className="space-y-2">
									<label className={taskModalLabelClassName}>{t("WhatsApp Number")}</label>
									<Input className={taskModalFieldClassName} placeholder={t("Enter WhatsApp number")} />
								</div>
								<div className="space-y-2">
									<label className={taskModalLabelClassName}>{t("Response Deadline")}</label>
									<Input
										className={taskModalFieldClassName}
										type="date"
										value={approvalDeadline}
										onChange={(event) => setApprovalDeadline(event.target.value)}
									/>
								</div>
								<div className="space-y-2 md:col-span-2">
									<label className={taskModalLabelClassName}>{t("Attachments from Craft")}</label>
									<div className="rounded-2xl border border-dashed border-[#dac58f]/18 bg-white/[0.03] px-4 py-4 text-sm text-[#b8b2a3]">
										{t("Attachments will be connected in the next phase")}
									</div>
								</div>
								<div className="space-y-3 md:col-span-2">
									<div>
										<p className="text-sm font-semibold text-[#e8dfc8]">{t("Delivery Channels")}</p>
										<p className="mt-1 text-xs text-[#8f8a7d]">
											{t("Delivery channels will be enabled after integration")}
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<Badge className="border border-[#dac58f]/20 bg-[#dac58f]/10 text-[#e8dfc8] hover:bg-[#dac58f]/10">
											{t("Email")}
										</Badge>
										<Badge className="border border-[#dac58f]/20 bg-[#dac58f]/10 text-[#e8dfc8] hover:bg-[#dac58f]/10">
											{t("WhatsApp")}
										</Badge>
										<Badge className="border border-[#dac58f]/20 bg-[#dac58f]/10 text-[#e8dfc8] hover:bg-[#dac58f]/10">
											{t("Client Portal")}
										</Badge>
									</div>
								</div>
								<div className="space-y-2 md:col-span-2">
									<label className={taskModalLabelClassName}>{t("Official Message")}</label>
									<Textarea
										className={`${taskModalFieldClassName} min-h-[110px] resize-y`}
										rows={4}
										defaultValue={t("Client approval message preview", {
											projectName: selectedTimelineProjectName || t("Selected project"),
											taskName: approvalPreviewTaskName,
											deadline: approvalPreviewDeadline,
										})}
									/>
								</div>
							</div>
							<div className="rounded-2xl border border-[#dac58f]/15 bg-[#0b0d0f] p-4 text-sm leading-7 text-[#e8dfc8]">
								<p className="mb-2 text-sm font-semibold text-[#dac58f]">
									{t("Message Preview")}
								</p>
								<p>
									{t("Client approval message preview", {
										projectName: selectedTimelineProjectName || t("Selected project"),
										taskName: approvalPreviewTaskName,
										deadline: approvalPreviewDeadline,
									})}
								</p>
							</div>
						</div>
						<div className="sticky bottom-0 border-t border-[#dac58f]/10 bg-[#111315]/95 px-6 py-4 backdrop-blur">
							<p className={taskModalNoteClassName}>
								{t("Email and WhatsApp delivery will be enabled in the next integration phase")}
							</p>
							<div
								dir={dir}
								className={cn(
									"mt-3 flex flex-wrap items-center gap-3",
									dir === "rtl" ? "justify-start" : "justify-end"
								)}
							>
								<Button type="button" disabled className={taskModalPrimaryButtonClassName}>
									{t("Send Request")}
								</Button>
								<Button type="button" variant="outline" disabled className={taskModalSecondaryButtonClassName}>
									{t("Save as Draft")}
								</Button>
								<Button type="button" variant="outline" onClick={() => setActiveTaskModal(null)} className={taskModalCancelButtonClassName}>
									{t("Cancel")}
								</Button>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
			) : null}

			{activeTaskModal === "delay" ? (
			<Dialog
				open
				onOpenChange={(open) => !open && setActiveTaskModal(null)}
			>
				<DialogContent
					overlayClassName={taskModalOverlayClassName}
					className={taskModalContentClassName}
				>
					<div dir={dir} className={dir === "rtl" ? "text-right" : "text-left"}>
						<DialogHeader className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#dac58f]/10 bg-[#111315]/95 px-6 py-5 backdrop-blur">
							<div>
								<DialogTitle className="text-xl font-semibold text-white">{t("Log Delay")}</DialogTitle>
								<DialogDescription className="mt-1 text-sm text-[#b8b2a3]">
									{t("Document the delay reason and link it to the task or client approval")}
								</DialogDescription>
							</div>
							<Button type="button" variant="ghost" onClick={() => setActiveTaskModal(null)} className={taskModalCloseButtonClassName}>
								×
							</Button>
						</DialogHeader>
						<div className="space-y-5 px-6 py-6">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2 md:col-span-2">
									<label className={taskModalLabelClassName}>{t("Related Task")}</label>
									<Select value={delayTaskId} onValueChange={setDelayTaskId}>
										<SelectTrigger className={taskModalFieldClassName}>
											<SelectValue placeholder={t("Select related task")} />
										</SelectTrigger>
										<SelectContent className={taskModalSelectContentClassName}>
											{availableProjectTasks.map((task) => (
													<SelectItem key={task.taskId} value={task.taskId as string}>
														{task.taskName}
													</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<label className={taskModalLabelClassName}>{t("Is this delay linked to a client approval?")}</label>
									<Select value={isDelayLinkedToApproval} onValueChange={setIsDelayLinkedToApproval}>
										<SelectTrigger className={taskModalFieldClassName}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent className={taskModalSelectContentClassName}>
											<SelectItem value="yes">{t("Yes")}</SelectItem>
											<SelectItem value="no">{t("No")}</SelectItem>
										</SelectContent>
									</Select>
								</div>
								{isDelayLinkedToApproval === "yes" ? (
									<div className="space-y-2">
										<label className={taskModalLabelClassName}>{t("Linked Approval Request")}</label>
										<Select value={linkedApprovalRequestId} onValueChange={setLinkedApprovalRequestId}>
											<SelectTrigger className={taskModalFieldClassName}>
												<SelectValue placeholder={t("Approval requests will appear here after integration")} />
											</SelectTrigger>
											<SelectContent className={taskModalSelectContentClassName}>
												<SelectItem value="placeholder-approval" disabled>
													{t("Approval requests will appear here after integration")}
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
								) : null}
								<div className="space-y-2 md:col-span-2">
									<label className={taskModalLabelClassName}>{t("Delay Reason")}</label>
									<Textarea className={`${taskModalFieldClassName} min-h-[110px] resize-y`} placeholder={t("Describe the delay reason")} rows={3} />
								</div>
								<div className="space-y-2">
									<label className={taskModalLabelClassName}>{t("Responsible Party")}</label>
									<Select>
										<SelectTrigger className={taskModalFieldClassName}>
											<SelectValue placeholder={t("Select responsible party")} />
										</SelectTrigger>
										<SelectContent className={taskModalSelectContentClassName}>
											<SelectItem value="client">{t("Client")}</SelectItem>
											<SelectItem value="contractor">{t("Contractor")}</SelectItem>
											<SelectItem value="supplier">{t("Supplier")}</SelectItem>
											<SelectItem value="craft">{t("craft")}</SelectItem>
											<SelectItem value="other">{t("Other")}</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<label className={taskModalLabelClassName}>{t("Expected Delay Days")}</label>
									<Input className={taskModalFieldClassName} type="number" min="0" placeholder="0" />
								</div>
								<div className="space-y-2 md:col-span-2">
									<label className={taskModalLabelClassName}>{t("Required Action")}</label>
									<Textarea className={`${taskModalFieldClassName} min-h-[110px] resize-y`} placeholder={t("Describe the required action")} rows={3} />
								</div>
								<div className="space-y-2 md:col-span-2">
									<label className={taskModalLabelClassName}>{t("Notes")}</label>
									<Textarea className={`${taskModalFieldClassName} min-h-[110px] resize-y`} placeholder={t("Task notes (optional)")} rows={3} />
								</div>
							</div>
						</div>
						<div className="sticky bottom-0 border-t border-[#dac58f]/10 bg-[#111315]/95 px-6 py-4 backdrop-blur">
							<p className={taskModalNoteClassName}>
								{t("This delay record will be connected to tasks and approval requests in the database phase")}
							</p>
							<div
								dir={dir}
								className={cn(
									"mt-3 flex flex-wrap items-center gap-3",
									dir === "rtl" ? "justify-start" : "justify-end"
								)}
							>
								<Button type="button" disabled className={taskModalWarningButtonClassName}>
									{t("Save Delay")}
								</Button>
								<Button type="button" variant="outline" onClick={() => setActiveTaskModal(null)} className={taskModalCancelButtonClassName}>
									{t("Cancel")}
								</Button>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
			) : null}

			<Dialog
				open={isAddNoteOpen}
				onOpenChange={(open) => {
					setIsAddNoteOpen(open);
					if (!open) {
						setSelectedActionItem(null);
						setNoteText('');
						setExistingNotes('');
						setIsLoadingTaskNote(false);
					}
				}}
			>
				<DialogContent
					overlayClassName="bg-black/75 backdrop-blur-md"
					onOpenAutoFocus={(event) => {
						event.preventDefault();
						noteTextareaRef.current?.focus();
					}}
					className="fixed top-1/2 left-1/2 z-[60] max-h-[calc(100vh-2rem)] w-[min(92vw,44rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-white/[0.14] p-0 text-white shadow-[0_35px_100px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(255,255,255,0.05)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[28px] before:bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_80%_90%,rgba(216,199,163,0.10),transparent_32%)] before:opacity-75 before:content-[''] after:pointer-events-none after:inset-[1px] after:absolute after:rounded-[27px] after:border after:border-white/[0.06] after:content-['']"
					style={{
						background:
							"linear-gradient(135deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.045) 35%, rgba(0,0,0,0.35) 100%)",
						backdropFilter: "blur(28px) saturate(140%)",
						WebkitBackdropFilter: "blur(28px) saturate(140%)",
					}}
				>
					<DialogHeader className="relative z-[1]">
						<DialogTitle className="px-8 pt-8 text-white">{t("activityAddNote")}</DialogTitle>
						<DialogDescription className="px-8 text-white/60">{t("activityAddNoteDialogDescription")}</DialogDescription>
					</DialogHeader>

					<div className="relative z-[1] space-y-5 overflow-y-auto px-8 py-4">
						<div className="space-y-1">
							<p className="text-sm font-medium text-white">{t("Project Name")}</p>
							<p className="text-sm text-white/60">
								{selectedActionItem?.projectName ?? ''}
							</p>
						</div>

						<div className="space-y-2">
							<p className="text-sm font-medium text-white">{t("activityNoteLabel")}</p>
							<Textarea
								ref={noteTextareaRef}
								value={noteText}
								onChange={(event) => setNoteText(event.target.value)}
								placeholder={t("activityNotePlaceholder")}
								disabled={isSavingNote}
								className="pointer-events-auto relative z-[2] min-h-40 rounded-[22px] border border-[rgba(216,199,163,0.18)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] placeholder:text-white/35 focus-visible:border-[rgba(216,199,163,0.35)] focus-visible:ring-[rgba(216,199,163,0.16)]"
							/>
						</div>
					</div>

					<DialogFooter className="relative z-[1] border-t border-white/[0.08] px-8 py-6">
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsAddNoteOpen(false)}
							disabled={isSavingNote}
							className="border-white/[0.08] bg-[rgba(255,255,255,0.04)] text-white shadow-none hover:bg-[rgba(216,199,163,0.12)] hover:text-[#d8c7a3]"
						>
							{t("Cancel")}
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={handleAddNoteSave}
							disabled={isSavingNote || isLoadingTaskNote}
							className="gap-2 border border-[rgba(216,199,163,0.45)] bg-transparent px-4 text-[#d8c7a3] shadow-[0_0_25px_rgba(216,199,163,0.18),inset_0_0_10px_rgba(216,199,163,0.05)] hover:bg-[rgba(216,199,163,0.12)] hover:text-[#d8c7a3] hover:shadow-[0_0_35px_rgba(216,199,163,0.28),inset_0_0_12px_rgba(216,199,163,0.08)]"
						>
							{isSavingNote ? t("Saving") : t("Save")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}


