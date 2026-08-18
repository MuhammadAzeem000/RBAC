import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type { PaginationMeta } from '@/types/pagination'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/cn'
import { Input } from './Input'
import { Select } from './Select'
import { Spinner } from './Spinner'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

interface DataTableProps<T> {
  // TanStack Table's per-column value types are heterogeneous (string/boolean/etc.);
  // `any` here matches the library's own recommended typing for a column array prop.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[]
  data: T[]
  pagination: PaginationMeta
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  search: string
  onSearchChange: (search: string) => void
  searchPlaceholder?: string
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  onRetry?: () => void
  onRowClick?: (row: T) => void
  toolbarExtra?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
  getRowId?: (row: T) => string
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export function DataTable<T>({
  columns,
  data,
  pagination,
  onPageChange,
  onPageSizeChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onRowClick,
  toolbarExtra,
  emptyTitle,
  emptyDescription,
  getRowId,
}: DataTableProps<T>) {
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebouncedValue(searchInput, 350)

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    if (debouncedSearch !== search) onSearchChange(debouncedSearch)
  }, [debouncedSearch, search, onSearchChange])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId as ((row: T) => string) | undefined,
  })

  const { page, pageSize, total, totalPages } = pagination
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(total, page * pageSize)

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5">
        <div className="relative w-full max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search"
            className="pl-8"
          />
        </div>
        {toolbarExtra}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-500"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {columns.map((_col, colIndex) => (
                    <td key={colIndex} className="px-3 py-2.5">
                      <div className="h-3.5 w-full max-w-32 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={columns.length}>
                  <ErrorState message={errorMessage} onRetry={onRetry} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'border-b border-slate-100 last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-slate-50',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 text-slate-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="inline-flex items-center gap-1.5">
              <Spinner className="size-3" /> Loading…
            </span>
          ) : (
            <span>
              {total === 0 ? '0 results' : `${rangeStart}–${rangeEnd} of ${total}`}
            </span>
          )}
          <Select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-7! w-auto"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="px-1 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
