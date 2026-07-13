import React from 'react';
import {CalendarIcon} from "@radix-ui/react-icons";
import {format} from "date-fns";
import {Button} from "@/components/ui/button";
import {Calendar} from "@/components/ui/calendar";
import {Popover, PopoverContent, PopoverTrigger,} from "@/components/ui/popover";
import {cn} from "@/lib/utils";

interface CustomDatePickerProps {
	value: Date | undefined;
	onChange: (date: Date | undefined) => void;
	label?: string;
	className?: string;
	placeholder?: string;
}

export function CustomDatePicker({ value, onChange, className, placeholder = "Pick a date" }: CustomDatePickerProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant={"outline"}
					className={cn(
						"w-full flex gap-2 justify-between pl-3 text-left font-normal",
						!value && "text-muted-foreground",
						className
					)}
				>
					{value ? (
						format(value, "PPP")
					) : (
						<span>{placeholder}</span>
					)}
					<CalendarIcon className=" h-4 w-4 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={value}
					onSelect={onChange}
					initialFocus
				/>
			</PopoverContent>
		</Popover>
	);
}