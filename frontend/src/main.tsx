import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router/dom'
import { AppProviders } from './app/AppProviders.tsx'
import { createApplicationRouter } from './app/router.tsx'
import { createPresentation } from './preferences/bootstrap.ts'
import { createBrowserRuntime } from './features/auth/runtime.ts'

const runtime = createBrowserRuntime()
const presentation = createPresentation()
const router = createApplicationRouter(runtime)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders runtime={runtime} {...presentation}><RouterProvider router={router} onError={() => { /* Generic boundary; never log auth/request objects. */ }} /></AppProviders>
  </StrictMode>,
)
