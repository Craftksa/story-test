import React from 'react';
import {useTranslations} from "use-intl";
import {useCheckedLocale} from "@/lib/client-utils";

// Mock Progress component (since we're using shadcn/ui style)
const Progress = ({ value, className = "", children }: any) => (
	<div className={`w-full rounded-full h-3 ${className}`} style={{ background: "rgba(255,255,255,0.08)" }}>
		<div
			className="h-3 rounded-full transition-all duration-300 ease-in-out"
			style={{
				width: `${Math.min(100, Math.max(0, value))}%`,
				background: "linear-gradient(90deg, #D8C7A3, rgba(216,199,163,0.6))"
			}}
		>
			{children}
		</div>
	</div>
);

export const ProjectProgress = ({ project }: any) => {
	const t = useTranslations();
	const {dir} = useCheckedLocale();
	// Status background colors for progress bars
	const statusBgColors = {
		'not_started': "bg-white/18",
		'in_progress': "bg-[#BFA97E]",
		'completed': "bg-[#D8C7A3]",
		'on_hold': "bg-[#8C7A55]",
		'needs_review': "bg-[#d8c7a3]/70"
	};

	const statusLabels = {
		'not_started': 'Not Started',
		'in_progress': 'In Progress',
		'completed': 'Completed',
		'on_hold': 'On Hold',
		'needs_review': 'Needs Review'
	};

	// Calculate task statistics
	const totalTasks = project.tasks.length;
	const statusCounts = project.tasks.reduce((acc: any, task: any) => {
		acc[task.taskStatus] = (acc[task.taskStatus] || 0) + 1;
		return acc;
	}, {});

	const completedTasks = statusCounts.completed || 0;
	const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

	// Create segments for the detailed progress bar
	const segments = Object.entries(statusCounts).map(([status, count]) => ({
		status,
		count,
		percentage: (count / totalTasks) * 100,
		label: statusLabels[status],
		bgColor: statusBgColors[status]
	}));

	return (
		<div className="flex flex-col gap-4">
			{/* Overall Completion Progress */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h4 className="text-sm font-medium ">
						{t("Overall Progress")}
					</h4>
					<span className="text-sm font-medium text- ">
            {completedTasks}/{totalTasks} ({completionPercentage}%)
          </span>
				</div>

				<div className="w-full rounded-full h-4" style={{ background: "rgba(255,255,255,0.08)" }}>
					{completionPercentage !== 0 && <div
              className="text-[#111111] h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
              style={{
								width: `${completionPercentage}%`,
								background: "linear-gradient(90deg, #D8C7A3, rgba(216,199,163,0.6))"
							}}
          >
						{completionPercentage > 15 && (
							<span className="text-xs mx-2 font-medium ">
                {completionPercentage}%
              </span>
						)}
          </div>}
				</div>
			</div>

			{/* Detailed Status Distribution */}
			<div className="space-y-3">
				{/* Multi-segment Progress Bar */}
				<div className="w-full rounded-full h-4 overflow-hidden flex" style={{ background: "rgba(255,255,255,0.08)" }}>
					{segments.map((segment, index) => (
						<div
							key={segment.status}
							className={`h-full ${segment.bgColor} transition-all duration-500 ease-out ${
								index === 0 ? `${dir === 'rtl' ? 'rounded-r-full': 'rounded-l-full'}` : ''
							} ${
								index === segments.length - 1 ? `${dir === 'ltr' ? 'rounded-r-full': 'rounded-l-full'}` : ''
							}`}
							style={{ width: `${segment.percentage}%` }}
							title={`${segment.label}: ${segment.count} tasks`}
						/>
					))}
				</div>

				{/* Status Legend */}
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-4">
					{segments.map((segment) => (
						<div
							key={segment.status}
							className="flex items-center gap-2 text-xs"
						>
							<div
								className={`w-3 h-3 rounded-full ${segment.bgColor}`}
							/>
							<span className="truncate">
                {t(segment.label)} ({segment.count})
              </span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};
