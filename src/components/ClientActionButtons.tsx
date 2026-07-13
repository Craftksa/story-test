import React from 'react';
import {ClipboardCheck, ClipboardList, FileTextIcon} from "lucide-react";
import {useTranslations} from "use-intl";
import {Button} from "@/components/ui/button";
import {useRouter} from "next/navigation";

const ClientActionButtons = ({projectId}: { projectId: string }) => {
	const router = useRouter();
	const t=  useTranslations();
	return (
		<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
			<Button onClick={() => router.push(`/projects/${projectId}/tasks?type=foundations`)}
			        className="gap-2 py-4 h-auto w-full px-6 ">
				<ClipboardList className="size-5 min-w-5"/>
				<p className="font-bold">{t("Foundations Tasks")}</p>
			</Button>
			<Button onClick={() => router.push(`/projects/${projectId}/tasks?type=finishes`)}
			        className="gap-2 py-4 h-auto w-full px-6 ">
				<ClipboardCheck className="size-5 min-w-5"/>
				<p className="font-bold">{t("Finishes Tasks")}</p>
			</Button>
			<Button
				onClick={() => router.push(`/projects/${projectId}/contracts`)}
				className="gap-2 py-4 h-auto w-full px-6">
				<FileTextIcon className="size-5 min-w-5"/>
				<p className="font-bold">{t("Contracts")}</p>
			</Button>
			{/*<Button variant="outline" className="gap-2 py-4 h-auto w-full px-6">*/}
			{/*	<Users className="size-5 min-w-5"/>*/}
			{/*	<p className="font-bold">{t("Meetings")}</p>*/}
			{/*</Button>*/}
		</div>
	);
};

export default ClientActionButtons;