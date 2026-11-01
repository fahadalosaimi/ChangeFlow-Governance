import type { Language } from '../preferences/store.ts'

export function formatNumber(value: number, language: Language) {
  return Number.isFinite(value) ? new Intl.NumberFormat(language).format(value) : '—'
}

export function formatDateTime(value: string, kind: 'utc' | 'organization-local', language: Language): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value)
  if (!match || (kind === 'utc') !== Boolean(match[7])) return '—'
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(part => Number(part ?? 0))
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  if (wall.getUTCFullYear() !== year || wall.getUTCMonth() !== month - 1 || wall.getUTCDate() !== day
    || wall.getUTCHours() !== hour || wall.getUTCMinutes() !== minute || wall.getUTCSeconds() !== second) return '—'
  const instant = kind === 'utc' ? new Date(value) : wall
  if (!Number.isFinite(instant.getTime())) return '—'
  return new Intl.DateTimeFormat(language, { calendar: 'gregory', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    timeZone: kind === 'utc' ? 'Asia/Riyadh' : 'UTC' }).format(instant)
}
