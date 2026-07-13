"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Building2, Globe2, UserRound } from "lucide-react";
import { useTranslations } from "use-intl";
import StatusBadge from "@/components/StatusBadgeSystem";

type DelayCategory = "client" | "internal" | "external";
type BlockedReason = "client_approval" | "client_documents" | "internal" | "external";

type DelayReportEntry = {
	taskId: string;
	taskName: string;
	blockedReason: BlockedReason;
	category: DelayCategory;
	blockedAt: string;
	resolvedAt: string | null;
	durationDays: number;
	resolved: boolean;
};

type DelayReport = {
	projectId: string;
	totalsByCategory: Record<DelayCategory, number>;
	events: DelayReportEntry[];
};

const SUMMARY_ITEMS: { key: DelayCategory; label: string; icon: typeof UserRound }[] = [
	{ key: "client", label: "Days blocked by client", icon: UserRound },
	{ key: "internal", label: "Days blocked internally", icon: Building2 },
	{ key: "external", label: "Days blocked by external party", icon: Globe2 },
];

export function ProjectDelayReport({ projectId }: { projectId: string }) {
	const [report, setReport] = useState<DelayReport | null>(null);
	const [loading, setLoading] = useState(true);
	const t = useTranslations();

	useEffect(() => {
		let isCancelled = false;

		async function fetchDelayReport() {
			try {
				const res = await fetch(`/api/projects/${projectId}/tasks/delay-report`);
				if (!res.ok) return;
				const data = await res.json();
				if (!isCancelled) setReport(data);
			} catch (err) {
				console.error("Failed to fetch project delay report", err);
			} finally {
				if (!isCancelled) setLoading(false);
			}
		}

		fetchDelayReport();
		return () => {
			isCancelled = true;
		};
	}, [projectId]);

	if (loading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-24 w-full rounded-xl" />
				<Skeleton className="h-16 w-full rounded-xl" />
			</div>
		);
	}

	if (!report) return null;

	return (
		<Card className="rounded-none">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<AlertTriangle className="h-5 w-5 text-muted-foreground" />
					{t("Delay Report")}
				</CardTitle>
				<CardDescription>{t("Blocker Events")}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					{SUMMARY_ITEMS.map(({ key, label, icon: Icon }) => (
						<div key={key} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
							<Icon className="h-6 w-6 text-muted-foreground" />
							<div>
								<p className="text-sm font-bold">{t(label)}</p>
								<p className="text-sm text-muted-foreground">
									{report.totalsByCategory[key]} {t("days")}
								</p>
							</div>
						</div>
					))}
				</div>

				<div className="space-y-2">
					<h3 className="font-semibold">{t("Blocker Events")}</h3>
					{report.events.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							{t("No blocker events recorded for this project yet")}.
						</p>
					) : (
						<div className="space-y-2">
							{report.events.map((event, index) => (
								<div
									key={`${event.taskId}-${event.blockedAt}-${index}`}
									className="flex items-center justify-between p-3 bg-muted rounded-lg gap-4"
								>
									<div>
										<p className="text-sm font-medium">{event.taskName}</p>
										<p className="text-sm text-muted-foreground">{t(event.blockedReason)}</p>
									</div>
									<div className="text-right space-y-1">
										<p className="text-sm font-medium">
											{event.durationDays} {t("days")}
										</p>
										<StatusBadge status={event.resolved ? "Resolved" : "Ongoing"} />
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export default ProjectDelayReport;
