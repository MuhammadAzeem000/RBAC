import { createColumnHelper } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { iocsApi } from '@/api/iocs.api'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useListState } from '@/hooks/useListState'
import { getErrorMessage } from '@/lib/errors'
import type { StixObject } from '@/types/stixObject'

const columnHelper = createColumnHelper<StixObject>()

const STIX_TYPES = ['indicator', 'malware', 'threat-actor', 'attack-pattern', 'relationship', 'identity']

// GET /iocs isn't paginated server-side (returns up to a fixed, most-recent-
// first count) — the DataTable still needs a PaginationMeta for its footer,
// so a synthetic single-page meta is passed, which naturally disables the
// prev/next controls rather than faking pages that don't exist.
export function IocSearchPage() {
  const { search, setSearch } = useListState()
  const [searchParams, setSearchParams] = useSearchParams()
  const stixType = searchParams.get('stixType') ?? ''

  function setStixType(next: string) {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('stixType', next)
    else params.delete('stixType')
    setSearchParams(params, { replace: true })
  }

  const query = useQuery({
    queryKey: ['iocs', { value: search, stixType }],
    queryFn: () => iocsApi.search({ value: search || undefined, stixType: stixType || undefined }),
    placeholderData: (prev) => prev,
  })

  const results = query.data ?? []

  const columns = [
    columnHelper.accessor('iocValue', {
      header: 'Value',
      cell: (info) => <span className="font-mono text-xs">{info.getValue() ?? '—'}</span>,
    }),
    columnHelper.accessor('iocType', { header: 'IOC type' }),
    columnHelper.accessor('type', {
      header: 'STIX type',
      cell: (info) => <Badge tone="blue">{info.getValue()}</Badge>,
    }),
    columnHelper.accessor('labels', {
      header: 'Labels',
      cell: (info) => (
        <div className="flex flex-wrap gap-1">
          {info.getValue()?.map((label) => (
            <Badge key={label} tone="slate">
              {label}
            </Badge>
          ))}
        </div>
      ),
    }),
    columnHelper.accessor('confidence', { header: 'Confidence' }),
    columnHelper.accessor('lastSeen', {
      header: 'Last seen',
      cell: (info) => (info.getValue() ? new Date(info.getValue() as string).toLocaleString() : '—'),
    }),
    columnHelper.accessor('sourceFeedName', { header: 'Source feed' }),
  ]

  return (
    <div>
      <Link
        to="/threat-intel"
        className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to TAXII servers
      </Link>

      <PageHeader
        title="IOC search"
        description="Indicators and STIX objects ingested from configured TAXII feeds."
      />

      <DataTable
        columns={columns}
        data={results}
        pagination={{ page: 1, pageSize: Math.max(results.length, 1), total: results.length, totalPages: 1 }}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by IOC value…"
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getErrorMessage(query.error)}
        onRetry={() => query.refetch()}
        toolbarExtra={
          <Select
            value={stixType}
            onChange={(e) => setStixType(e.target.value)}
            aria-label="Filter by STIX type"
            className="h-8! w-auto"
          >
            <option value="">All types</option>
            {STIX_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        }
        emptyTitle="No matching IOCs"
        emptyDescription="Try a different search value or type filter."
      />
    </div>
  )
}
