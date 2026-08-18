export interface Role {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateRoleInput {
  name: string
  description?: string
}

export interface UpdateRoleInput extends Partial<CreateRoleInput> {
  isActive?: boolean
}

export interface AssignedRole {
  id: string
  name: string
  assignedAt: string
}

export interface AssignedPermission {
  id: string
  name: string
  moduleId: string
  actionId: string
  assignedAt: string
}
