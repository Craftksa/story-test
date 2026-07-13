'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Carousel, CarouselApi, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ImageIcon, Expand, Download, Filter, Calendar as CalendarIcon } from 'lucide-react';
import { format, isToday, isYesterday, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import Image from 'next/image';
import StatusBadge from "@/components/StatusBadgeSystem";
import {useIsMobile} from "@/hooks/use-mobile";
import {useTranslations} from "use-intl";
import DeleteDialog from "@/components/DeleteDialog";
import axios from "axios";
import {toast} from "sonner";
import {useTaskStore} from "@/store/taskStore";
import {hasRole} from "@/lib/utils";
import {useSession} from "next-auth/react";

interface TaskImage {
	id: string;
	url: string;
	description?: string | null;
	uploadedAt: string;
}

interface TaskGalleryProps {
	task: { name?: string | null } | null | undefined;
	images: TaskImage[];
	onImageUpload?: (taskId: string, file: File) => void;
	onImageDelete?: (taskId: string, imageId: string) => void;
}

interface DateRange {
	from: Date | undefined;
	to: Date | undefined;
}

type FilterOption = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom' | 'all';

// Dot component for carousel indicators
const Dot = ({ count, current }: { count: number, current: number }) => {
	const [active, setActive] = React.useState(current === count + 1);

	React.useEffect(() => {
		setActive(current === count + 1);
	}, [current, count]);

	return (
		<div
			className={`h-2 w-2 rounded-full mx-1 transition-all duration-300 ${
				active ? 'bg-primary scale-125' : 'bg-muted'
			}`}
		/>
	);
};

// Image Viewer Dialog Component
const ImageViewerDialog = ({
	                           images,
	                           selectedIndex,
	                           taskName,
                           }: {
	images: TaskImage[];
	selectedIndex: number;
	taskName: string;
}) => {
	const [carouselApi, setCarouselApi] = useState<CarouselApi>();
	const [current, setCurrent] = useState(0);
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (!carouselApi) return;

		setCount(carouselApi.scrollSnapList().length);
		setCurrent(carouselApi.selectedScrollSnap() + 1);

		carouselApi.on("select", () => {
			setCurrent(carouselApi.selectedScrollSnap() + 1);
		});
	}, [carouselApi]);

	// Navigate to selected image when dialog opens
	useEffect(() => {
		if (carouselApi && selectedIndex !== null) {
			carouselApi.scrollTo(selectedIndex, true);
		}
	}, [carouselApi, selectedIndex]);

	const downloadImage = async (imageUrl: string, imageName: string) => {
		try {
			const response = await fetch(imageUrl);
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = imageName || 'task-image.jpg';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Error downloading image:', error);
		}
	};

	const t = useTranslations();
	const isMobile = useIsMobile();

	if (images.length === 0) return null;

	return (
		<DialogContent className="md:min-h-[100vh] min-h-[85vh] max-w-[calc(100%)] m-0 md:min-w-[80vw] p-2">
			<DialogHeader>
				<DialogTitle className="flex items-center justify-between p-0 mx-4 md:mr-10 mr-14 ">
					<span className="md:text-base text-xs">{t("Task Images")} - ({current} {t("of")} {count})</span>
					<Button
						className="md:h-auto h-9"
						variant="outline"
						size={isMobile ? "sm" : "icon"}
						onClick={() =>
							downloadImage(
								images[current - 1]?.url || images[0].url,
								`Task_${taskName}_IMG_${String(current).padStart(2, '0')}`
							)
						}
					>
						<Download className="md:size-4 size-5 opacity-70 " />
					</Button>
				</DialogTitle>
			</DialogHeader>

			<div className="flex flex-col items-center space-y-4">
				{images.length > 1 ? (
					<>
						<Carousel setApi={setCarouselApi} className=" z-50">
							<CarouselContent className="p-0 md:w-auto w-[90vw] m-0">
								{images.map((image) => (
									<CarouselItem key={image.id} className="p-0 md:w-auto w-[90vw] m-0">
										<div className="flex md:w-auto w-[90vw] flex-col items-center space-y-2">
											<div className="relative overflow-hidden rounded-lg">
												<img
													src={image.url}
													alt={image.description || 'Task image'}
													className="max-w-full max-h-[80vh] object-contain"
												/>
											</div>
											<div className="text-center space-y-1 max-w-md">
												{image.description && (
													<p className="text-sm text-muted-foreground">{image.description}</p>
												)}
												<p className="text-xs text-muted-foreground">
													{t("Uploaded on")} {format(parseISO(image.uploadedAt), 'MMM d, yyyy \'at\' HH:mm')}
												</p>
											</div>
										</div>
									</CarouselItem>
								))}
							</CarouselContent>
							<div className="hidden sm:block">
								<CarouselPrevious />
								<CarouselNext />
							</div>
						</Carousel>

						{/* Dots indicator */}
						<div className="flex flex-wrap gap-1 items-center justify-center">
							{[...Array(count)].map((_, i) => (
								<Dot key={i} count={i} current={current} />
							))}
						</div>
					</>
				) : (
					<div className="flex flex-col md:w-auto w-[90vw] items-center space-y-2">
						<div className="relative overflow-hidden rounded-lg">
							<img
								src={images[0].url}
								alt={images[0].description || 'Task image'}
								className="max-w-full max-h-[80vh] object-contain"
							/>
						</div>
						<div className="text-center space-y-1 max-w-md">
							{images[0].description && (
								<p className="text-sm text-muted-foreground">{images[0].description}</p>
							)}
							<p className="text-xs text-muted-foreground">
								{t("Uploaded on")} {format(parseISO(images[0].uploadedAt), 'MMM d, yyyy \'at\' HH:mm')}
							</p>
						</div>
					</div>
				)}
			</div>
		</DialogContent>
	);
};

export const TaskGallery: React.FC<TaskGalleryProps> = ({
	                                                        task,
	                                                        images,
                                                        }) => {
	const [filterOption, setFilterOption] = useState<FilterOption>('all');
	const [customDateRange, setCustomDateRange] = useState<DateRange>({ from: undefined, to: undefined });
	const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const t = useTranslations();

	const {data: session} = useSession();

	const user = session?.user;

	const filteredImages = useMemo(() => {
		const now = new Date();

		return images.filter(image => {
			const uploadDate = parseISO(image.uploadedAt);

			switch (filterOption) {
				case 'today':
					return isToday(uploadDate);
				case 'yesterday':
					return isYesterday(uploadDate);
				case 'last7days':
					const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
					return isAfter(uploadDate, sevenDaysAgo);
				case 'last30days':
					const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
					return isAfter(uploadDate, thirtyDaysAgo);
				case 'custom':
					if (!customDateRange.from) return true;
					const fromDate = startOfDay(customDateRange.from);
					const toDate = customDateRange.to ? endOfDay(customDateRange.to) : endOfDay(customDateRange.from);
					return isAfter(uploadDate, fromDate) && isBefore(uploadDate, toDate) ||
						uploadDate.getTime() === fromDate.getTime() ||
						uploadDate.getTime() === toDate.getTime();
				case 'all':
				default:
					return true;
			}
		});
	}, [images, filterOption, customDateRange]);

	const groupedImages = useMemo(() => {
		const groups: { [key: string]: TaskImage[] } = {};

		filteredImages.forEach(image => {
			const uploadDate = parseISO(image.uploadedAt);
			let groupKey: string;

			if (isToday(uploadDate)) groupKey = 'Today';
			else if (isYesterday(uploadDate)) groupKey = 'Yesterday';
			else groupKey = format(uploadDate, 'MMM d, yyyy');

			if (!groups[groupKey]) groups[groupKey] = [];
			groups[groupKey].push(image);
		});

		return Object.entries(groups).sort(([a], [b]) => {
			if (a === 'Today') return -1;
			if (b === 'Today') return 1;
			if (a === 'Yesterday') return -1;
			if (b === 'Yesterday') return 1;
			return new Date(b).getTime() - new Date(a).getTime();
		});
	}, [filteredImages]);

	const handleFilterChange = (value: FilterOption) => {
		setFilterOption(value);
		if (value !== 'custom') {
			setCustomDateRange({ from: undefined, to: undefined });
		}
	};

	const getFilterDisplayName = () => {
		switch (filterOption) {
			case 'today': return 'Today';
			case 'yesterday': return 'Yesterday';
			case 'last7days': return 'Last 7 days';
			case 'last30days': return 'Last 30 days';
			case 'custom': return customDateRange.from ?
				`${format(customDateRange.from, 'MMM d')}${customDateRange.to ? ` - ${format(customDateRange.to, 'MMM d')}` : ''}` :
				'Custom range';
			case 'all': return 'All time';
			default: return 'Today';
		}
	};

	const {removeImageFromTask} = useTaskStore();

	const handleDelete = async (image: TaskImage) => {
		try {
			const response = await axios.delete(`/api/uploadthing/${image.id}`);

			if (response.status === 200) {
				toast.success('Image deleted successfully');
				removeImageFromTask(image.id)
			} else {
				toast.error('Failed to delete the image');
			}
		} catch (error) {
			toast.error('Something went wrong while deleting');
			console.error(error);
		}
	};
	const isMobile = useIsMobile();

	if (images.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted rounded-lg">
				<ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
				<p className="text-muted-foreground text-sm">{t("No images available for this task")}</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Filter Controls */}
			<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
				<div className="flex items-center gap-2">
					<Filter className="h-4 w-4 text-muted-foreground" />
					<Select value={filterOption} onValueChange={handleFilterChange}>
						<SelectTrigger className="w-40" size="sm">
							<SelectValue placeholder="Filter by date" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="today">{t("Today")}</SelectItem>
							<SelectItem value="yesterday">{t("Yesterday")}</SelectItem>
							<SelectItem value="last7days">{t("Last 7 days")}</SelectItem>
							<SelectItem value="last30days">{t("Last 30 days")}</SelectItem>
							<SelectItem value="custom">{t("Custom range")}</SelectItem>
							<SelectItem value="all">{t("All time")}</SelectItem>
						</SelectContent>
					</Select>

					{filterOption === 'custom' && (
						<Popover open={showCustomDatePicker} onOpenChange={setShowCustomDatePicker}>
							<PopoverTrigger asChild>
								<Button variant="outline" size="sm">
									<CalendarIcon className="h-4 w-4 mx-2" />
									{t(getFilterDisplayName())}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="range"
									selected={customDateRange}
									onSelect={(range) => {
										if (!range?.from) {
											setCustomDateRange({ from: undefined, to: undefined });
											return;
										}
										const to = range.to ?? range.from;
										setCustomDateRange({ from: range.from, to });
									}}
									numberOfMonths={2}
								/>
							</PopoverContent>
						</Popover>
					)}
				</div>
			</div>

			<div className="flex items-center justify-between text-sm text-muted-foreground">
				<span>
					{t("Showing")} {filteredImages.length} {filteredImages.length !== 1 ? `${t("images")}` : `${t("image")}`} {t("for")} {t(getFilterDisplayName())}
				</span>
			</div>

			{/* Grouped Images */}
			{groupedImages.length > 0 ? (
				<div className="space-y-6">
					{groupedImages.map(([groupName, groupImages]) => (
						<div key={groupName} className="space-y-3">
							<div className="flex items-center gap-2">
								<h3 className="text-lg font-semibold">{groupName}</h3>
								<Badge variant="secondary" className="text-xs">
									{groupImages.length} {groupImages.length !== 1 ? `${t("images")}` : `${t("image")}`}
								</Badge>
							</div>

							<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
								{groupImages.map((image, index) => {
									const globalIndex = filteredImages.findIndex(img => img.id === image.id);
									return (
										<div className="relative" key={image.id}>
											<Dialog>
												<DialogTrigger asChild>
													<Card className="overflow-hidden group relative cursor-pointer ">
														<button
															type="button"
															className="relative w-full h-full aspect-square"
														>
															<Image
																width={1000}
																height={1000}
																src={image.url}
																alt={image.description || `Task image ${index + 1}`}
																className="w-full h-full object-cover transition-transform group-hover:scale-105"
															/>
															<div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
																<Expand className="h-5 w-5 text-white" />
															</div>
															<div className="absolute top-2 right-2 text-xs">
																<StatusBadge
																	status={format(parseISO(image.uploadedAt), 'hh:mm a')}
																	color={'black'}
																/>
															</div>
															<div className="absolute top-2 left-2 text-xs">
																<StatusBadge status={`#${index + 1}`} color={'black'} />
															</div>

															{!isMobile && image.description && (
																<div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-xs">
																	{image.description}
																</div>
															)}
														</button>

													</Card>
												</DialogTrigger>
												<ImageViewerDialog
													images={filteredImages}
													selectedIndex={globalIndex}
													taskName={task?.name || 'Task'}
												/>
											</Dialog>
											{hasRole(user, ["admin", "employee", "moderator"]) && <div className="absolute z-50 bottom-2 left-2 text-xs">
                          <DeleteDialog
                              isDeleting={deleting}
                              className="px-2 gap-2 text-destructive w-8 h-8 rounded-full hover:bg-muted my-1"
                              onCancel={() => setDeleting(false)}
                              onConfirm={() => handleDelete(image)}
                          />
                      </div>}
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted rounded-lg">
					<ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
					<p className="text-muted-foreground text-sm">
						{t("No images found for")} {t(getFilterDisplayName())}. {t("Try a different date range")}.
					</p>
				</div>
			)}
		</div>
	);
};