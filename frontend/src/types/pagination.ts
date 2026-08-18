export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: PaginationMeta
}

export interface ListQuery {
  page?: number
  pageSize?: number
  search?: string
  isActive?: boolean
}
