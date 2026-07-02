import { useContext } from 'react'
import { SessionContext } from './SessionProvider'

export function useSession() {
  return useContext(SessionContext)
}
