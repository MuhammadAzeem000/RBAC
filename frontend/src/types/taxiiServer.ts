export type TaxiiServerAuthType = 'none' | 'basic' | 'bearer'
export type TaxiiServerStatus = 'enabled' | 'disabled'

export interface TaxiiServer {
  id: string
  name: string
  discoveryUrl: string
  apiRoot: string | null
  authType: TaxiiServerAuthType
  credentialConfigured: boolean
  status: TaxiiServerStatus
}

// Credential is write-only — never returned by the API, only
// `credentialConfigured`. Leaving it out of an update keeps whatever
// credential is already stored.
export interface TaxiiServerCredential {
  username?: string
  password?: string
  token?: string
}

export interface CreateTaxiiServerInput {
  name: string
  discoveryUrl: string
  authType: TaxiiServerAuthType
  credential?: TaxiiServerCredential
}

export interface UpdateTaxiiServerInput {
  name?: string
  discoveryUrl?: string
  authType?: TaxiiServerAuthType
  credential?: TaxiiServerCredential
  status?: TaxiiServerStatus
}
