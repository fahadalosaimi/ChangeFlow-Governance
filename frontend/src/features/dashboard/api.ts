import { ApiError } from '../../services/api/errors.ts'
import { decodeOverview, decodeWork, decodeDelivery, decodeRecent } from './decoders.ts'
import { queueStatuses } from './viewModels.ts'

type Gateway = (path: string, options?: RequestInit) => Promise<unknown>
export function createDashboardApi(gateway: Gateway, requesterId?: number) {
  const get = (path: string, signal?: AbortSignal) => gateway(path, { method: 'GET', signal })
  return {
    overview: async (signal?: AbortSignal) => decodeOverview(await get('/change-management/dashboard/overview', signal)),
    work: async (signal?: AbortSignal) => decodeWork(await get('/change-management/dashboard/work-queues', signal)),
    delivery: async (signal?: AbortSignal) => decodeDelivery(await get('/change-management/dashboard/delivery-queues', signal)),
    recent: async (status = '', signal?: AbortSignal) => {
      if (status && !(queueStatuses as readonly string[]).includes(status)) throw new ApiError('configuration')
      const params = new URLSearchParams({ page: '1', page_size: '5' })
      if (status) params.set('status', status)
      return decodeRecent(await get(`/change-management/requests/paged?${params}`, signal), requesterId, status)
    },
  }
}
export type DashboardApi = ReturnType<typeof createDashboardApi>
