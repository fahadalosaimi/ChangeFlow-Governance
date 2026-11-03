import { ApiError } from '../../services/api/errors.ts'

export interface Overview { total_changes: number; pending_approval: number; approved: number; rejected: number; needs_more_information: number }
export interface WorkQueues { pending_review: number; awaiting_requester: number }
export interface DeliveryQueues { approved_ready: number; in_progress: number; pending_pir: number; failed: number }
export interface RecentChange { id: number; requester_id: number | null; title: string; status: string; created_at: string; priority: string; change_type: string }
export interface RecentPage { items: RecentChange[]; total: number; page: number; page_size: number; total_pages: number }
const bad = (): never => { throw new ApiError('invalid_response') }
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : bad()
const count = (v: unknown): number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : bad()
const id = (v: unknown) => { const n = count(v); return n > 0 ? n : bad() }
const text = (v: unknown): string => typeof v === 'string' && v.trim() ? v : bad()
function creationDate(v: unknown): string {
  const s = text(v), match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(s)
  if (!match) return bad()
  const [y, m, d, h, min, sec] = match.slice(1).map(Number)
  const wall = new Date(Date.UTC(y, m - 1, d, h, min, sec))
  if (wall.getUTCFullYear() !== y || wall.getUTCMonth() !== m - 1 || wall.getUTCDate() !== d || h > 23 || min > 59 || sec > 59
    || !Number.isFinite(Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(s) ? s : s + 'Z'))) return bad()
  return s
}
export function decodeOverview(value: unknown): Overview {
  const r = object(value)
  const result = { total_changes: count(r.total_changes), pending_approval: count(r.pending_approval), approved: count(r.approved),
    rejected: count(r.rejected), needs_more_information: count(r.needs_more_information) }
  // These four disjoint status counts may be smaller than the full lifecycle total.
  let remaining = result.total_changes
  for (const n of [result.pending_approval, result.approved, result.rejected, result.needs_more_information]) {
    if (n > remaining) return bad()
    remaining -= n
  }
  return result
}
export function decodeWork(value: unknown): WorkQueues {
  const r = object(value)
  return { pending_review: count(r.pending_review), awaiting_requester: count(r.awaiting_requester) }
}
export function decodeDelivery(value: unknown): DeliveryQueues {
  const r = object(value)
  return { approved_ready: count(r.approved_ready), in_progress: count(r.in_progress), pending_pir: count(r.pending_pir), failed: count(r.failed) }
}
export function decodeRecent(value: unknown, requesterId?: number, status = ''): RecentPage {
  const r = object(value), total = count(r.total), page = id(r.page), size = id(r.page_size), pages = id(r.total_pages)
  if (page !== 1 || size !== 5 || pages !== Math.max(1, Math.ceil(total / size)) || !Array.isArray(r.items)
    || r.items.length > Math.min(size, total)) return bad()
  const items = r.items.map(value => {
    const item = object(value)
    const record = { id: id(item.id), requester_id: item.requester_id === null ? null : id(item.requester_id),
      title: text(item.title), status: text(item.status), created_at: creationDate(item.created_at), priority: text(item.priority), change_type: text(item.change_type) }
    if ((requesterId !== undefined && record.requester_id !== requesterId) || (status && record.status !== status)) return bad()
    return record
  })
  if (new Set(items.map(item => item.id)).size !== items.length) return bad()
  return { items, total, page, page_size: size, total_pages: pages }
}
