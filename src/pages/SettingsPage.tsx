import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  User, Users, Copy, Check, LogOut, Store as StoreIcon, Crown,
  Plus, Trash2, Loader2, Pencil, X, CheckCircle2, Bell, Mail,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { registerPushSubscription } from '../lib/push'
import { isAdmin, canEdit, roleLabel } from '../lib/permissions'
import type { Family, UserProfile, Store } from '../lib/types'
import type { Role } from '../lib/permissions'

// ── Section wrapper — defined OUTSIDE component so React never remounts it ────
function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-primary-100 rounded-xl p-2">{icon}</div>
        <h3 className="font-bold text-gray-800 text-base">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [family, setFamily]   = useState<Family | null>(null)
  const [members, setMembers] = useState<UserProfile[]>([])
  const [stores, setStores]   = useState<Store[]>([])
  const [codeCopied, setCodeCopied] = useState(false)
  const [editName, setEditName]     = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved]   = useState(false)

  // Add store
  const [newStoreName, setNewStoreName] = useState('')
  const [addingStore, setAddingStore]   = useState(false)
  const [storeError, setStoreError]     = useState<string | null>(null)

  // Inline edit store
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null)
  const [editStoreName, setEditStoreName]   = useState('')

  // Push notifications
  const [pushEnabled, setPushEnabled]     = useState(false)
  const [pushLoading, setPushLoading]     = useState(false)

  // Invites (admin only)
  const [invites, setInvites]             = useState<{ id: string; email: string; role: Role }[]>([])
  const [newInviteEmail, setNewInviteEmail] = useState('')
  const [newInviteRole, setNewInviteRole]   = useState<Role>('member')
  const [inviting, setInviting]           = useState(false)
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    setEditName(profile.full_name)
    if (profile.family_id) {
      loadFamilyData(profile.family_id)
      if (isAdmin(profile.role)) loadInvites(profile.family_id)
    }
    loadStores()
    checkPushStatus()
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  async function checkPushStatus() {
    if (!profile) return
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle()
      if (error) {
        console.warn('checkPushStatus error:', error.message)
        setPushEnabled(false)
        return
      }
      setPushEnabled(!!data)
    } catch {
      setPushEnabled(false)
    }
  }

  async function togglePush() {
    if (!profile?.family_id) return
    setPushLoading(true)

    try {
      if (pushEnabled) {
        // Disable: delete subscription from Supabase
        await supabase.from('push_subscriptions').delete().eq('user_id', profile.id)
        localStorage.removeItem('pushBannerDismissed')
        setPushEnabled(false)
      } else {
        // Enable: register push — this requests browser permission
        console.log('togglePush: calling registerPushSubscription...')
        const ok = await registerPushSubscription(profile.id, profile.family_id)
        console.log('togglePush: result =', ok)
        if (ok) {
          setPushEnabled(true)
          localStorage.setItem('pushBannerDismissed', 'true')
        }
      }
    } catch (err) {
      console.error('togglePush error:', err)
    }

    setPushLoading(false)
  }

  async function loadFamilyData(familyId: string) {
    const [{ data: fam }, { data: mems }] = await Promise.all([
      supabase.from('families').select('*').eq('id', familyId).single(),
      supabase.from('users').select('*').eq('family_id', familyId).order('created_at'),
    ])
    if (fam)  setFamily(fam)
    if (mems) setMembers(mems)
  }

  async function loadInvites(familyId: string) {
    const { data } = await supabase
      .from('invites')
      .select('id, email, role')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
    setInvites((data as { id: string; email: string; role: Role }[]) ?? [])
  }

  function inviteLink(inviteId: string, role: Role) {
    const base = window.location.origin
    return `${base}/join?token=${inviteId}&role=${role}`
  }

  function copyToClipboard(text: string) {
    // Try modern API first
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
      return
    }
    fallbackCopy(text)
  }

  function fallbackCopy(text: string) {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    el.style.top = '-9999px'
    document.body.appendChild(el)
    el.focus()
    el.select()
    try { document.execCommand('copy') } catch { /* ignore */ }
    document.body.removeChild(el)
  }

  async function sendInvite() {
    alert(`DEBUG sendInvite called!\nemail: "${newInviteEmail}"\nfamily_id: ${profile?.family_id ?? 'NULL'}\ninviting: ${inviting}\nrole: ${profile?.role ?? 'NULL'}`)
    if (!newInviteEmail.trim() || !profile?.family_id || inviting) return
    setInviting(true)

    const payload = {
      email:      newInviteEmail.trim().toLowerCase(),
      role:       newInviteRole,
      family_id:  profile.family_id,
      invited_by: profile.id,
    }

    alert(`שולח הזמנה...\nfamily_id: ${payload.family_id}\nemail: ${payload.email}\nrole: ${payload.role}\nprofile.role: ${profile.role}`)

    const { data, error } = await supabase.from('invites').insert(payload).select('id').single()

    if (error) {
      alert(`שגיאה מסופאבייס:\ncode: ${error.code}\nmessage: ${error.message}\ndetails: ${error.details ?? 'none'}\nhint: ${error.hint ?? 'none'}`)
    } else if (data) {
      const link = inviteLink(data.id, newInviteRole)
      copyToClipboard(link)
      alert(`הזמנה נוצרה בהצלחה!\n\nלינק:\n${link}`)
      setNewInviteEmail('')
      await loadInvites(profile.family_id)
    } else {
      alert('תגובה לא צפויה: אין data ואין error')
    }
    setInviting(false)
  }

  async function copyInviteLink(inv: { id: string; role: Role }) {
    const link = inviteLink(inv.id, inv.role)
    copyToClipboard(link)
    setCopiedInviteId(inv.id)
    setTimeout(() => setCopiedInviteId(null), 2000)
  }

  async function deleteInvite(id: string) {
    await supabase.from('invites').delete().eq('id', id)
    setInvites(prev => prev.filter(i => i.id !== id))
  }

  async function changeUserRole(userId: string, newRole: Role) {
    await supabase.from('users').update({ role: newRole }).eq('id', userId)
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m))
  }

  async function removeUser(userId: string, name: string) {
    if (!confirm(`להסיר את ${name} מהמשפחה?`)) return
    await supabase.from('users').update({ family_id: null, role: 'member' }).eq('id', userId)
    setMembers(prev => prev.filter(m => m.id !== userId))
  }

  async function loadStores() {
    const { data } = await supabase
      .from('stores').select('*').eq('is_active', true).order('name')
    if (data) setStores(data)
  }

  async function addStore() {
    if (!newStoreName.trim() || !profile?.family_id || addingStore) return
    setAddingStore(true)
    setStoreError(null)
    const { data, error } = await supabase
      .from('stores')
      .insert({ name: newStoreName.trim(), is_active: true })
      .select()
      .single()
    if (error) {
      setStoreError(error.message)
    } else if (data) {
      setStores(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'he')))
      setNewStoreName('')
    }
    setAddingStore(false)
  }

  function startEditStore(id: string, name: string) {
    setEditingStoreId(id)
    setEditStoreName(name)
  }

  async function saveEditStore(id: string) {
    const trimmed = editStoreName.trim()
    if (!trimmed) return
    const { error } = await supabase
      .from('stores')
      .update({ name: trimmed })
      .eq('id', id)
    if (!error) {
      setEditingStoreId(null)
      await loadStores()
    }
  }

  async function deleteStore(id: string, name: string) {
    const { count } = await supabase
      .from('purchases')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', id)
    if (count !== null && count > 0) {
      alert(`לא ניתן למחוק את החנות כי יש ${count} קניות משויכות אליה`)
      return
    }
    if (!confirm(`למחוק את "${name}"?`)) return
    const { error } = await supabase.from('stores').delete().eq('id', id)
    if (!error) setStores(prev => prev.filter(s => s.id !== id))
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
    copyToClipboard(family.invite_code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2500)
  }

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
            תפקיד: {profile.role === 'admin' ? '👑 מנהל' : profile.role === 'viewer' ? '👁️ צופה' : '👤 חבר'}
          </p>
        )}
      </Section>

      {/* ── Family ── */}
      {family ? (
        <Section icon={<Users className="w-5 h-5 text-primary-600" />} title={family.name}>
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
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-700 block truncate">{m.full_name}</span>
                  <span className="text-xs text-gray-400">{roleLabel(m.role)}</span>
                </div>
                {m.id === profile?.id && (
                  <span className="text-xs text-primary-500 font-medium">אני</span>
                )}
                {isAdmin(profile!.role) && m.id !== profile?.id && (
                  <>
                    <select
                      value={m.role}
                      onChange={e => changeUserRole(m.id, e.target.value as Role)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white
                                 focus:outline-none focus:ring-1 focus:ring-primary-300"
                    >
                      <option value="admin">מנהל</option>
                      <option value="member">חבר</option>
                      <option value="viewer">צופה</option>
                    </select>
                    <button
                      onClick={() => removeUser(m.id, m.full_name)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500
                                 hover:bg-red-50 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {!isAdmin(profile!.role) && m.role === 'admin' && (
                  <Crown className="w-4 h-4 text-amber-400" />
                )}
              </div>
            ))}
          </div>

          {/* ── Invite user (admin only) ── */}
          {isAdmin(profile!.role) && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-4 h-4 text-primary-500" />
                <p className="text-sm font-semibold text-gray-600">הזמן משתמש</p>
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  type="email"
                  value={newInviteEmail}
                  onChange={e => setNewInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendInvite()}
                  placeholder="אימייל..."
                  className="input flex-1 text-sm"
                  dir="ltr"
                />
                <select
                  value={newInviteRole}
                  onChange={e => setNewInviteRole(e.target.value as Role)}
                  className="text-sm border-2 border-gray-200 rounded-xl px-3 py-2 bg-white
                             focus:outline-none focus:ring-0 focus:border-primary-400"
                >
                  <option value="member">חבר</option>
                  <option value="viewer">צופה</option>
                  <option value="admin">מנהל</option>
                </select>
                <button
                  onClick={sendInvite}
                  disabled={!newInviteEmail.trim() || inviting}
                  className="btn-primary px-3.5 flex-shrink-0 disabled:opacity-40"
                >
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                הלינק יועתק אוטומטית — שלח ב-WhatsApp, SMS וכו'
              </p>

              {/* Pending invites */}
              {invites.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500">הזמנות ממתינות</p>
                  {invites.map(inv => (
                    <div key={inv.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                      <span className="flex-1 text-xs text-gray-600 truncate" dir="ltr">{inv.email}</span>
                      <span className="text-xs text-gray-400">{roleLabel(inv.role)}</span>
                      <button
                        onClick={() => copyInviteLink(inv)}
                        className="p-1 text-gray-400 hover:text-primary-500 transition-colors"
                        title="העתק לינק"
                      >
                        {copiedInviteId === inv.id
                          ? <Check className="w-3.5 h-3.5 text-primary-500" />
                          : <Copy className="w-3.5 h-3.5" />
                        }
                      </button>
                      <button
                        onClick={() => deleteInvite(inv.id)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>
      ) : (
        <div className="card text-center py-6">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">לא משויך למשפחה</p>
        </div>
      )}

      {/* ── Stores (editors only) ── */}
      {canEdit(profile!.role) && (
      <Section icon={<StoreIcon className="w-5 h-5 text-primary-600" />} title="חנויות">
        {/* Add store */}
        <div className="flex gap-2 mb-1">
          <input
            type="text"
            value={newStoreName}
            onChange={e => { setNewStoreName(e.target.value); setStoreError(null) }}
            onKeyDown={e => e.key === 'Enter' && addStore()}
            placeholder="שם חנות חדשה..."
            className="input flex-1 text-sm"
          />
          <button
            onClick={addStore}
            disabled={!newStoreName.trim() || addingStore}
            className="btn-primary px-3.5 flex-shrink-0 disabled:opacity-40"
          >
            {addingStore
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Plus className="w-4 h-4" />
            }
          </button>
        </div>
        {storeError && (
          <p className="text-xs text-red-500 mb-2 px-1">{storeError}</p>
        )}

        {/* Store list */}
        {stores.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">אין חנויות מוגדרות עדיין</p>
        ) : (
          <div className="divide-y divide-gray-50 mt-3">
            {stores.map(s => (
              <div key={s.id} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" />

                {editingStoreId === s.id ? (
                  /* ── Inline edit row ── */
                  <>
                    <input
                      autoFocus
                      value={editStoreName}
                      onChange={e => setEditStoreName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  saveEditStore(s.id)
                        if (e.key === 'Escape') setEditingStoreId(null)
                      }}
                      className="input flex-1 text-sm py-1.5"
                    />
                    <button
                      onClick={() => saveEditStore(s.id)}
                      className="p-2 rounded-lg text-primary-500 hover:bg-primary-50 active:bg-primary-100 transition-colors flex-shrink-0"
                      title="שמור"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingStoreId(null)}
                      className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
                      title="בטל"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  /* ── Normal row ── */
                  <>
                    <span className="flex-1 font-medium text-gray-700 text-sm">{s.name}</span>
                    <button
                      onClick={() => startEditStore(s.id, s.name)}
                      className="p-2 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 active:bg-primary-100 transition-colors flex-shrink-0"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteStore(s.id, s.name)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
      )}

      {/* ── Notifications (editors only) ── */}
      {canEdit(profile!.role) && (
      <Section icon={<Bell className="w-5 h-5 text-primary-600" />} title="התראות">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700">התראות על פריטים חדשים ברשימה</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {pushEnabled ? 'תקבל התראה כשבני המשפחה מוסיפים פריטים' : 'התראות כבויות'}
            </p>
          </div>
          <button
            onClick={togglePush}
            disabled={pushLoading}
            className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
              pushEnabled ? 'bg-primary-500' : 'bg-gray-300'
            } ${pushLoading ? 'opacity-60' : ''}`}
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
              pushEnabled ? 'left-[22px]' : 'left-0.5'
            }`} />
          </button>
        </div>
        {'Notification' in window && Notification.permission === 'denied' && (
          <p className="text-xs text-red-500 mt-3">
            ההתראות חסומות בדפדפן. יש לאפשר אותן בהגדרות הדפדפן.
          </p>
        )}
      </Section>
      )}

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
