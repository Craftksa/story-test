"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import {useTranslations} from "use-intl";

type Option = {
	label: string
	value: string
}

type UserComboboxProps = {
	title?: string
	options: Option[]
	placeholder?: string
	selectedValue: string
	onChange: (value: string) => void
	disabled?: boolean
}

export function UserCombobox({
	                             title = 'user',
	                             options,
	                             placeholder = "Select user...",
	                             selectedValue,
	                             onChange,
	                             disabled = false,
                             }: UserComboboxProps) {
	const [open, setOpen] = React.useState(false)
	const [searchQuery, setSearchQuery] = React.useState("")

	const selectedLabel = options.find((opt) => opt.value === selectedValue)?.label

	// Custom filtering like your working UserMultiSelector
	const filteredOptions = React.useMemo(() => {
		if (!searchQuery) return options;
		const query = searchQuery.toLowerCase();
		return options.filter((option) =>
			option.label.toLowerCase().includes(query)
		);
	}, [options, searchQuery]);

	const t = useTranslations();
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className="w-full justify-between"
				>
					{selectedLabel || placeholder}
					<ChevronsUpDown className="mx-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="p-0 max-h-[--radix-popover-content-available-height] overflow-y-auto"
				style={{ width: 'var(--radix-popover-trigger-width)' }}
			>
				<Command shouldFilter={false}>
					<CommandInput
						placeholder={`${t("Search in")} ${options.length} ${title}`}
						value={searchQuery}
						onValueChange={setSearchQuery}
					/>
					<CommandList>
						{filteredOptions.length === 0 ? (
							<CommandEmpty>{t("No")} {title} {t("found")}.</CommandEmpty>
						) : (
							<CommandGroup>
								{filteredOptions.map((option) => (
									<CommandItem
										key={option.value}
										value={option.label}
										onSelect={() => {
											onChange(option.value)
											setOpen(false)
										}}
									>
										<Check
											className={cn(
												"mr-2 h-4 w-4",
												selectedValue === option.value ? "opacity-100" : "opacity-0"
											)}
										/>
										{option.label}
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}