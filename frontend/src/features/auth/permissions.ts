import type { Permission } from '../../types/api.ts'

export type WorkspaceView = 'dashboard' | 'new' | 'revise' | 'details' | 'foundation' | 'users' | 'notifications'
const requirements: Record<WorkspaceView, Permission> = {
  dashboard: 'identity.read', new: 'changes.create', revise: 'changes.revise', details: 'changes.read',
  foundation: 'foundation.write', users: 'users.read', notifications: 'notifications.own',
}
export function canView(view: WorkspaceView, permissions: readonly string[]): boolean {
  return permissions.includes(requirements[view])
}
