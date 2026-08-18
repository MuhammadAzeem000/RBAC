export interface Permission {
  id: string
  moduleId: string
  actionId: string
  name: string
  code: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreatePermissionInput {
  moduleId: string
  actionId: string
  name: string
  code: string
  description?: string
}

export interface UpdatePermissionInput {
  name?: string
  code?: string
  description?: string
  isActive?: boolean
}
