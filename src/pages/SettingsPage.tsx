import { useState, useEffect } from 'react'
import { User, Users, Copy, Check, LogOut, Store as StoreIcon, Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Family, UserProfile, Store } from '../lib/types'

export default function SettingsPage() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [family, setFamily]   = useState<Family | null>(null)
  const [members, setMembers] = useState<UserProfile[]>([])
  const [stores, setStores]   = useState<Store[]>([])
  const [codeCopied, setCodeCopied] = useState(false)
  const [editName, setEditName]     = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved]   = useState(false)

  useEffect(() => {
    if (!profile) return
    setEditName(profile.full_name)
    if (profile.family_id) loadFamilyData(profile.family_id)
    loadStores()
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFamilyData(familyId: string) {
    const [{ data: fam }, { data: mems }] = await Promise.all([
      supabase.from('families').select('*').eq('id', familyId).single(),
      supabase.from('users').select('*').eq('family_id', familyId).order('created_at'),
    ])
    if (fam)  setFamily(fam)
    if (mems) setMembers(mems)
  }

  async function loadStores() {
    const { data } = await supabase
      .from('stores').select('*').eq('is_active', true).order('name')
    if (data) setStores(data)
  }

  async function saveName() {
    if (!profile || savingName) return
    setSavingName(true)
    await supabase.from('users').update({ full_name: editName.trim() }).eq('id', profile.id)
    await refreshProfile()
    setSavingName(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  function copyInviteCode() {
    if (!family?.invite_code) return
    navigator.clipboard.writeText(family.invite_code).catch(() => {})
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2500)
  }

  // ── Section wrapper ──
  const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-primary-100 rounded-xl p-2">{icon}</div>
        <h3 className="font-bold text-gray-800 text-base">{title}</h3>
      </div>
      {children}
    </div>
  )

  return (
    <div className="space-y-4 pb-32">

      {/* ── Profile ── */}
      <Section icon={<User className="w-5 h-5 text-primary-600" />} title="הפרופיל שלי">
        <label className="block text-sm text-gray-500 mb-1.5">שם מלא</label>
        <div className="flex gap-2">
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            className="input flex-1"
          />
          <button
            onClick={saveName}
            disabled={savingName || editName.trim() === profile?.full_name || !editName.trim()}
            className={`btn-primary px-4 min-w-[72px] ${nameSaved ? '!bg-primary-500' : ''}`}
          >
            {nameSaved ? '✓' : savingName ? '...' : 'שמור'}
          </button>
        </div>
        {profile?.family_id && (
          <p className="text-xs text-gray-400 mt-2">
            תפקיד: {profile.role === 'admin' ? '👑 מנהל' : 'חבר'}
          </p>
        )}
      </Section>

      {/* ── Family ── */}
      {family ? (
        <Section icon={<Users className="w-5 h-5 text-primary-600" />} title={family.name}>
          {/* Invite code */}
          <label className="block text-sm text-gray-500 mb-1.5">
            שתף קוד הזמנה עם בני המשפחה
          </label>
          <div className="flex gap-2 mb-5">
            <div className="flex-1 bg-primary-50 border-2 border-primary-200 rounded-xl
                            text-center font-mono text-xl font-extrabold tracking-[0.25em]
                            text-primary-700 py-3 px-2 select-all">
              {family.invite_code?.toUpperCase()}
            </div>
            <button
              onClick={copyInviteCode}
              className="btn-secondary px-4 flex-shrink-0 min-w-[52px]"
            >
              {codeCopied
                ? <Check className="w-5 h-5 text-primary-600" />
                : <Copy className="w-5 h-5" />
              }
            </button>
          </div>

          {/* Members */}
          <p className="text-sm font-semibold text-gray-600 mb-3">
            חברי המשפחה ({members.length})
          </p>
          <div className="space-y-2.5">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center
                                text-sm font-extrabold text-primary-700 flex-shrink-0">
                  {m.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <span className="flex-1 font-medium text-gray-700">{m.full_name}</span>
                {m.id === profile?.id && (
                  <span className="text-xs text-primary-500 font-medium">אני</span>
                )}
                {m.role === 'admin' && (
                  <Crown className="w-4 h-4 text-amber-400" />
                )}
              </div>
            ))}
          </div>
        </Section>
      ) : (
        <div className="card text-center py-6">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">לא משויך למשפחה</p>
        </div>
      )}

      {/* ── Stores ── */}
      <Section icon={<StoreIcon className="w-5 h-5 text-primary-600" />} title="חנויות">
        <div className="divide-y divide-gray-50">
          {stores.map(s => (
            <div key={s.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="w-2.5 h-2.5 rounded-full bg-primary-400 flex-shrink-0" />
              <span className="flex-1 font-medium text-gray-700">{s.name}</span>
              {s.website && (
                <a
                  href={s.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-500 hover:text-primary-700 hover:underline"
                >
                  אתר
                </a>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── Sign out ── */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-3.5 text-red-500
                   font-semibold hover:bg-red-50 active:bg-red-100 rounded-2xl transition-colors"
      >
        <LogOut className="w-5 h-5" />
        יציאה מהחשבון
      </button>
    </div>
  )
}
