import React, {useEffect, useRef} from "react"
import {
	Cell,
	Column,
	ColumnDef,
	ColumnFiltersState,
	FilterMeta,
	flexRender,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	Row,
	SortingState,
	Table as ReactTable,
	useReactTable,
} from "@tanstack/react-table"
import {Skeleton} from "@/components/ui/skeleton"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {ScrollArea, ScrollBar} from "@/components/ui/scroll-area"
import {useSidebar} from "@/components/ui/sidebar";
import {Button} from "./ui/button"
import {Input} from "./ui/input"
import {ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon} from "lucide-react"
import {rankItem} from "@tanstack/match-sorter-utils"
import {
	CaretSortIcon,
	Cross2Icon,
	DoubleArrowLeftIcon,
	DoubleArrowRightIcon,
	EyeNoneIcon,
	MixerHorizontalIcon,
	PlusCircledIcon
} from "@radix-ui/react-icons"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "./ui/select"
import {useIsMobile} from "@/hooks/use-mobile";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {useCheckedLocale} from "@/lib/client-utils";
import {useTranslations} from "use-intl";
import StatusBadge from "@/components/StatusBadgeSystem"

function fuzzyFilter<TData>(row: Row<TData>, columnId: string, value: string, addMeta: (meta: FilterMeta) => void) {
	const itemRank = rankItem(row.getValue(columnId), value)
	addMeta({itemRank})
	return itemRank.passed
}

export function DataTableColumnHeader<TData>({column, title, className}: {column: Column<TData, unknown>; title: string; className?: string}) {
	const t = useTranslations();

	if (!column.getCanSort()) {
		return <div>{title}</div>
	}

	return (
		<div className={`${className} flex items-center space-x-2`}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="-ml-3 h-8 print:text-base data-[state=open]:bg-accent"
					>
						<span className="capitalize">{t(title)}</span>
						{column.getIsSorted() === "desc" ? (
							<ArrowDownIcon className="print:hidden mx-2 h-4 w-4"/>
						) : column.getIsSorted() === "asc" ? (
							<ArrowUpIcon className="print:hidden mx-2 h-4 w-4"/>
						) : (
							<CaretSortIcon className="print:hidden mx-2 h-4 w-4"/>
						)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuItem onClick={() => column.toggleSorting(false)}>
						<ArrowUpIcon className="mx-2 h-3.5 w-3.5 text-muted-foreground/70"/>
						{t("Asc")}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => column.toggleSorting(true)}>
						<ArrowDownIcon className="mx-2 h-3.5 w-3.5 text-muted-foreground/70"/>
						{t("Desc")}
					</DropdownMenuItem>
					<DropdownMenuSeparator/>
					<DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
						<EyeNoneIcon className="mx-2 h-3.5 w-3.5 text-muted-foreground/70"/>
						{t("Hide")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}


type FacetedFilterOption = { label: string; value: string; default?: boolean };

export function DataTableFacetedFilter<TData>({column, title, options}: {column: Column<TData, unknown>; title: string; options: FacetedFilterOption[]}) {
	const selectedValue = column?.getFilterValue()
	const hasSetDefault = useRef(false)

	useEffect(() => {
		if (!hasSetDefault.current && !selectedValue) {
			const defaultOption = options.find((opt) => opt.default)
			if (defaultOption) {
				column?.setFilterValue(defaultOption.value)
				hasSetDefault.current = true
			}
		}
	}, [column, options, selectedValue])
	const t = useTranslations();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="h-8 border-dashed">
					{!selectedValue &&
              <span className="flex gap-0.5 items-center">
								<PlusCircledIcon className="sm:mx-2 mx-1 h-4 w-4"/>
								{t(title)}
							</span>
					}
					{!!selectedValue && (
						<>
							<div className="md:block hidden">
								<StatusBadge status={t(options.find((opt) => opt.value === selectedValue)?.label ?? '')} />
							</div>
							<span className="md:hidden block px-1 text-xs bg-primary">{t(options.find((opt) => opt.value === selectedValue)?.label ?? '')}</span>
						</>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-[200px] p-0" align="start">
				{options.map((option) => {
					const isSelected = selectedValue === option.value
					return (
						<DropdownMenuCheckboxItem
							key={option.value}
							className="capitalize"
							checked={isSelected}
							onCheckedChange={(checked) => {
								column?.setFilterValue(
									checked ? option.value : undefined
								)
							}}
						>
							{t(option.label)}
						</DropdownMenuCheckboxItem>
					)
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function DataTablePagination<TData>({table}: {table: ReactTable<TData> | null}) {
	const t = useTranslations();

	if (!table) {
		return <div>Loading table...</div>;
	}


	return (
		<div className="print:hidden md:border-0 border-t md:pt-0 pt-4 ">
			{/*<div className="md:block hidden text-sm text-muted-foreground">*/}
			{/*  {table.getFilteredSelectedRowModel().rows.length} of{" "}*/}
			{/*  {table.getFilteredRowModel().rows.length} row(s) selected.*/}
			{/*</div>*/}

			<div className="flex items-center justify-between gap-2 lg:gap-4">
				<div className="flex items-center gap-2 lg:gap-4">
					<Select
						value={`${table.getState().pagination.pageSize}`}
						onValueChange={(value) => {
							table.setPageSize(Number(value))
						}}
					>
						<SelectTrigger size="sm" className="w-[60px] px-2 bg-background">
							<SelectValue placeholder={table.getState().pagination.pageSize}/>
						</SelectTrigger>
						<SelectContent side="top">
							{[10, 20, 30, 40, 50].map((pageSize) => (
								<SelectItem key={pageSize} value={`${pageSize}`}>
									{pageSize}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-sm font-medium md:block hidden">{t('Rows per page')}</p>
				</div>
				<div>
					<Button dir={'ltr'} content="Rows" variant="simple"
					        className="flex border rounded-full px-1 items-center h-0 text-muted-foreground justify-center text-xs font-medium">
						{table.getFilteredRowModel().rows.length}
						<span
							className="md:inline-block mx-1 hidden">{table.getFilteredRowModel().rows.length === 1 ? `${t('Row')}` : `${t('Rows')}`}</span>
					</Button>
				</div>
				<div>
					<Button dir={'ltr'} content="Pages" variant="simple"
					        className="flex border rounded-full px-1 items-center h-0 text-muted-foreground justify-center text-xs font-medium">
            <span
	            className="md:inline-block mx-1 hidden">{t('Page')}</span> {table.getState().pagination.pageIndex + 1}, {t('of')}{" "}
						{table.getPageCount()}
					</Button>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						className="flex h-8 w-8 p-0 "
						onClick={() => table.setPageIndex(0)}
						disabled={!table.getCanPreviousPage()}
					>
						<span className="sr-only">Go to first page</span>
						<DoubleArrowLeftIcon className="h-4 w-4"/>
					</Button>
					<Button
						variant="outline"
						className="h-8 w-8 p-0"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<span className="sr-only">Go to previous page</span>
						<ChevronLeftIcon className="h-4 w-4"/>
					</Button>
					<Button
						variant="outline"
						className="h-8 w-8 p-0"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						<span className="sr-only">Go to next page</span>
						<ChevronRightIcon className="h-4 w-4"/>
					</Button>
					<Button
						variant="outline"
						className="flex h-8 w-8 p-0"
						onClick={() => table.setPageIndex(table.getPageCount() - 1)}
						disabled={!table.getCanNextPage()}
					>
						<span className="sr-only">Go to last page</span>
						<DoubleArrowRightIcon className="h-4 w-4"/>
					</Button>
				</div>
			</div>
		</div>
	)
}

function DataTableViewOptions<TData>({table}: {table: ReactTable<TData>}) {
	const t = useTranslations();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="control-column ml-auto gap-2 sm:px-3 px-2 lg:flex"
				>
					<MixerHorizontalIcon className="h-4 w-4"/>
					<span className="sm:block hidden">{t("View")}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[150px]">
				<DropdownMenuLabel>{t('Toggle columns')}</DropdownMenuLabel>
				<DropdownMenuSeparator/>
				{table
					.getAllColumns()
					.filter(
						(column) =>
							typeof column.accessorFn !== "undefined" && column.getCanHide()
					)
					.map((column) => {
						return (
							<DropdownMenuCheckboxItem
								key={column.id}
								className="capitalize"
								checked={column.getIsVisible()}
								onCheckedChange={(value) => column.toggleVisibility(!!value)}
							>
								{t(column.id)}
							</DropdownMenuCheckboxItem>
						)
					})}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function DataTableToolbar<TData>(
	{
		table,
		globalFilter,
		customActions,
		customRange,
		facetedFilter,
	}: {
		table: ReactTable<TData>,
		globalFilter?: boolean,
		customActions?: React.ReactNode
		customRange?: React.ReactNode,
		facetedFilter?: (table: ReactTable<TData>) => React.JSX.Element
	}) {
	// Get the current column filters and table state
	const columnFilters = table.getState().columnFilters || []
	const sortingState = table.getState().sorting || []
	const globalFilterReset = table.getState().globalFilter || ''
	const rowSelection = table.getState().rowSelection || {}
	const pageIndex = table.getState().pagination?.pageIndex || 0
	const t = useTranslations();
	const isMobile = useIsMobile();
	const {dir} = useCheckedLocale();

	// Determine if any state is non-default
	const isFiltered =
		columnFilters.length > 0 ||
		sortingState.length > 0 ||
		globalFilterReset.length > 0 ||
		Object.keys(rowSelection).length > 0 ||
		pageIndex !== 0

	// Function to completely reset both table and store state
	const handleReset = () => {
		table.resetGlobalFilter()
		table.resetSorting()
		table.resetPageIndex()
		table.resetRowSelection()
		table.resetColumnFilters()

	}

	return (
		<div className="flex flex-col gap-2">
			{isMobile && <div className="md:hidden block print:hidden">
				{customRange}
      </div>}
			<div className="block ">
				{globalFilter &&
            <div className="md:hidden  relative flex gap-2 items-center ">
                <Input
                    placeholder={`${t('Search anything')} ...`}
                    value={table.getState().globalFilter ?? ""}
                    onChange={(e) => table.setGlobalFilter(e.target.value)}
                    className={`data-table-search max-w-sm h-8  rounded-md text-xs ${dir === 'rtl' ? 'pr-8': 'pl-8'}`}
                />
                <SearchIcon className="absolute mx-2 h-4 w-4 opacity-50"/>
            </div>
				}

			</div>
			<div className="print:hidden flex items-center justify-between ">

				<div className="flex items-center gap-2">
					{globalFilter &&
              <div className="hidden md:flex relative gap-2 items-center ">
                  <Input
                      placeholder={`${t('Search anything')} ...`}
                      value={table.getState().globalFilter ?? ""}
                      onChange={(e) => table.setGlobalFilter(e.target.value)}
                      className={`data-table-search max-w-sm h-8  rounded-md text-xs ${dir === 'rtl' ? 'pr-8': 'pl-8'}`}
                  />
                  <SearchIcon className="absolute mx-2 h-4 w-4 opacity-50"/>
              </div>
					}

					{facetedFilter &&
              <div className="">
								{facetedFilter(table)}
              </div>
					}
					{isFiltered && (
						<Button
							variant="ghost"
							content="Reset the page"
							onClick={handleReset}
							size={isMobile ? 'icon' : 'sm'}
						>
							<Cross2Icon className="md:mx-1 h-4 w-4"/>
							<span className="md:block hidden">{t('Reset')}</span>
						</Button>
					)}
					<div>
						{!isMobile && <div className=" md:block hidden print:hidden">
							{customRange}
            </div>}
					</div>
				</div>
				<div className="flex gap-2 items-center">
					<DataTableViewOptions table={table}/>
					{customActions}
				</div>
			</div>
		</div>

	)
}

export function DataTable<TData, TValue>({
	                                         columns,
	                                         data,
	                                         globalFilter,
	                                         customActions,
	                                         customRange,
	                                         loading,
	                                         facetedFilter,
	                                         emptyTableMessage,
	                                         initialSorting,
	                                         initialPageSize,
                                         }: {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	globalFilter?: boolean;
	customActions?: React.ReactNode;
	customRange?: React.ReactNode;
	loading?: boolean;
	facetedFilter?: (table: ReactTable<TData>) => React.JSX.Element;
	emptyTableMessage?: string;
	initialSorting?: SortingState;
	initialPageSize?: number;
}) {
	const [sorting, setSorting] = React.useState<SortingState>(initialSorting ?? [])
	const [rowSelection, setRowSelection] = React.useState({})
	const [columnVisibility, setColumnVisibility] = React.useState({})
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [globalFilterValue, setGlobalFilterValue] = React.useState("")
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: initialPageSize ?? 10,
	});
	const {dir} = useCheckedLocale();
	const t = useTranslations();

	const table = useReactTable({
		data,
		columns,
		filterFns: {fuzzy: fuzzyFilter},
		globalFilterFn: fuzzyFilter,
		enableRowSelection: true,
		defaultColumn: {
			enableSorting: true,
		},
		state: {
			sorting,
			rowSelection,
			columnVisibility,
			columnFilters,
			globalFilter: globalFilterValue,
			pagination,
		},
		onSortingChange: setSorting,
		onRowSelectionChange: setRowSelection,
		onColumnVisibilityChange: setColumnVisibility,
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilterValue,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	})

	const getColumnHeader = (cell: Cell<TData, TValue>) => {
		const resolvedColumnDef = cell.column.columnDef as ColumnDef<TData, TValue> & {
			accessorKey?: string;
			accessorFn?: unknown;
		}

		let key: string | null = null

		if (resolvedColumnDef.accessorKey) {
			key = resolvedColumnDef.accessorKey
		} else if (resolvedColumnDef.accessorFn) {
			key = cell.column.id
		}

		return key
			? key
				.split('.')
				.map(word => word.charAt(0).toUpperCase() + word.slice(1))
				.join(' ')
			: null
	}

	const {open} = useSidebar()
	const isMobile = useIsMobile()

	if (typeof window === "undefined") return null

	const GridView = () => (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{loading && table.getRowModel().rows.length <= 0 ? (
				Array.from({length: 6}).map((_, rowIndex) => (
					<div key={`skeleton-${rowIndex}`} className="relative overflow-hidden p-4 rounded-lg border bg-card/30">
						{table.getVisibleFlatColumns().map((column, colIndex) => (
							<div key={`skeleton-cell-${rowIndex}-${column.id}`} className="flex mt-1 gap-4 items-center">
								<div
									className="text-xs truncate capitalize w-14 leading-none space-y-2 font-medium text-muted-foreground">
									<Skeleton className="h-3 w-12"/>
								</div>
								<div className="text-sm flex-1">
									<Skeleton
										className={`my-1 ${colIndex === table.getVisibleFlatColumns().length - 1 ? "h-5 my-1.5" : "h-3"}`}
										style={{
											width:
												colIndex === table.getVisibleFlatColumns().length - 1
													? "120px"
													: colIndex === 0
														? "80px"
														: `${Math.floor(Math.random() * (80 - 40 + 1)) + 40}%`,
										}}
									/>
								</div>
							</div>
						))}
					</div>
				))
			) : table.getRowModel().rows.length ? (
				table.getRowModel().rows.map((row) => (
					<div
						key={row.id}
						className="relative overflow-hidden p-4 rounded-lg border bg-card/30 hover:border-primary transition-colors"
						data-state={row.getIsSelected() && "selected"}
					>
						{row.getVisibleCells().map((cell, index) => (
							<div key={cell.id} className="flex mt-1 gap-4 items-center">
								<div
									className="text-xs truncate capitalize w-14 leading-none space-y-2 font-medium text-muted-foreground">
									{t(getColumnHeader(cell) ?? '')}
								</div>
								<div className="text-sm">
									{loading && index !== row.getVisibleCells().length - 1 ? (
										<Skeleton
											className="h-3 my-1"
											style={{
												width: index === 0 ? "80px" : `${Math.floor(Math.random() * (80 - 40 + 1)) + 40}%`,
											}}
										/>
									) : (
										flexRender(cell.column.columnDef.cell, cell.getContext())
									)}
								</div>
							</div>
						))}

					</div>
				))
			) : (
				<div
					className="col-span-full h-24 flex justify-center items-center text-center">{t(emptyTableMessage || 'No results')}</div>
			)}
		</div>
	)


	return (
		<div className="space-y-4 print:space-y-0">
			<DataTableToolbar
				table={table}
				globalFilter={globalFilter}
				customActions={customActions}
				customRange={customRange}
				facetedFilter={facetedFilter}
			/>

			{!isMobile ? (
				<div className="rounded-md hidden md:block print:hidden">
					<ScrollArea dir={dir}
					            className={`${open ? "md:max-w-[calc(100vw-21.5rem)]" : "md:max-w-[calc(100vw-9rem)]"}`}>
						<Table className="overflow-hidden">
							<TableHeader>
								{table.getHeaderGroups().map((headerGroup) => (
									<TableRow key={headerGroup.id}>
										{headerGroup.headers.map((header) => (
											<TableHead key={header.id}>
												{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
											</TableHead>
										))}
									</TableRow>
								))}
							</TableHeader>
							<TableBody>
								{loading && table.getRowModel().rows.length <= 0 ? (
									Array.from({length: 10}).map((_, rowIndex) => (
										<TableRow className="relative group" key={`skeleton-${rowIndex}`}>
											{table.getVisibleFlatColumns().map((column, colIndex) => (
												<TableCell key={`skeleton-cell-${rowIndex}-${column.id}`}>
													<Skeleton
														className="h-4 my-2"
														style={{
															width:
																colIndex === 0
																	? "90px"
																	: colIndex === table.getVisibleFlatColumns().length - 1
																		? "150px"
																		: `${Math.floor(Math.random() * (80 - 40 + 1)) + 40}%`,
														}}
													/>
												</TableCell>
											))}
										</TableRow>
									))
								) : table.getRowModel().rows.length ? (
									table.getRowModel().rows.map((row) => (
										<TableRow
											className="relative group"
											key={row.id}
											data-state={row.getIsSelected() && "selected"}
										>
											{row.getVisibleCells().map((cell, index) => (
												<TableCell key={cell.id}>
													{loading && index !== row.getVisibleCells().length - 1 ? (
														<Skeleton
															className="h-4 my-2"
															style={{
																width: index === 0 ? "90px" : `${Math.floor(Math.random() * (80 - 40 + 1)) + 40}%`,
															}}
														/>
													) : (
														flexRender(cell.column.columnDef.cell, cell.getContext())
													)}
												</TableCell>
											))}
										</TableRow>
									))
								) : (
									<TableRow>
										<TableCell colSpan={columns.length} className="h-24 text-center">
											{t(emptyTableMessage || 'No results')}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
						<ScrollBar orientation="horizontal"/>
					</ScrollArea>
				</div>
			) : (
				<div className="md:hidden block print:hidden">
					<GridView/>
				</div>
			)}
			<DataTablePagination table={table}/>
		</div>
	)
}
