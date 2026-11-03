import { ApiError } from '../../services/api/errors.ts'

export interface SystemRecord {
  id: number; organization_id: number; department_id: number | null; service_id: number | null; owner_id: number | null
  name: string; description: string | null; system_type: string | null; environment: string; criticality: string; status: string
}
export interface DependencyRecord { id: number; source_system_id: number; target_system_id: number; dependency_type: string; impact_level: string; description: string | null }
export interface IncidentRecord { id: number; system_id: number; title: string; description: string | null; severity: string; status: string; occurred_at: string; resolved_at: string | null }
export interface ImpactProfile { system_id: number; system_name: string; criticality: string; department_name: string | null; service_name: string | null; owner_name: string | null; outgoing_dependencies: string[]; incoming_dependencies: string[]; previous_incidents: string[]; impact_summary: string }
const bad = (): never => { throw new ApiError('invalid_response') }
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : bad()
export const positiveId = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const id = (v: unknown): number => positiveId(v) ? v : bad()
const nullableId = (v: unknown) => v === null ? null : id(v)
const text = (v: unknown): string => typeof v === 'string' ? v : bad()
const name = (v: unknown) => { const s = text(v); return s.trim() ? s : bad() }
const nullableText = (v: unknown) => v === null ? null : text(v)
const same = (actual: number, expected: number) => actual === expected && positiveId(expected) ? actual : bad()
const array = <T>(v: unknown, decode: (item: unknown) => T): T[] => Array.isArray(v) ? v.map(decode) : bad()
const unique = <T extends { id: number }>(items: T[]) => new Set(items.map(item => item.id)).size === items.length ? items : bad()
function date(v: unknown): string {
  const s = text(v), m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(s)
  if (!m) return bad()
  const [y, month, d, h, min, sec] = m.slice(1).map(Number)
  const value = new Date(Date.UTC(y, month - 1, d, h, min, sec))
  if (value.getUTCFullYear() !== y || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== d || h > 23 || min > 59 || sec > 59) return bad()
  if (/[+-]\d{2}:\d{2}$/.test(s) && !Number.isFinite(Date.parse(s))) return bad()
  return s
}
export function decodeSystem(v: unknown, organization: number): SystemRecord {
  const r = object(v)
  return { id: id(r.id), organization_id: same(id(r.organization_id), organization), department_id: nullableId(r.department_id),
    service_id: nullableId(r.service_id), owner_id: nullableId(r.owner_id), name: name(r.name), description: nullableText(r.description),
    system_type: nullableText(r.system_type), environment: name(r.environment), criticality: name(r.criticality), status: name(r.status) }
}
export const decodeSystems = (v: unknown, organization: number) => unique(array(v, item => decodeSystem(item, organization)))
export const decodeDependencies = (v: unknown, parent: number): DependencyRecord[] => unique(array(v, item => {
  const r = object(item)
  return { id: id(r.id), source_system_id: same(id(r.source_system_id), parent), target_system_id: id(r.target_system_id),
    dependency_type: name(r.dependency_type), impact_level: name(r.impact_level), description: nullableText(r.description) }
}))
export const decodeIncidents = (v: unknown, parent: number): IncidentRecord[] => unique(array(v, item => {
  const r = object(item)
  return { id: id(r.id), system_id: same(id(r.system_id), parent), title: name(r.title), description: nullableText(r.description),
    severity: name(r.severity), status: name(r.status), occurred_at: date(r.occurred_at), resolved_at: r.resolved_at === null ? null : date(r.resolved_at) }
}))
export function decodeProfile(v: unknown, parent: number): ImpactProfile {
  const r = object(v)
  return { system_id: same(id(r.system_id), parent), system_name: name(r.system_name), criticality: name(r.criticality),
    department_name: nullableText(r.department_name), service_name: nullableText(r.service_name), owner_name: nullableText(r.owner_name),
    outgoing_dependencies: array(r.outgoing_dependencies, text), incoming_dependencies: array(r.incoming_dependencies, text),
    previous_incidents: array(r.previous_incidents, text), impact_summary: text(r.impact_summary) }
}
