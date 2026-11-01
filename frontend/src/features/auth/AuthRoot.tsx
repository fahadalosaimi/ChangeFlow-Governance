import { Navigate, Outlet, useLocation } from 'react-router'
import { safeDestination, resolveWorkspaceRoute, withRecoveryMarker } from '../../app/routePolicy.ts'
import { AuthLayout } from '../../layouts/AuthLayout.tsx'
import { ToastProvider } from '../../components/ui/ToastProvider.tsx'
import { SessionState } from './SessionState.tsx'
import { useAuth } from './useAuth.ts'

export function AuthRoot() {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status === 'anonymous') return <Navigate replace to={state.reason === 'none' ? '/login' : '/login?logout=1'}
    state={{ returnTo: safeDestination(location.pathname) }} />
  if (state.status !== 'authenticated' || !state.user || !state.binding) return <AuthLayout><SessionState /></AuthLayout>
  if (state.storageWarning && resolveWorkspaceRoute(location.pathname) && location.search !== '?memory=1')
    return <Navigate replace to={withRecoveryMarker(location.pathname, true)} />
  return <ToastProvider key={state.binding}><Outlet /></ToastProvider>
}
