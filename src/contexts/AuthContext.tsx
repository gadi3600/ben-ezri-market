import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../lib/types'

interface AuthContextType {
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  viewingFamilyId: string | null
  viewingFamilyName: string | null
  setViewingFamily: (id: string | null, name?: string | null) => void
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

async function fetchProfile(userId: string, retries = 4): Promise<UserProfile | null> {
  for (let i = 0; i < retries; i++) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (data) return data
    if (i < retries - 1) await new Promise(r => setTimeout(r, 600))
  }
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewingFamilyId, setViewingFamilyId] = useState<string | null>(null)
  const [viewingFamilyName, setViewingFamilyName] = useState<string | null>(null)

  function setViewingFamily(id: string | null, name?: string | null) {
    setViewingFamilyId(id)
    setViewingFamilyName(name ?? null)
  }

  async function loadProfile(userId: string) {
    const data = await fetchProfile(userId)
    if (data) setProfile(data)
  }

  async function refreshProfile() {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    const userId = currentSession?.user.id
    if (!userId) return
    const data = await fetchProfile(userId)
    if (data) setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'SIGNED_IN' && session) {
        loadProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setProfile(null)
        setViewingFamilyId(null)
        setViewingFamilyName(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Effective family_id: superadmin viewing another family, or own family
  const effectiveFamilyId = viewingFamilyId ?? profile?.family_id ?? null

  return (
    <AuthContext.Provider value={{
      session,
      profile: profile ? { ...profile, family_id: effectiveFamilyId } : null,
      loading,
      viewingFamilyId,
      viewingFamilyName,
      setViewingFamily,
      refreshProfile,
      signOut: async () => { await supabase.auth.signOut() },
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
