import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  User, Users, Copy, Check, LogOut, Store as StoreIcon, Crown,
  Plus, Trash2, Loader2, Pencil, X, CheckCircle2, Bell, Mail, KeyRound,
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
  const { session, profile, refreshProfile, signOut, setViewingFamily, families, switchFamily, activeFamilyId, activeFamilyName } = useAuth()
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

  // Superadmin
  const [allFamilies, setAllFamilies] = useState<{ id: string; name: string; member_count: number }[]>([])
  const [newFamilyName, setNewFamilyName] = useState('')
  const [newFamilyEmail, setNewFamilyEmail] = useState('')
  const [creatingFamily, setCreatingFamily] = useState(false)

  // Add existing user to family (superadmin)
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<{ id: string; full_name: string; email: string }[]>([])
  const [addUserRole, setAddUserRole] = useState<Role>('member')
  const [addingUser, setAddingUser] = useState(false)

  useEffect(() => {
    if (!profile) return
    setEditName(profile.full_name)
    if (profile.family_id) {
      loadFamilyData(profile.family_id)
      if (isAdmin(profile.role)) loadInvites(profile.family_id)
    }
    loadStores()
    checkPushStatus()
    if (profile.is_superadmin) loadAllFamilies()
  }, [profile?.id, profile?.family_id, profile?.role]) // eslint-disable-line react-hooks/exhaustive-deps

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
    // 1. Load family + membership rows
    const [{ data: fam }, { data: memberRows }] = await Promise.all([
      supabase.from('families').select('*').eq('id', familyId).single(),
      supabase.from('family_members').select('user_id, role').eq('family_id', familyId),
    ])
    if (fam) setFamily(fam)
    if (!memberRows?.length) { setMembers([]); return }

    // 2. Load user details for all member user_ids
    const userIds = memberRows.map(r => r.user_id)
    const { data: userData } = await supabase
      .from('users')
      .select('id, full_name, avatar_url, created_at, updated_at')
      .in('id', userIds)

    const userMap = new Map((userData ?? []).map(u => [u.id, u]))
    const mems: UserProfile[] = memberRows.map(r => {
      const u = userMap.get(r.user_id)
      return {
        id: r.user_id,
        family_id: familyId,
        full_name: u?.full_name ?? '',
        avatar_url: u?.avatar_url ?? null,
        role: r.role as 'admin' | 'member' | 'viewer',
        is_superadmin: false,
        created_at: u?.created_at ?? '',
        updated_at: u?.updated_at ?? '',
      }
    }).filter(m => m.full_name)
    setMembers(mems)
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
    if (!newInviteEmail.trim() || !profile?.family_id || inviting) return
    setInviting(true)

    const { data, error } = await supabase.from('invites').insert({
      email:      newInviteEmail.trim().toLowerCase(),
      role:       newInviteRole,
      family_id:  profile.family_id,
      invited_by: profile.id,
    }).select('id').single()

    if (error) {
      console.error('sendInvite error:', error)
    } else if (data) {
      const link = inviteLink(data.id, newInviteRole)
      copyToClipboard(link)
      setNewInviteEmail('')
      await loadInvites(profile.family_id)
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
    if (!profile?.family_id) return
    const currentMember = members.find(m => m.id === userId)

    // Prevent demoting last admin (unless superadmin)
    if (currentMember?.role === 'admin' && newRole !== 'admin' && !profile.is_superadmin) {
      const adminCount = members.filter(m => m.role === 'admin').length
      if (adminCount <= 1) {
        alert('לא ניתן לשנות את התפקיד של המנהל האחרון במשפחה')
        return
      }
    }

    const { error } = await supabase
      .from('family_members')
      .update({ role: newRole })
      .eq('user_id', userId)
      .eq('family_id', profile.family_id)
    if (error) return
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m))
  }

  async function removeUser(userId: string, name: string) {
    if (!profile?.family_id) return

    // Prevent removing last admin (unless superadmin)
    const member = members.find(m => m.id === userId)
    if (member?.role === 'admin' && !profile.is_superadmin) {
      const adminCount = members.filter(m => m.role === 'admin').length
      if (adminCount <= 1) {
        alert('לא ניתן להסיר את המנהל האחרון מהמשפחה')
        return
      }
    }

    if (!confirm(`להסיר את ${name} מהמשפחה?`)) return
    await supabase.from('family_members').delete().eq('user_id', userId).eq('family_id', profile.family_id)
    setMembers(prev => prev.filter(m => m.id !== userId))
  }

  // ── Add existing user to family (superadmin) ──
  async function searchUsers(query: string) {
    setUserSearch(query)
    if (query.trim().length < 2) { setUserResults([]); return }
    const { data } = await supabase.rpc('search_users', { query: query.trim() })
    const memberIds = new Set(members.map(m => m.id))
    setUserResults(((data ?? []) as { id: string; full_name: string; email: string }[]).filter(u => !memberIds.has(u.id)))
  }

  async function resetUserPassword(userId: string, userName: string) {
    // Find user's email via RPC
    const { data } = await supabase.rpc('search_users', { query: userName })
    const user = (data as { id: string; email: string }[] | null)?.find(u => u.id === userId)
    if (!user?.email) { alert('לא נמצא אימייל למשתמש'); return }
    if (!confirm(`לשלוח מייל איפוס סיסמה ל-${userName} (${user.email})?`)) return
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/`,
    })
    if (error) { alert('שגיאה: ' + error.message); return }
    alert(`נשלח מייל איפוס סיסמה ל-${user.email}`)
  }

  async function addExistingUser(userId: string, userName: string) {
    if (!profile?.family_id || addingUser) return
    setAddingUser(true)
    const { error } = await supabase.from('family_members').insert({
      user_id: userId,
      family_id: profile.family_id,
      role: addUserRole,
    })
    if (error) {
      alert(error.message.includes('duplicate') ? 'המשתמש כבר שייך למשפחה' : error.message)
    } else {
      // Add to local state
      setMembers(prev => [...prev, {
        id: userId,
        family_id: profile.family_id!,
        full_name: userName,
        avatar_url: null,
        role: addUserRole,
        is_superadmin: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      setUserSearch('')
      setUserResults([])
    }
    setAddingUser(false)
  }

  // ── Superadmin functions ──
  async function loadAllFamilies() {
    // Two separate queries — avoids join/RLS issues
    const [famsRes, membersRes] = await Promise.all([
      supabase.from('families').select('id, name').order('name'),
      supabase.from('family_members').select('family_id'),
    ])
    const fams = famsRes.data
    const members = membersRes.data
    console.log('loadAllFamilies:', {
      fams: fams?.length ?? 0, famsError: famsRes.error?.message ?? null,
      members: members?.length ?? 0, membersError: membersRes.error?.message ?? null,
    })

    if (!fams) return

    // Count members per family on client
    const countMap: Record<string, number> = {}
    for (const m of members ?? []) {
      countMap[m.family_id] = (countMap[m.family_id] ?? 0) + 1
    }

    setAllFamilies(fams.map((f: { id: string; name: string }) => ({
      id: f.id,
      name: f.name ?? 'ללא שם',
      member_count: countMap[f.id] ?? 0,
    })))
  }

  async function createNewFamily() {
    if (!newFamilyName.trim() || creatingFamily) return
    setCreatingFamily(true)
    const { data: fam, error: famErr } = await supabase
      .from('families')
      .insert({ name: newFamilyName.trim() })
      .select('id')
      .single()
    if (famErr || !fam) {
      alert('שגיאה ביצירת משפחה: ' + (famErr?.message ?? ''))
      setCreatingFamily(false)
      return
    }
    if (newFamilyEmail.trim()) {
      // Create invite for the admin
      const { data: inv } = await supabase
        .from('invites')
        .insert({
          email: newFamilyEmail.trim().toLowerCase(),
          role: 'admin',
          family_id: fam.id,
          invited_by: profile!.id,
        })
        .select('id')
        .single()
      if (inv) {
        const link = `${window.location.origin}/join?token=${inv.id}&role=admin`
        fallbackCopy(link)
        alert(`משפחה נוצרה!\n\nלינק הזמנה למנהל:\n${link}\n\n(הלינק הועתק ללוח)`)
      }
    } else {
      alert('משפחה נוצרה בהצלחה!')
    }
    setNewFamilyName('')
    setNewFamilyEmail('')
    setCreatingFamily(false)
    loadAllFamilies()
  }

  async function createFamilyInviteLink(familyId: string, familyName: string) {
    const { data: inv } = await supabase
      .from('invites')
      .insert({
        email: `invite-${Date.now()}@pending.com`,
        role: 'member' as Role,
        family_id: familyId,
        invited_by: profile!.id,
      })
      .select('id')
      .single()
    if (inv) {
      const link = `${window.location.origin}/join?token=${inv.id}&role=member`
      fallbackCopy(link)
      alert(`לינק הזמנה ל${familyName}:\n${link}\n\n(הועתק ללוח)`)
    }
  }

  async function leaveAndCreateFamily() {
    if (!profile?.family_id || !session) return
    const familyName = activeFamilyName ?? 'המשפחה הנוכחית'
    if (!confirm(`האם אתה בטוח?\n\nתעזוב את משפחת ${familyName} ותיצור משפחה חדשה.\nפעולה זו לא ניתנת לביטול.`)) return

    const newName = prompt('שם המשפחה החדשה:')
    if (!newName?.trim()) return

    try {
      // Remove from current family
      await supabase.from('family_members').delete()
        .eq('user_id', session.user.id)
        .eq('family_id', profile.family_id)

      // Create new family
      const { data: fam } = await supabase
        .from('families')
        .insert({ name: newName.trim() })
        .select('id')
        .single()
      if (!fam) { alert('שגיאה ביצירת משפחה'); return }

      // Add as admin
      await supabase.from('family_members').insert({
        user_id: session.user.id,
        family_id: fam.id,
        role: 'admin',
      })
      await supabase.from('users').update({
        family_id: fam.id,
        role: 'admin',
      }).eq('id', session.user.id)

      await refreshProfile()
      switchFamily(fam.id)
    } catch (err) {
      alert('שגיאה: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  async function loadStores() {
    const { data } = await supabase
      .from('stores').select('*').eq('is_active', true).eq('family_id', profile!.family_id).order('name')
    if (data) setStores(data)
  }

  async function addStore() {
    if (!newStoreName.trim() || !profile?.family_id || addingStore) return
    setAddingStore(true)
    setStoreError(null)
    const { data, error } = await supabase
      .from('stores')
      .insert({ name: newStoreName.trim(), is_active: true, family_id: profile!.family_id })
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
      {/* ── Family switcher (if multiple families) ── */}
      {families.length > 1 && (
        <div className="card mb-4">
          <p className="text-sm font-bold text-gray-700 mb-2">המשפחות שלי</p>
          <div className="space-y-1">
            {families.map(f => (
              <button
                key={f.family_id}
                onClick={() => switchFamily(f.family_id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  f.family_id === activeFamilyId
                    ? 'bg-primary-50 text-primary-700 font-bold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-right">{f.family_name}</span>
                <span className="text-xs text-gray-400">{roleLabel(f.role)}</span>
                {f.family_id === activeFamilyId && (
                  <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

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
                    {profile?.is_superadmin && (
                      <button
                        onClick={() => resetUserPassword(m.id, m.full_name)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-amber-500
                                   hover:bg-amber-50 transition-colors flex-shrink-0"
                        title="איפוס סיסמה"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                    )}
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

          {/* ── Add existing user (superadmin only) ── */}
          {profile?.is_superadmin && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-600 mb-2">הוסף משתמש קיים למשפחה</p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => searchUsers(e.target.value)}
                  placeholder="חפש לפי שם..."
                  className="input flex-1 text-sm"
                />
                <select
                  value={addUserRole}
                  onChange={e => setAddUserRole(e.target.value as Role)}
                  className="text-sm border-2 border-gray-200 rounded-xl px-3 py-2 bg-white
                             focus:outline-none focus:ring-0 focus:border-primary-400"
                >
                  <option value="admin">מנהל</option>
                  <option value="member">חבר</option>
                  <option value="viewer">צופה</option>
                </select>
              </div>
              {userResults.length > 0 && (
                <div className="bg-gray-50 rounded-xl overflow-hidden mb-2">
                  {userResults.map(u => (
                    <button
                      key={u.id}
                      onClick={() => addExistingUser(u.id, u.full_name)}
                      disabled={addingUser}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-right
                                 hover:bg-primary-50 transition-colors border-b border-gray-100 last:border-0"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center
                                      text-xs font-extrabold text-primary-700 flex-shrink-0">
                        {u.full_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-700 truncate">{u.full_name}</p>
                        <p className="text-xs text-gray-400 truncate" dir="ltr">{u.email}</p>
                      </div>
                      <Plus className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              {userSearch.trim().length >= 2 && userResults.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">לא נמצאו משתמשים</p>
              )}
            </div>
          )}

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

      {/* ── Stores (admin only) ── */}
      {isAdmin(profile!.role) && (
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

      {/* ── Superadmin: System Management ── */}
      {profile?.is_superadmin && (
        <Section icon={<Crown className="w-5 h-5 text-amber-500" />} title="ניהול מערכת">
          <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mb-4">
            🔑 סופר-אדמין — ניהול כל המשפחות
          </p>

          {/* All families */}
          <p className="text-sm font-semibold text-gray-600 mb-2">
            משפחות ({allFamilies.length})
          </p>
          <div className="space-y-1.5 mb-4">
            {allFamilies.map(f => (
              <div key={f.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                <button
                  onClick={() => setViewingFamily(f.id, f.name)}
                  className="flex-1 flex items-center gap-3 text-right"
                >
                  <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium text-gray-700">{f.name}</span>
                  <span className="text-xs text-gray-400">{f.member_count} חברים</span>
                </button>
                <button
                  onClick={() => createFamilyInviteLink(f.id, f.name)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-primary-500
                             hover:bg-primary-50 transition-colors flex-shrink-0"
                  title="צור לינק הזמנה"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Create new family */}
          <p className="text-sm font-semibold text-gray-600 mb-2">צור משפחה חדשה</p>
          <div className="space-y-2">
            <input
              value={newFamilyName}
              onChange={e => setNewFamilyName(e.target.value)}
              placeholder="שם המשפחה..."
              className="input text-sm"
            />
            <input
              type="email"
              value={newFamilyEmail}
              onChange={e => setNewFamilyEmail(e.target.value)}
              placeholder="אימייל מנהל המשפחה..."
              className="input text-sm"
              dir="ltr"
            />
            <button
              onClick={createNewFamily}
              disabled={!newFamilyName.trim() || creatingFamily}
              className="btn-primary w-full text-sm"
            >
              {creatingFamily ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {newFamilyEmail.trim() ? 'צור משפחה + שלח הזמנה למנהל' : 'צור משפחה'}
            </button>
          </div>
        </Section>
      )}

      {/* ── Create new family (leave current) ── */}
      {profile?.family_id && (
        <button
          onClick={leaveAndCreateFamily}
          className="w-full flex items-center justify-center gap-2 py-3.5 text-gray-500
                     font-semibold hover:bg-gray-50 active:bg-gray-100 rounded-2xl transition-colors
                     border-2 border-dashed border-gray-200"
        >
          <Plus className="w-5 h-5" />
          הקם משפחה חדשה
        </button>
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
