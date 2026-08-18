import { useSearchParams } from 'react-router-dom'

interface ListStatePatch {
  page?: number
  pageSize?: number
  search?: string
  isActive?: boolean | undefined
}

export function useListState(defaultPageSize = 20) {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Number(searchParams.get('page') ?? '1') || 1
  const pageSize = Number(searchParams.get('pageSize') ?? String(defaultPageSize)) || defaultPageSize
  const search = searchParams.get('q') ?? ''
  const isActiveParam = searchParams.get('isActive')
  const isActive = isActiveParam === null ? undefined : isActiveParam === 'true'

  function update(patch: ListStatePatch) {
    const next = new URLSearchParams(searchParams)

    if (patch.page !== undefined) {
      next.set('page', String(patch.page))
    }
    if (patch.pageSize !== undefined) {
      next.set('pageSize', String(patch.pageSize))
      next.set('page', '1')
    }
    if (patch.search !== undefined) {
      if (patch.search) next.set('q', patch.search)
      else next.delete('q')
      next.set('page', '1')
    }
    if ('isActive' in patch) {
      if (patch.isActive === undefined) next.delete('isActive')
      else next.set('isActive', String(patch.isActive))
      next.set('page', '1')
    }

    setSearchParams(next, { replace: true })
  }

  return {
    page,
    pageSize,
    search,
    isActive,
    setPage: (nextPage: number) => update({ page: nextPage }),
    setPageSize: (nextPageSize: number) => update({ pageSize: nextPageSize }),
    setSearch: (nextSearch: string) => update({ search: nextSearch }),
    setIsActive: (nextIsActive: boolean | undefined) => update({ isActive: nextIsActive }),
  }
}
