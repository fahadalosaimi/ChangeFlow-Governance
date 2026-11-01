export type Permission = 'identity.read' | 'foundation.read' | 'notifications.own' | 'risk_rules.read'
  | 'changes.read' | 'changes.create' | 'changes.revise' | 'changes.approve' | 'changes.implement'
  | 'foundation.write' | 'risk_rules.write' | 'users.read' | 'users.update' | 'audit.read' | 'invitations.manage'

export interface CurrentUser {
  id: number
  organization_id: number
  department_id: number | null
  full_name: string
  email: string
  job_title: string | null
  role_name: string
  department_name: string | null
  workspace_slug: string
  permissions: Permission[]
}

export interface LoginInput { tenant_slug: string; email: string; password: string }
export interface TokenOutput { access_token: string; token_type: 'bearer' }
export interface InvitationInput { token: string; password: string; full_name?: string }
export interface MembershipActivated { user_id: number; organization_id: number; status: 'activated' }
