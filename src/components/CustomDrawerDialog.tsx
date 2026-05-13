import * as React from "react"
import {cn} from "@/lib/utils"
import {Button} from "@/components/ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/ui/dialog"
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from "@/components/ui/drawer"
import {useIsMobile} from "@/hooks/use-mobile";
import {ScrollArea} from "@/components/ui/scroll-area";


interface ResponsiveDialogDrawerProps {
	trigger: React.ReactNode;              // Custom trigger element
	title: string;                         // Dialog/Drawer title
	description?: string;                  // Dialog/Drawer description
	children?: React.ReactNode;            // Content
	isSubmitting?: boolean;                // Loading state
	submitLabel?: string;                  // Submit button text
	isOpen?: boolean;                      // Control state externally
	onOpenChange?: (open: boolean) => void;// Handle state changes
	onSubmit?: () => void;                 // Submit handler
	showSubmitButton?: boolean;            // Option to hide submit button
	dialogSize?: 'sm' | 'md' | 'lg' | 'xl';       // Dialog size variants
	className?: string;                    // Additional styling
	contentClassName?: string;             // Styling for content area
	showCloseButton?: boolean;             // Option to display close button
	ApplyScrollArea?: boolean;
}

const DialogSizes = {
	sm: 'sm:max-w-[425px]',
	md: 'sm:max-w-[600px]',
	lg: 'sm:max-w-[900px]',
	xl: 'sm:max-w-[1200px]'

};

export function CustomDrawerDialog({
	                                   trigger,
	                                   title,
	                                   description,
	                                   children,
	                                   isSubmitting = false,
	                                   submitLabel = 'Save changes',
	                                   isOpen,
	                                   onOpenChange,
	                                   onSubmit,
	                                   showSubmitButton = true,
	                                   dialogSize = 'sm',
	                                   className = '',
	                                   contentClassName = '',
	                                   showCloseButton = true,
	                                   ApplyScrollArea,
                                   }: ResponsiveDialogDrawerProps) {
	const [open, setOpen] = React.useState(false);
	const isMobile = useIsMobile();

	// Handle controlled or uncontrolled component
	const handleOpenChange = (newOpen: boolean) => {
		if (onOpenChange) {
			onOpenChange(newOpen);
		} else {
			setOpen(newOpen);
		}
	};

	// Use external state if provided
	const isCurrentlyOpen = isOpen !== undefined ? isOpen : open;

	// Submit button element
	const SubmitButton = showSubmitButton ? (
		<Button
			type="submit"
			onClick={onSubmit}
			disabled={isSubmitting}
			className="w-full md:w-auto"
		>
			{isSubmitting ? "Saving..." : submitLabel}
		</Button>
	) : null;

	// Close button element
	const CloseButton = showCloseButton ? (
		<Button variant="outline" onClick={() => handleOpenChange(false)}>
			Cancel
		</Button>
	) : null;

	// For desktop: Dialog component
	if (!isMobile) {
		return (
			<Dialog open={isCurrentlyOpen} onOpenChange={handleOpenChange}>
				<DialogTrigger asChild>
					{trigger}
				</DialogTrigger>
				<DialogContent className={cn(DialogSizes[dialogSize], className)}>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						{description && <DialogDescription>{description}</DialogDescription>}
						{showCloseButton && <DialogClose />}
					</DialogHeader>
					<div className={cn("py-4", contentClassName)}>
						<ScrollArea className={`${ApplyScrollArea && 'h-[calc(100vh-7rem)] w-full'}`}>
							{children}
						</ScrollArea>
					</div>
					{showSubmitButton && (
						<DialogFooter>
							{CloseButton}
							{SubmitButton}
						</DialogFooter>
					)}
				</DialogContent>
			</Dialog>
		);
	}

	// For mobile: Drawer component
	return (
		<Drawer open={isCurrentlyOpen} onOpenChange={handleOpenChange}>
			<DrawerTrigger asChild>
				{trigger}
			</DrawerTrigger>
			<DrawerContent className={className}>
				<DrawerHeader>
					<DrawerTitle>{title}</DrawerTitle>
					{description && <DrawerDescription>{description}</DrawerDescription>}
				</DrawerHeader>
				<div className={cn("px-4", contentClassName)}>
					<ScrollArea className={`${ApplyScrollArea && 'h-[calc(100vh-7rem)] w-full'}`}>
						{children}
					</ScrollArea>
				</div>
				<DrawerFooter>
					{CloseButton}
					{SubmitButton}
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}