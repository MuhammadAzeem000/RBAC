export type StixObjectType = 'indicator' | 'malware' | 'threat-actor' | 'attack-pattern' | 'relationship' | 'identity'

export interface StixObject {
  id: string
  stixId: string
  specVersion: string
  type: StixObjectType | string
  iocType: string | null
  iocValue: string | null
  pattern: string | null
  labels: string[]
  confidence: number | null
  firstSeen: string | null
  lastSeen: string | null
  revoked: boolean
  raw: Record<string, unknown>
  sourceFeedName: string | null
  ingestedAt: string
}

export interface IocLookupResult {
  found: boolean
  stixId?: string
  iocType?: string | null
  iocValue?: string | null
  type?: string
  labels?: string[]
  confidence?: number | null
  firstSeen?: string | null
  lastSeen?: string | null
  sourceFeedName?: string | null
}

export interface IocSearchQuery {
  value?: string
  type?: string
  stixType?: string
}
