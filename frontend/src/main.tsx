import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthProvider } from './features/auth/AuthProvider.tsx'
import { AuthRoot } from './features/auth/AuthRoot.tsx'
import { createBrowserRuntime } from './features/auth/runtime.ts'

const runtime = createBrowserRuntime()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider runtime={runtime}><AuthRoot /></AuthProvider>
  </StrictMode>,
)
