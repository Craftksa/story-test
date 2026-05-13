"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectVisibilityScope } from "@/lib/project-visibility";
import { useTranslations } from "use-intl";

type ProjectVisibilityFilterProps = {
	value: ProjectVisibilityScope;
	onValueChange: (value: ProjectVisibilityScope) => void;
};

export function ProjectVisibilityFilter({
	value,
	onValueChange,
}: ProjectVisibilityFilterProps) {
	const t = useTranslations();

	return (
		<Select
			value={value}
			onValueChange={(nextValue) => onValueChange(nextValue as ProjectVisibilityScope)}
		>
			<SelectTrigger size="sm" className="w-full min-w-40 bg-background sm:w-44">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="all">{t("All projects")}</SelectItem>
				<SelectItem value="mine">{t("My projects only")}</SelectItem>
			</SelectContent>
		</Select>
	);
}
