export interface Permission {
  id: string
  moduleId: string
  actionId: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreatePermissionInput {
  moduleId: string
  actionId: string
  name: string
  description?: string
}

export interface UpdatePermissionInput {
  name?: string
  description?: string
  isActive?: boolean
}
