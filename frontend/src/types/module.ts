export interface AppModule {
  id: string
  name: string
  description: string | null
  icon: string | null
  route: string | null
  sortOrder: number
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateModuleInput {
  name: string
  description?: string
  icon?: string
  route?: string
  sortOrder?: number
}

export interface UpdateModuleInput extends Partial<CreateModuleInput> {
  isActive?: boolean
}
