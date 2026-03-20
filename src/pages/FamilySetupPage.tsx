import { useState } from 'react'
import { Users, Plus, LogIn, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'choose' | 'create' | 'join'

export default function FamilySetupPage() {
  const { session, refreshProfile } = useAuth()
  const [mode, setMode]         = useState<Mode>('choose')
  const [familyName, setFamilyName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  function back() { setMode('choose'); setError(null) }

  async function createFamily() {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const { data: family, error: famErr } = await supabase
        .from('families')
        .insert({ name: familyName.trim() })
        .select()
        .single()
      if (famErr) throw famErr

      const { error: userErr } = await supabase
        .from('users')
        .update({ family_id: family.id, role: 'admin' })
        .eq('id', session.user.id)
      if (userErr) throw userErr

      await refreshProfile()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת המשפחה')
    } finally {
      setLoading(false)
    }
  }

  async function joinFamily() {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const { data: family, error: famErr } = await supabase
        .from('families')
        .select('id')
        .eq('invite_code', inviteCode.trim().toLowerCase())
        .maybeSingle()
      if (famErr) throw famErr
      if (!family) throw new Error('קוד הזמנה לא נמצא — בדוק שוב')

      const { error: userErr } = await supabase
        .from('users')
        .update({ family_id: family.id, role: 'member' })
        .eq('id', session.user.id)
      if (userErr) throw userErr

      await refreshProfile()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בהצטרפות')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex flex-col items-center justify-center px-5">

      <div className="text-center mb-8">
        <div className="bg-primary-100 rounded-full p-4 inline-flex mb-4">
          <Users className="w-10 h-10 text-primary-600" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-800">הגדרת משפחה</h1>
        <p className="text-gray-500 text-sm mt-1">צור קבוצה משפחתית או הצטרף לקיימת</p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-7">

        {/* ── Choose ── */}
        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-primary-200 hover:bg-primary-50 active:bg-primary-100 transition-colors text-right"
            >
              <div className="bg-primary-100 rounded-xl p-2.5">
                <Plus className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">צור משפחה חדשה</p>
                <p className="text-xs text-gray-400 mt-0.5">אתה תהיה המנהל</p>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors text-right"
            >
              <div className="bg-gray-100 rounded-xl p-2.5">
                <LogIn className="w-6 h-6 text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">הצטרף למשפחה קיימת</p>
                <p className="text-xs text-gray-400 mt-0.5">באמצעות קוד הזמנה</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Create ── */}
        {mode === 'create' && (
          <>
            <button onClick={back} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
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

        {/* ── Join ── */}
        {mode === 'join' && (
          <>
            <button onClick={back} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
              <ArrowRight className="w-4 h-4" /> חזרה
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-1">קוד הזמנה</h2>
            <p className="text-sm text-gray-400 mb-4">בקש מחבר המשפחה לשלוח לך את הקוד מהגדרות</p>
            <input
              type="text"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && inviteCode && joinFamily()}
              className="input mb-4 text-center font-mono text-xl tracking-widest uppercase"
              placeholder="XXXXXXXX"
              dir="ltr"
              maxLength={8}
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
            <button
              onClick={joinFamily}
              disabled={inviteCode.trim().length < 6 || loading}
              className="btn-primary w-full"
            >
              {loading ? 'מצטרף...' : 'הצטרף 🤝'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
