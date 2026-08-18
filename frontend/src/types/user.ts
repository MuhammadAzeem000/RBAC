export interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  status: string
  isActive: boolean
  lastLoginAt: string | null
  lastLoginIp: string | null
  createdAt: string
  updatedAt: string | null
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
}

export interface UpdateUserInput extends Partial<Omit<CreateUserInput, 'password'>> {
  password?: string
  status?: string
  isActive?: boolean
}
