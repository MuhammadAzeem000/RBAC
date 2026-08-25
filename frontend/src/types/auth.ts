import type { User } from './user'

export interface LoginRequest {
  tenantSlug: string
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
  tenantSlug: string
  tenantName?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresIn: number
}

export interface LoginResponse extends AuthTokens {
  user: User
}

// A module the caller's roles grant any permission on — drives nav visibility
// and, via `actions`, per-action (create/edit/delete) control gating.
export interface ModuleAccess {
  name: string
  isEnabled: boolean
  actions: string[]
}
