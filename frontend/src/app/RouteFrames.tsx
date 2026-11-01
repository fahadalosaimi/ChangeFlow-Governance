import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../features/auth/useAuth.ts'
import { AuthLayout } from '../layouts/AuthLayout.tsx'
import { SessionState } from '../features/auth/SessionState.tsx'
import { WorkspaceLoginPage } from '../pages/WorkspaceLoginPage.tsx'
import { safeDestination, withRecoveryMarker } from './routePolicy.ts'

export function LoginRoute() {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status === 'authenticated') return <Navigate replace to={withRecoveryMarker(
    safeDestination((location.state as { returnTo?: unknown } | null)?.returnTo), state.storageWarning)} />
  if (state.status !== 'anonymous') return <SessionState />
  return <WorkspaceLoginPage />
}
export function EmptyRoute() { return null }
export function InitialFallback() { return <AuthLayout><SessionState /></AuthLayout> }
