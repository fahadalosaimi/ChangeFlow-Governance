import { ApiError } from '../../services/api/errors.ts'
import { positiveId, decodeSystem, decodeSystems, decodeDependencies, decodeIncidents, decodeProfile } from './decoders.ts'
type Gateway = (path: string, options?: RequestInit) => Promise<unknown>
export function createSystemsApi(gateway: Gateway, organization: number) {
  const path = (id: number) => { if (!positiveId(id)) throw new ApiError('configuration'); return `/foundation/systems/${id}` }
  const get = (url: string, signal?: AbortSignal) => gateway(url, { method: 'GET', signal })
  return {
    list: async (signal?: AbortSignal) => decodeSystems(await get('/foundation/systems', signal), organization),
    system: async (id: number, signal?: AbortSignal) => {
      const record = decodeSystem(await get(path(id), signal), organization)
      if (record.id !== id) throw new ApiError('invalid_response')
      return record
    },
    dependencies: async (id: number, signal?: AbortSignal) => decodeDependencies(await get(`${path(id)}/dependencies`, signal), id),
    incidents: async (id: number, signal?: AbortSignal) => decodeIncidents(await get(`${path(id)}/incidents`, signal), id),
    profile: async (id: number, signal?: AbortSignal) => decodeProfile(await get(`${path(id)}/impact-profile`, signal), id),
  }
}
export type SystemsApi = ReturnType<typeof createSystemsApi>
