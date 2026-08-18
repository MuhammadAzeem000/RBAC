export interface Action {
  id: string
  name: string
  code: string
  description: string | null
  sortOrder: number
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateActionInput {
  name: string
  code: string
  description?: string
  sortOrder?: number
}

export interface UpdateActionInput extends Partial<CreateActionInput> {
  isActive?: boolean
}
