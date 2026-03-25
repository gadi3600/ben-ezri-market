import { useState, useEffect } from 'react'
import { Users, Plus, LogIn, ArrowRight, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface PendingInvite {
  id: string
  role: string
  family_id: string
  family_name: string
}

export default function FamilySetupPage() {
  const { session, refreshProfile } = useAuth()
  const [mode, setMode]         = useState<'loading' | 'choose' | 'create'>('loading')
  const [familyName, setFamilyName] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [joiningId, setJoiningId] = useState<string | null>(null)

  // Check for pending invites on mount
  useEffect(() => {
    if (!session?.user?.email) { setMode('choose'); return }
    checkInvites(session.user.email)
  }, [session?.user?.email])

  async function checkInvites(email: string) {
    const { data } = await supabase
      .from('invites')
      .select('id, role, family_id')
      .eq('email', email.toLowerCase())

    if (data && data.length > 0) {
      // Fetch family names
      const familyIds = [...new Set(data.map(d => d.family_id))]
      const { data: families } = await supabase
        .from('families')
        .select('id, name')
        .in('id', familyIds)
      const nameMap = new Map((families ?? []).map(f => [f.id, f.name ?? 'משפחה']))

      setPendingInvites(data.map(inv => ({
        id: inv.id,
        role: inv.role,
        family_id: inv.family_id,
        family_name: nameMap.get(inv.family_id) ?? 'משפחה',
      })))
    }
    setMode('choose')
  }

  async function joinViaInvite(invite: PendingInvite) {
    if (!session) return
    setJoiningId(invite.id)
    setError(null)
    try {
      // Add to family_members
      await supabase.from('family_members').insert({
        user_id: session.user.id,
        family_id: invite.family_id,
        role: invite.role,
      })
      // Update users.family_id for backward compat
      await supabase.from('users').update({
        family_id: invite.family_id,
        role: invite.role,
      }).eq('id', session.user.id)
      // Delete the used invite
      await supabase.from('invites').delete().eq('id', invite.id)
      await refreshProfile()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setJoiningId(null)
    }
  }

  async function createFamily() {
    if (!session || !familyName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { data: famId, error: famErr } = await supabase.rpc('create_family_with_admin', {
        family_name: familyName.trim(),
      })
      if (famErr) throw famErr
      if (!famId) throw new Error('Failed to create family')

      // Update users.family_id for backward compat
      await supabase.from('users').update({
        family_id: famId,
        role: 'admin',
      }).eq('id', session.user.id)

      await refreshProfile()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 to-white">
      <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex flex-col items-center justify-center px-5">

      <div className="text-center mb-8">
        <div className="bg-primary-100 rounded-full p-4 inline-flex mb-4">
          <Users className="w-10 h-10 text-primary-600" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-800">הגדרת משפחה</h1>
        <p className="text-gray-500 text-sm mt-1">
          {pendingInvites.length > 0
            ? 'יש לך הזמנות ממתינות!'
            : 'צור קבוצה משפחתית חדשה'}
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-7">

        {mode === 'choose' && (
          <div className="space-y-3">
            {/* Pending invites */}
            {pendingInvites.map(inv => (
              <button
                key={inv.id}
                onClick={() => joinViaInvite(inv)}
                disabled={!!joiningId}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-primary-200
                           bg-primary-50 hover:bg-primary-100 active:bg-primary-200 transition-colors text-right"
              >
                <div className="bg-primary-500 rounded-xl p-2.5 flex-shrink-0">
                  {joiningId === inv.id
                    ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                    : <LogIn className="w-6 h-6 text-white" />
                  }
                </div>
                <div className="flex-1">
                  <p className="font-bold text-primary-800">הצטרף למשפחת {inv.family_name}</p>
                  <p className="text-xs text-primary-600 mt-0.5">
                    תפקיד: {inv.role === 'admin' ? 'מנהל' : inv.role === 'viewer' ? 'צופה' : 'חבר'}
                  </p>
                </div>
              </button>
            ))}

            {/* Create new family */}
            <button
              onClick={() => setMode('create')}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors text-right ${
                pendingInvites.length > 0
                  ? 'border-gray-200 hover:bg-gray-50'
                  : 'border-primary-200 hover:bg-primary-50'
              }`}
            >
              <div className={`rounded-xl p-2.5 ${pendingInvites.length > 0 ? 'bg-gray-100' : 'bg-primary-100'}`}>
                <Plus className={`w-6 h-6 ${pendingInvites.length > 0 ? 'text-gray-500' : 'text-primary-600'}`} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">צור משפחה חדשה</p>
                <p className="text-xs text-gray-400 mt-0.5">אתה תהיה המנהל</p>
              </div>
            </button>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </div>
        )}

        {mode === 'create' && (
          <>
            <button onClick={() => { setMode('choose'); setError(null) }}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
              <ArrowRight className="w-4 h-4" /> חזרה
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-4">שם המשפחה</h2>
            <input
              type="text"
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && familyName && createFamily()}
              className="input mb-4"
              placeholder="למשל: משפחת בן עזרי"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
            <button
              onClick={createFamily}
              disabled={!familyName.trim() || loading}
              className="btn-primary w-full"
            >
              {loading ? 'יוצר...' : 'צור משפחה 🏠'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
