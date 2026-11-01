import { Navigate, createBrowserRouter } from 'react-router'
import { RootFrame } from './RootFrame.tsx'
import { RouteErrorBoundary } from './ErrorBoundary.tsx'
import { AuthRoot } from '../features/auth/AuthRoot.tsx'
import { AuthLayout } from '../layouts/AuthLayout.tsx'
import { StatePage } from '../pages/StatePage.tsx'
import { LoginRoute, EmptyRoute, InitialFallback } from './RouteFrames.tsx'
import type { AuthRuntime } from '../features/auth/runtime.ts'

export function createApplicationRouter(runtime: AuthRuntime) {
  const router = createBrowserRouter([{
    Component: RootFrame, ErrorBoundary: RouteErrorBoundary, HydrateFallback: InitialFallback,
    children: [
      { Component: AuthLayout, children: [
        { path: '/login', Component: LoginRoute },
        { path: '/invitations/accept', lazy: async () => ({ Component: (await import('../pages/InvitationAcceptancePage.tsx')).InvitationAcceptancePage }) },
        { path: '*', element: <StatePage kind="notFound" /> },
      ] },
      { Component: AuthRoot, children: [{
        lazy: async () => ({ Component: (await import('../layouts/AppLayout.tsx')).AppLayout }),
        children: [
          { path: '/', element: <Navigate replace to="/workspace" /> },
          { path: '/workspace', lazy: async () => ({ Component: (await import('../pages/WorkspaceHomePage.tsx')).WorkspaceHomePage }) },
          { path: '/forbidden', element: <StatePage kind="forbidden" /> },
          { lazy: async () => ({ Component: (await import('../app/LegacyWorkspaceAdapter.tsx')).LegacyWorkspaceAdapter }), children: [
            ...['/changes', '/changes/new', '/changes/:changeId', '/changes/:changeId/revise', '/foundation', '/users', '/notifications']
              .map(path => ({ path, Component: EmptyRoute })),
          ] },
        ],
      }] },
    ],
  }])
  runtime.setNavigator((destination, replace) => { void router.navigate(destination, { replace }) })
  return router
}
