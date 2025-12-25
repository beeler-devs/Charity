import { useState, useEffect } from 'react'
import { isImpersonating, getImpersonationState, ImpersonationState } from '@/lib/impersonation'

export function useImpersonation() {
  const [impersonating, setImpersonating] = useState(false)
  const [state, setState] = useState<ImpersonationState | null>(null)

  useEffect(() => {
    const checkImpersonation = () => {
      const isImp = isImpersonating()
      const impState = getImpersonationState()
      setImpersonating(isImp)
      setState(impState)
    }

    checkImpersonation()
    // Check periodically in case it changes in another tab
    const interval = setInterval(checkImpersonation, 1000)
    return () => clearInterval(interval)
  }, [])

  return { impersonating, state }
}






