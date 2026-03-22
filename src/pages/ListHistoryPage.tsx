import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, ClipboardList, Crown, Package, Loader2,
  CheckCircle2, X, Download, CheckSquare, Square,
} from 'lucide-react'
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

interface DetailItem {
  id: string
  name: string
  quantity: number
  unit: string
  note: string | null
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

// ── ListDetailModal ───────────────────────────────────────────────────────────

function ListDetailModal({
  list,
  onClose,
  onImport,
}: {
  list: ListRow
  onClose: () => void
  onImport: (items: DetailItem[]) => Promise<void>
}) {
  const [items, setItems]         = useState<DetailItem[]>([])
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [loading, setLoading]     = useState(true)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    loadItems()
  }, [list.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase
      .from('list_items')
      .select('id, name, quantity, unit, note')
      .eq('list_id', list.id)
      .order('sort_order', { ascending: true })
    const rows = (data as DetailItem[]) ?? []
    setItems(rows)
    setSelected(new Set(rows.map(i => i.id)))
    setLoading(false)
  }

  function toggleItem(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map(i => i.id)))
    }
  }

  async function handleImport() {
    const toImport = items.filter(i => selected.has(i.id))
    if (toImport.length === 0) return
    setImporting(true)
    await onImport(toImport)
    setImporting(false)
  }

  const allSelected = items.length > 0 && selected.size === items.length

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-l from-primary-600 to-primary-700 text-white px-4 py-3.5 flex-shrink-0">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold leading-tight truncate">{list.name}</h2>
            <p className="text-primary-100 text-xs truncate">
              {formatDateShort(list.created_at)}
              {list.creator && ` · ${list.creator.full_name}`}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <ClipboardList className="w-12 h-12 mb-3 text-gray-200" />
          <p className="text-sm">אין פריטים ברשימה זו</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-4 space-y-2 pb-32">
            {/* Select all */}
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm font-semibold text-primary-600 px-1 mb-1"
            >
              {allSelected
                ? <CheckSquare className="w-4 h-4" />
                : <Square className="w-4 h-4" />
              }
              {allSelected ? 'בטל הכל' : 'בחר הכל'}
              <span className="text-gray-400 font-normal">({selected.size}/{items.length})</span>
            </button>

            {items.map(item => {
              const isSel = selected.has(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5
                             shadow-sm border transition-all duration-150 text-right
                             ${isSel ? 'border-primary-200 bg-primary-50/30' : 'border-gray-100'}`}
                >
                  {/* Checkbox */}
                  <div className={`w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    isSel
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'border-gray-300'
                  }`}>
                    {isSel && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                    {item.note && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">📝 {item.note}</p>
                    )}
                  </div>

                  {/* Qty */}
                  {item.quantity !== 1 && (
                    <span className="text-xs font-bold text-gray-400 flex-shrink-0">
                      ×{item.quantity}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom import bar */}
      {!loading && items.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-gray-100 shadow-lg px-4 py-4 z-10">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="btn-primary w-full"
            >
              {importing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {importing
                ? 'מוסיף...'
                : selected.size > 0
                  ? `הוסף ${selected.size} פריטים לרשימה הנוכחית`
                  : 'בחר פריטים להוספה'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
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

  // Detail modal
  const [detailList, setDetailList] = useState<ListRow | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.family_id) return
    loadAll()
  }, [profile?.family_id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)

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

    // Top item adder
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

  // ── Import items to current active list ──
  async function handleImport(items: DetailItem[]) {
    if (!profile?.family_id) return

    // Find or create active list
    let { data: activeList } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('family_id', profile.family_id)
      .in('status', ['active', 'shopping'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!activeList) {
      const { data: newList } = await supabase
        .from('shopping_lists')
        .insert({ family_id: profile.family_id, name: 'רשימת קניות', created_by: profile.id })
        .select('id')
        .single()
      activeList = newList
    }

    if (!activeList) return

    // Load existing items to check duplicates
    const { data: existingItems } = await supabase
      .from('list_items')
      .select('name')
      .eq('list_id', activeList.id)

    const existingNames = new Set(
      (existingItems ?? []).map(i => (i.name as string).trim().toLowerCase())
    )

    // Filter out duplicates
    const toInsert = items.filter(i => !existingNames.has(i.name.trim().toLowerCase()))

    if (toInsert.length === 0) {
      setDetailList(null)
      setSuccessMsg('כל הפריטים כבר קיימים ברשימה הנוכחית')
      setTimeout(() => setSuccessMsg(null), 3000)
      return
    }

    // Get max sort_order
    const { data: maxData } = await supabase
      .from('list_items')
      .select('sort_order')
      .eq('list_id', activeList.id)
      .order('sort_order', { ascending: false })
      .limit(1)
    const maxOrder = maxData?.[0]?.sort_order ?? 0

    // Insert items
    await supabase.from('list_items').insert(
      toInsert.map((item, idx) => ({
        list_id:    activeList!.id,
        name:       item.name,
        quantity:   item.quantity,
        unit:       item.unit,
        note:       item.note,
        added_by:   profile.id,
        sort_order: maxOrder + idx + 1,
      })),
    )

    const skipped = items.length - toInsert.length
    const msg = skipped > 0
      ? `נוספו ${toInsert.length} פריטים (${skipped} כפולים דולגו)`
      : `נוספו ${toInsert.length} פריטים לרשימה`

    setDetailList(null)
    setSuccessMsg(msg)
    setTimeout(() => {
      setSuccessMsg(null)
      navigate('/')
    }, 1500)
  }

  // ── Computed stats ──
  const totalLists = lists.length
  const totalItems = lists.reduce((s, l) => s + (l.list_items?.[0]?.count ?? 0), 0)
  const avgItems = totalLists > 0 ? Math.round(totalItems / totalLists) : 0

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
    <>
      {/* Detail modal */}
      {detailList && (
        <ListDetailModal
          list={detailList}
          onClose={() => setDetailList(null)}
          onImport={handleImport}
        />
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="fixed top-20 inset-x-4 z-50 flex justify-center">
          <div className="bg-primary-600 text-white px-5 py-3 rounded-2xl shadow-xl
                          text-sm font-semibold flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </div>
        </div>
      )}

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
                <button
                  key={list.id}
                  onClick={() => setDetailList(list)}
                  className="card flex items-center gap-3 w-full text-right
                             hover:border-primary-200 active:scale-[0.99] transition-all"
                >
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
                      {formatDateShort(list.created_at)}
                      {creatorName && ` · ${creatorName}`}
                    </p>
                  </div>

                  {/* Item count */}
                  <div className="text-center flex-shrink-0">
                    <p className="text-lg font-extrabold text-primary-600 leading-none">{count}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">פריטים</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
