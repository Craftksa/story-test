"use client"

import * as React from "react"
import { X, ChevronsUpDown, Check } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import {useTranslations} from "use-intl";

type Option = {
	label: string
	value: string
}

type UserMultiSelectorProps = {
	title?: string
	options: Option[]
	placeholder?: string
	selectedValues: string[]
	onChange: (values: string[]) => void
	disabled?: boolean
}

export function UserMultiSelector({
	                                  title = "user",
	                                  options,
	                                  placeholder = "Select users...",
	                                  selectedValues,
	                                  onChange,
	                                  disabled = false,
                                  }: UserMultiSelectorProps) {
	const [open, setOpen] = React.useState(false)
	const [searchQuery, setSearchQuery] = React.useState("")

	const selectedOptions = options.filter(opt => selectedValues.includes(opt.value))

	// Custom filtering like your working CustomComboBox
	const filteredOptions = React.useMemo(() => {
		if (!searchQuery) return options;
		const query = searchQuery.toLowerCase();
		return options.filter((option) =>
			option.label.toLowerCase().includes(query)
		);
	}, [options, searchQuery]);

	const toggleSelection = (value: string) => {
		if (selectedValues.includes(value)) {
			onChange(selectedValues.filter(v => v !== value))
		} else {
			onChange([...selectedValues, value])
		}
	}

	const removeSelection = (value: string, e: React.SyntheticEvent) => {
		e.preventDefault()
		e.stopPropagation()
		onChange(selectedValues.filter(v => v !== value))
	}

	const t = useTranslations();
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className="w-full flex-wrap justify-between gap-2 min-h-[2.5rem]"
				>
					{selectedOptions.length > 0 ? (
						<div className="flex flex-wrap gap-1">
							{selectedOptions.map((option) => (
								<Badge
									key={option.value}
									variant="secondary"
									className="flex items-center gap-1 px-2 "
								>
									{option.label}
									<div
										className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												removeSelection(option.value, e)
											}
										}}
										onMouseDown={(e) => removeSelection(option.value, e)}
										onClick={(e) => removeSelection(option.value, e)}
									>
										<X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
									</div>
								</Badge>
							))}
						</div>
					) : (
						<span className="text-muted-foreground">{placeholder}</span>
					)}
					<ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
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
										onSelect={() => toggleSelection(option.value)}
									>
										<Check
											className={cn(
												"mr-2 h-4 w-4",
												selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
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