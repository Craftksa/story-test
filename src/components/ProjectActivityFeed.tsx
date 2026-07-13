"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {RefreshCcw, FilePlus2, ImagePlus} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "use-intl";
import StatusBadge from "@/components/StatusBadgeSystem";
import CustomLink from "@/components/CustomLink";
import {ar, enUS} from "date-fns/locale";
import {useCheckedLocale} from "@/lib/client-utils";

type ActivityItem = {
	taskId: string;
	taskName: string;
	createdAt: string;
	updatedAt: string | null;
	latestImageUpload: string | null;
};

export function ProjectActivityFeed({ projectId }: { projectId: string }) {
	const [activities, setActivities] = useState<ActivityItem[] | null>(null);
	const [loading, setLoading] = useState(true);
	const t = useTranslations();
	const {lang} = useCheckedLocale();

	useEffect(() => {
		async function fetchActivities() {
			try {
				const res = await fetch(`/api/projects/${projectId}/activity`);
				const data = await res.json();
				setActivities(data);
			} catch (err) {
				console.error("Failed to fetch activity", err);
			} finally {
				setLoading(false);
			}
		}

		fetchActivities();
	}, [projectId]);

	if (loading) {
		return (
			<div className="space-y-4">
				{[...Array(5)].map((_, i) => (
					<Skeleton key={i} className="h-16 w-full rounded-xl" />
				))}
			</div>
		);
	}

	if (!activities || activities.length === 0) {
		return <p className="text-sm text-muted-foreground">{t("No recent activity")}.</p>;
	}

	const getLastActivity = (a: ActivityItem) => {
		const created = new Date(a.createdAt);
		const updated = a.updatedAt ? new Date(a.updatedAt) : null;
		const uploaded = a.latestImageUpload ? new Date(a.latestImageUpload) : null;

		let latestTime = created;
		let activityType = "New Task Created";

		if (updated && updated > latestTime) {
			latestTime = updated;
			activityType = "Task Updated";
		}

		if (uploaded && uploaded > latestTime) {
			latestTime = uploaded;
			activityType = "New Image Uploaded";
		}

		return { type: activityType, time: latestTime };
	};

	const locale = lang === "ar" ? ar : enUS;

	return (
		<div className="space-y-4">
			{activities.map((activity) => {
				const last = getLastActivity(activity);

				const Icon =
					last.type === "New Task Created" ? FilePlus2 :
						last.type === "Task Updated" ? RefreshCcw :
							ImagePlus;

				return (
					<div className="" key={activity.taskId}>
						<Card className="md:p-2">
							<CardContent className="flex sm:flex-row flex-col items-center sm:gap-4 gap-2 md:p-2">
                <span className="bg-primary/10 p-2 rounded-full">
                  <Icon className="w-5 h-5 text-primary"/>
                </span>
								<span className="sm:hidden block pb-2">
                  <StatusBadge status={t(last.type)} />
                </span>

								<div className="flex flex-col">
									<div className="font-medium flex items-center sm:justify-start justify-center gap-4">
										<CustomLink
											href={`/projects/${projectId}/tasks/${activity.taskId}`}
											className="text-foreground text-sm"
										>
											{activity.taskName}
										</CustomLink>
									</div>
									<span className="text-sm text-muted-foreground">
										{last.type === "New Image Uploaded" ? t("Recently uploaded") : formatDistanceToNow(last.time, { addSuffix: true, locale: locale } )}
                  </span>
								</div>
								<span className="sm:block hidden">
                  <StatusBadge status={t(last.type)} />
                </span>
							</CardContent>
						</Card>
					</div>
				);
			})}
		</div>
	);
}