import { createContext } from 'react'
import type { AuthRuntime } from './runtime.ts'
export const AuthContext = createContext<AuthRuntime | null>(null)
