export interface Action {
  id: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateActionInput {
  name: string
  description?: string
  sortOrder?: number
}

export interface UpdateActionInput extends Partial<CreateActionInput> {
  isActive?: boolean
}
