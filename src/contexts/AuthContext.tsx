import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserProfile, FamilyMembership } from '../lib/types'

interface AuthContextType {
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  passwordRecovery: boolean
  clearPasswordRecovery: () => void
  families: FamilyMembership[]
  activeFamilyId: string | null
  activeFamilyName: string | null
  activeRole: 'admin' | 'member' | 'viewer'
  switchFamily: (familyId: string) => void
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

async function fetchMemberships(): Promise<FamilyMembership[]> {
  // Use RPC (SECURITY DEFINER) to bypass RLS
  const { data, error } = await supabase.rpc('get_my_families')
  if (error || !data) return []
  return (data as { id: string; family_id: string; role: string; family_name: string }[]).map(row => ({
    id: row.id,
    family_id: row.family_id,
    role: row.role as 'admin' | 'member' | 'viewer',
    family_name: row.family_name,
  }))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [families, setFamilies] = useState<FamilyMembership[]>([])
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Superadmin viewing
  const [viewingFamilyId, setViewingFamilyId] = useState<string | null>(null)
  const [viewingFamilyName, setViewingFamilyName] = useState<string | null>(null)

  const [passwordRecovery, setPasswordRecovery] = useState(false)

  function setViewingFamily(id: string | null, name?: string | null) {
    setViewingFamilyId(id)
    setViewingFamilyName(name ?? null)
  }

  function switchFamily(familyId: string) {
    setActiveFamilyId(familyId)
    localStorage.setItem('activeFamilyId', familyId)
    // Clear superadmin viewing when switching own families
    setViewingFamilyId(null)
    setViewingFamilyName(null)
  }

  async function loadProfile(userId: string) {
    const [profileData, memberships] = await Promise.all([
      fetchProfile(userId),
      fetchMemberships(),
    ])
    if (profileData) {
      setProfile(profileData)
      // Update last_seen_at (fire and forget)
      supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)
    }

    let finalMemberships = memberships

    // Superadmin: load ALL families so they can switch to any
    if (profileData?.is_superadmin) {
      const { data: allFams } = await supabase
        .from('families')
        .select('id, name')
        .order('name')
      if (allFams && allFams.length > 0) {
        const memberMap = new Map(memberships.map(m => [m.family_id, m]))
        finalMemberships = allFams.map(f => ({
          id: memberMap.get(f.id)?.id ?? `sa-${f.id}`,
          family_id: f.id,
          role: (memberMap.get(f.id)?.role ?? 'admin') as 'admin' | 'member' | 'viewer',
          family_name: f.name ?? 'משפחה',
        }))
      }
    }

    // Fallback: if still empty but user has family_id, use that
    if (finalMemberships.length === 0 && profileData?.family_id) {
      const { data: fam } = await supabase
        .from('families')
        .select('name')
        .eq('id', profileData.family_id)
        .maybeSingle()
      finalMemberships = [{
        id: 'fallback',
        family_id: profileData.family_id,
        role: profileData.role ?? 'member',
        family_name: fam?.name ?? 'משפחה',
      }]
    }

    setFamilies(finalMemberships)

    // Set active family: saved preference → first membership → profile.family_id
    const saved = localStorage.getItem('activeFamilyId')
    const validSaved = saved && finalMemberships.some(m => m.family_id === saved) ? saved : null
    const defaultFamily = finalMemberships[0]?.family_id ?? profileData?.family_id ?? null
    setActiveFamilyId(validSaved ?? defaultFamily)
  }

  async function refreshProfile() {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    const userId = currentSession?.user.id
    if (!userId) return
    await loadProfile(userId)
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
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
      } else if (event === 'SIGNED_IN' && session) {
        loadProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setProfile(null)
        setFamilies([])
        setActiveFamilyId(null)
        setViewingFamilyId(null)
        setViewingFamilyName(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Effective family_id: superadmin viewing → active family
  const effectiveFamilyId = viewingFamilyId ?? activeFamilyId

  // Role in the effective family
  const activeRole: 'admin' | 'member' | 'viewer' = (() => {
    if (viewingFamilyId && profile?.is_superadmin) return 'admin'
    const membership = families.find(f => f.family_id === effectiveFamilyId)
    return membership?.role ?? profile?.role ?? 'viewer'
  })()

  // Active family name
  const activeFamilyName = viewingFamilyName
    ?? families.find(f => f.family_id === activeFamilyId)?.family_name
    ?? null

  return (
    <AuthContext.Provider value={{
      session,
      profile: profile ? { ...profile, family_id: effectiveFamilyId, role: activeRole } : null,
      loading,
      passwordRecovery,
      clearPasswordRecovery: () => setPasswordRecovery(false),
      families,
      activeFamilyId,
      activeFamilyName,
      activeRole,
      switchFamily,
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
