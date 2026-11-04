import type { Permission } from '../types/api.ts'
import type { WorkspaceView } from '../features/auth/permissions.ts'
import {controlledWritesAvailable} from '../features/change-editor/boundary.ts'

export interface WorkspaceRoute {
  path: string
  title: string
  permission: Permission
  icon: 'workspace' | 'changes' | 'catalog' | 'users' | 'bell' | 'plus'
  view?: WorkspaceView
  changeId?: number
  systemId?: number
}

export const destinations: readonly WorkspaceRoute[] = [
  { path: '/workspace', title: 'shell:nav.workspace', permission: 'identity.read', icon: 'workspace' },
  { path: '/dashboard', title: 'shell:nav.dashboard', permission: 'changes.read', icon: 'changes' },
  { path: '/systems', title: 'shell:nav.systems', permission: 'foundation.read', icon: 'catalog' },
  { path: '/changes', title: 'shell:nav.changes', permission: 'changes.read', icon: 'changes', view: 'dashboard' },
  { path: '/changes/new', title: 'shell:nav.newChange', permission: 'changes.create', icon: 'plus', view: 'new' },
  { path: '/foundation', title: 'shell:nav.foundation', permission: 'foundation.write', icon: 'catalog', view: 'foundation' },
  { path: '/users', title: 'shell:nav.users', permission: 'users.read', icon: 'users', view: 'users' },
  { path: '/notifications', title: 'shell:nav.notifications', permission: 'notifications.own', icon: 'bell', view: 'notifications' },
]

export function resolveWorkspaceRoute(path: string): WorkspaceRoute | null {
  const known = destinations.find(route => route.path === path)
  if (known) return known
  if(path==='/legacy/notifications')return {path,title:'notifications:legacy',permission:'notifications.own',icon:'bell',view:'notifications'}
  if(controlledWritesAvailable&&path==='/development/changes/new')return {path,title:'editor:create',permission:'changes.create',icon:'plus'}
  const editor=/^\/development\/changes\/([1-9]\d*)\/revise$/.exec(path)
  if(controlledWritesAvailable&&editor&&Number.isSafeInteger(Number(editor[1])))return {path,title:'editor:revise',permission:'changes.revise',icon:'changes',changeId:Number(editor[1])}
  if (path === '/legacy/changes') return {path,title:'changes:legacyList',permission:'changes.read',icon:'changes',view:'dashboard'}
  const legacy = /^\/legacy\/changes\/([1-9]\d*)$/.exec(path)
  if (legacy && Number.isSafeInteger(Number(legacy[1]))) return {path,title:'changes:legacyDetails',permission:'changes.read',icon:'changes',view:'details',changeId:Number(legacy[1])}
  const system = /^\/systems\/([1-9]\d*)$/.exec(path)
  if (system && Number.isSafeInteger(Number(system[1])))
    return { path, title: 'systems:details', permission: 'foundation.read', icon: 'catalog', systemId: Number(system[1]) }
  const match = /^\/changes\/([1-9]\d*)(\/revise)?$/.exec(path)
  if (!match || !Number.isSafeInteger(Number(match[1]))) return null
  return { path, title: match[2] ? 'shell:nav.revise' : 'shell:nav.details',
    permission: match[2] ? 'changes.revise' : 'changes.read', icon: 'changes',
    view: match[2] ? 'revise' : 'details', changeId: Number(match[1]) }
}

export function routeAllowed(path: string, permissions: readonly string[]): boolean {
  const route = resolveWorkspaceRoute(path)
  return route !== null && permissions.includes(route.permission)
}

export function navigationFor(permissions: readonly string[]) {
  return destinations.filter(route => permissions.includes(route.permission) && route.path !== '/changes/new')
}

export function safeDestination(path: unknown): string {
  return typeof path === 'string' && resolveWorkspaceRoute(path) ? path : '/workspace'
}

export function withRecoveryMarker(path: string, memoryOnly: boolean): string {
  return safeDestination(path) + (memoryOnly ? '?memory=1' : '')
}

export function viewDestination(view: WorkspaceView, changeId?: number): string {
  if ((view === 'details' || view === 'revise') && Number.isSafeInteger(changeId) && changeId! > 0)
    return `/changes/${changeId}${view === 'revise' ? '/revise' : ''}`
  return destinations.find(route => route.view === view)?.path ?? '/workspace'
}
