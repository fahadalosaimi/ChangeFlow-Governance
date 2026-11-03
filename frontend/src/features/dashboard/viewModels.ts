import type { Overview } from './decoders.ts'

export const queueStatuses = ['Pending Approval', 'Needs More Information', 'Approved', 'In Progress', 'Implemented', 'Failed'] as const
export function statusDistribution(overview: Overview) {
  return [
    { status: 'Pending Approval', count: overview.pending_approval },
    { status: 'Approved', count: overview.approved },
    { status: 'Rejected', count: overview.rejected },
    { status: 'Needs More Information', count: overview.needs_more_information },
  ]
}
// ManagedChangeRequest.created_at is written by utc_now() as UTC-naive.
// This convention applies to creation timestamps, not planned wall-time fields.
export const creationInstant = (value: string) => /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + 'Z'
