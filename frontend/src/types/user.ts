export interface User {
  id: string
  name: string
  username: string
  email: string
  phone: string | null
  avatarUrl: string | null
  jobTitle: string | null
  employeeCode: string | null
  status: string
  isActive: boolean
  isVerified: boolean
  emailVerifiedAt: string | null
  phoneVerifiedAt: string | null
  lastLoginAt: string | null
  lastLoginIp: string | null
  timezone: string | null
  locale: string | null
  createdAt: string
  updatedAt: string | null
}

export interface CreateUserInput {
  name: string
  username: string
  email: string
  phone?: string
  password: string
  jobTitle?: string
  employeeCode?: string
  timezone?: string
  locale?: string
}

export interface UpdateUserInput extends Partial<Omit<CreateUserInput, 'password'>> {
  password?: string
  status?: string
  isActive?: boolean
  isVerified?: boolean
}
