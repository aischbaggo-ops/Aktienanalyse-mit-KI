import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// Liest die eigene Freischaltung fuer einen Baustein aus feature_access.
// Keine Zeile oder Fehler => nicht freigeschaltet (sicherer Default).
export function useFeatureAccess(feature: string): { loading: boolean; unlocked: boolean } {
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<{ loading: boolean; unlocked: boolean }>({ loading: true, unlocked: false })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setState({ loading: false, unlocked: false })
      return
    }
    let cancelled = false
    setState({ loading: true, unlocked: false })
    supabase
      .from('feature_access')
      .select('unlocked')
      .eq('user_id', user.id)
      .eq('feature', feature)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        setState({ loading: false, unlocked: !error && data?.unlocked === true })
      })
    return () => {
      cancelled = true
    }
  }, [user, authLoading, feature])

  return state
}
