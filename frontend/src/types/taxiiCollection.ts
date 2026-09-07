export type TaxiiCollectionStatus = 'enabled' | 'disabled'
export type TaxiiPollStatus = 'succeeded' | 'failed' | null

export interface TaxiiCollection {
  id: string
  taxiiServerId: string
  collectionId: string
  title: string | null
  pollIntervalSeconds: number
  status: TaxiiCollectionStatus
  lastAddedAfter: string | null
  lastPolledAt: string | null
  lastPollStatus: TaxiiPollStatus
  lastPollError: string | null
  objectCount?: number
}

// The shape TAXII 2.1's own /collections/ endpoint returns — what the
// server actually advertises, before it's been added for scheduled polling.
export interface DiscoveredCollection {
  id: string
  title: string
  description?: string
  can_read: boolean
  can_write: boolean
}

export interface CreateTaxiiCollectionInput {
  collectionId: string
  title?: string
  pollIntervalSeconds?: number
}

export interface UpdateTaxiiCollectionInput {
  title?: string
  pollIntervalSeconds?: number
  status?: TaxiiCollectionStatus
}
