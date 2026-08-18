export interface Department {
  id: string
  name: string
  code: string | null
  description: string | null
  status: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string | null
}

export interface CreateDepartmentInput {
  name: string
  code?: string
  description?: string
  sortOrder?: number
}

export interface UpdateDepartmentInput extends Partial<CreateDepartmentInput> {
  status?: string
  isActive?: boolean
}
