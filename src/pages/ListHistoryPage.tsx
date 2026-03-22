import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardList, Crown, Package, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ListRowRaw {
  id: string
  name: string
  status: string
  created_at: string
  created_by: string | null
  creator: { id: string; full_name: string }[] | null
  list_items: { count: number }[]
}

interface ListRow {
  id: string
  name: string
  status: string
  created_at: string
  created_by: string | null
  creator: { id: string; full_name: string } | null
  list_items: { count: number }[]
}

interface ItemAdderRaw {
  added_by: string
  user: { full_name: string }[] | null
}

// ── Color helper ──────────────────────────────────────────────────────────────

const USER_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-orange-100 text-orange-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-indigo-100 text-indigo-700',
  'bg-rose-100 text-rose-700',
]
function userColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

// ── ListHistoryPage ───────────────────────────────────────────────────────────

export default function ListHistoryPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [lists, setLists]     = useState<ListRow[]>([])
  const [loading, setLoading] = useState(true)

  // Stats
  const [topCreator, setTopCreator] = useState<{ name: string; count: number } | null>(null)
  const [topAdder, setTopAdder]     = useState<{ name: string; count: number } | null>(null)

  useEffect(() => {
    if (!profile?.family_id) return
    loadAll()
  }, [profile?.family_id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)

    // Load all lists with item count and creator name
    const { data: listData } = await supabase
      .from('shopping_lists')
      .select('id, name, status, created_at, created_by, creator:users!created_by(id, full_name), list_items(count)')
      .eq('family_id', profile!.family_id)
      .order('created_at', { ascending: false })

    const rawRows = (listData as unknown as ListRowRaw[]) ?? []
    const rows: ListRow[] = rawRows.map(r => ({
      ...r,
      creator: Array.isArray(r.creator) ? r.creator[0] ?? null : r.creator,
    }))
    setLists(rows)

    // Top list creator
    const creatorCounts: Record<string, { name: string; count: number }> = {}
    for (const l of rows) {
      if (l.creator) {
        const key = l.creator.id
        if (!creatorCounts[key]) creatorCounts[key] = { name: l.creator.full_name, count: 0 }
        creatorCounts[key].count++
      }
    }
    const topC = Object.values(creatorCounts).sort((a, b) => b.count - a.count)[0]
    setTopCreator(topC ?? null)

    // Top item adder — query list_items for this family's lists
    const listIds = rows.map(l => l.id)
    if (listIds.length > 0) {
      const { data: adderData } = await supabase
        .from('list_items')
        .select('added_by, user:users!added_by(full_name)')
        .in('list_id', listIds)
        .not('added_by', 'is', null)

      const rawAdders = (adderData as unknown as ItemAdderRaw[]) ?? []
      const adderCounts: Record<string, { name: string; count: number }> = {}
      for (const a of rawAdders) {
        const user = Array.isArray(a.user) ? a.user[0] : a.user
        if (a.added_by && user) {
          if (!adderCounts[a.added_by]) adderCounts[a.added_by] = { name: user.full_name, count: 0 }
          adderCounts[a.added_by].count++
        }
      }
      const topA = Object.values(adderCounts).sort((a, b) => b.count - a.count)[0]
      setTopAdder(topA ?? null)
    }

    setLoading(false)
  }

  // ── Computed stats ──
  const totalLists = lists.length
  const totalItems = lists.reduce((s, l) => s + (l.list_items?.[0]?.count ?? 0), 0)
  const avgItems = totalLists > 0 ? Math.round(totalItems / totalLists) : 0

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('he-IL', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  function statusLabel(status: string) {
    switch (status) {
      case 'active':    return { text: 'פעילה',  cls: 'bg-green-100 text-green-700' }
      case 'shopping':  return { text: 'בקנייה', cls: 'bg-blue-100 text-blue-700' }
      case 'completed': return { text: 'הושלמה', cls: 'bg-gray-100 text-gray-500' }
      case 'archived':  return { text: 'בארכיון', cls: 'bg-gray-100 text-gray-400' }
      default:          return { text: status,    cls: 'bg-gray-100 text-gray-500' }
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4 pb-32">

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium"
      >
        <ArrowRight className="w-4 h-4" />
        חזרה לרשימה
      </button>

      {/* ── Stats ── */}
      <div className="card-green">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-5 h-5 text-primary-600" />
          <h2 className="font-extrabold text-primary-800 text-lg">היסטוריית רשימות</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/70 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-primary-600">{totalLists}</p>
            <p className="text-xs text-primary-500 mt-0.5">רשימות</p>
          </div>
          <div className="bg-white/70 rounded-xl p-3 text-center">
            <p className="text-2xl font-extrabold text-primary-600">{avgItems}</p>
            <p className="text-xs text-primary-500 mt-0.5">ממוצע פריטים</p>
          </div>
        </div>

        {(topCreator || topAdder) && (
          <div className="mt-3 space-y-2">
            {topCreator && (
              <div className="flex items-center gap-2 bg-white/70 rounded-xl px-3 py-2.5">
                <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">הכין הכי הרבה רשימות</p>
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {topCreator.name} · {topCreator.count} רשימות
                  </p>
                </div>
              </div>
            )}
            {topAdder && (
              <div className="flex items-center gap-2 bg-white/70 rounded-xl px-3 py-2.5">
                <Package className="w-4 h-4 text-primary-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">הוסיף הכי הרבה פריטים</p>
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {topAdder.name} · {topAdder.count} פריטים
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── List cards ── */}
      {lists.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">אין רשימות עדיין</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map(list => {
            const count = list.list_items?.[0]?.count ?? 0
            const st = statusLabel(list.status)
            const creatorName = list.creator?.full_name?.split(' ')[0] ?? null
            const initial = list.creator?.full_name?.charAt(0) ?? ''
            const color = list.created_by ? userColor(list.created_by) : 'bg-gray-100 text-gray-400'

            return (
              <div key={list.id} className="card flex items-center gap-3">
                {/* Creator initial */}
                {initial && (
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center
                                   text-sm font-extrabold flex-shrink-0 ${color}`}>
                    {initial}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800 truncate">{list.name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>
                      {st.text}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(list.created_at)}
                    {creatorName && ` · ${creatorName}`}
                  </p>
                </div>

                {/* Item count */}
                <div className="text-center flex-shrink-0">
                  <p className="text-lg font-extrabold text-primary-600 leading-none">{count}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">פריטים</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
