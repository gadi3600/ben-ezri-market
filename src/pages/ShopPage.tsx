import { useState, useEffect } from 'react'
import {
  ShoppingCart, CheckCircle2, Trophy,
  ChevronDown, ChevronUp, ArrowLeft, Undo2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { ShoppingList, ListItem } from '../lib/types'

// ── helpers ──────────────────────────────────────────────────────────────────

function optimistic(items: ListItem[], id: string, patch: Partial<ListItem>) {
  return items.map(i => (i.id === id ? { ...i, ...patch } : i))
}

// ── ActiveItem — כרטיסייה עם שני כפתורים ───────────────────────────────────

function ActiveItem({
  item,
  onCheck,
  onDefer,
}: {
  item: ListItem
  onCheck: (item: ListItem) => void
  onDefer: (item: ListItem) => void
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5
                    shadow-sm border border-gray-100">
      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-gray-800 truncate">{item.name}</p>
        {(item.quantity !== 1 || item.unit !== 'יחידה') && (
          <p className="text-xs text-gray-400 mt-0.5">{item.quantity} {item.unit}</p>
        )}
      </div>

      {/* → להמשך */}
      <button
        onClick={() => onDefer(item)}
        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gray-100
                   hover:bg-gray-200 active:bg-gray-300 transition-colors
                   text-gray-500 text-xs font-semibold flex-shrink-0"
        title="העבר להמשך קנייה"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">להמשך</span>
      </button>

      {/* ✓ הכנסתי לעגלה */}
      <button
        onClick={() => onCheck(item)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl
                   bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                   transition-colors text-white text-xs font-bold flex-shrink-0"
        title="הכנסתי לעגלה"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span className="hidden sm:inline">לעגלה</span>
      </button>
    </div>
  )
}

// ── DeferredItem — פריט ב"להמשך" עם כפתור ביטול ────────────────────────────

function DeferredItem({
  item,
  onUndo,
}: {
  item: ListItem
  onUndo: (item: ListItem) => void
}) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3
                    border border-gray-200">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-600 truncate">{item.name}</p>
        {(item.quantity !== 1 || item.unit !== 'יחידה') && (
          <p className="text-xs text-gray-400">{item.quantity} {item.unit}</p>
        )}
      </div>
      <button
        onClick={() => onUndo(item)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600
                   hover:bg-primary-50 transition-colors"
        title="החזר לרשימה הנוכחית"
      >
        <Undo2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── ShopPage ─────────────────────────────────────────────────────────────────

export default function ShopPage() {
  const { profile } = useAuth()
  const [list, setList]               = useState<ShoppingList | null>(null)
  const [items, setItems]             = useState<ListItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [completing, setCompleting]   = useState(false)
  const [showChecked, setShowChecked] = useState(false)
  const [showDeferred, setShowDeferred] = useState(true)
  const [doneState, setDoneState]     = useState<'idle' | 'complete' | 'continue'>('idle')

  // ── load ──
  useEffect(() => {
    if (!profile?.family_id) return
    loadList()
  }, [profile?.family_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── realtime ──
  useEffect(() => {
    if (!list?.id) return
    const channel = supabase
      .channel(`shop-${list.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'list_items', filter: `list_id=eq.${list.id}` },
        (payload) => setItems(prev =>
          prev.map(i => (i.id === payload.new.id ? (payload.new as ListItem) : i)),
        ),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [list?.id])

  async function loadList() {
    setLoading(true)
    const { data } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('family_id', profile!.family_id)
      .in('status', ['active', 'shopping'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      setList(data)
      const { data: itemData } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', data.id)
        .order('sort_order', { ascending: true })
      setItems(itemData ?? [])
    }
    setLoading(false)
  }

  // ── actions ──

  async function checkItem(item: ListItem) {
    const now = new Date().toISOString()
    setItems(prev => optimistic(prev, item.id, {
      is_checked: true, is_deferred: false,
      checked_by: profile!.id, checked_at: now,
    }))
    await supabase.from('list_items').update({
      is_checked: true, is_deferred: false,
      checked_by: profile!.id, checked_at: now,
    }).eq('id', item.id)
  }

  async function deferItem(item: ListItem) {
    setItems(prev => optimistic(prev, item.id, {
      is_deferred: true, is_checked: false,
      checked_by: null, checked_at: null,
    }))
    await supabase.from('list_items').update({
      is_deferred: true, is_checked: false,
      checked_by: null, checked_at: null,
    }).eq('id', item.id)
    setShowDeferred(true)
  }

  async function undoDeferItem(item: ListItem) {
    setItems(prev => optimistic(prev, item.id, { is_deferred: false }))
    await supabase.from('list_items').update({ is_deferred: false }).eq('id', item.id)
  }

  async function uncheckItem(item: ListItem) {
    setItems(prev => optimistic(prev, item.id, {
      is_checked: false, checked_by: null, checked_at: null,
    }))
    await supabase.from('list_items').update({
      is_checked: false, checked_by: null, checked_at: null,
    }).eq('id', item.id)
  }

  async function completeShop() {
    if (!list || !profile) return
    setCompleting(true)

    const deferred = items.filter(i => i.is_deferred)

    // 1. סמן רשימה נוכחית כהושלמה
    await supabase.from('shopping_lists').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', list.id)

    // 2. אם יש פריטי "להמשך" — צור רשימה חדשה
    if (deferred.length > 0) {
      const { data: newList } = await supabase
        .from('shopping_lists')
        .insert({
          family_id: profile.family_id,
          name: 'המשך קנייה',
          created_by: profile.id,
        })
        .select()
        .single()

      if (newList) {
        await supabase.from('list_items').insert(
          deferred.map((item, idx) => ({
            list_id:    newList.id,
            name:       item.name,
            quantity:   item.quantity,
            unit:       item.unit,
            note:       item.note,
            product_id: item.product_id,
            added_by:   profile.id,
            sort_order: idx + 1,
          })),
        )
      }
      setDoneState('continue')
    } else {
      setDoneState('complete')
    }

    setCompleting(false)
  }

  // ── derived ──
  const active   = items.filter(i => !i.is_checked && !i.is_deferred)
  const checked  = items.filter(i =>  i.is_checked)
  const deferred = items.filter(i =>  i.is_deferred)
  const allNonDeferredDone = items.length > 0 && active.length === 0 && (checked.length > 0 || deferred.length > 0)
  const pct = (checked.length + deferred.length) > 0
    ? Math.round((checked.length / (checked.length + active.length + deferred.length)) * 100)
    : 0

  // ── screens ──

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (doneState === 'complete') return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="text-7xl mb-5">🎉</div>
      <h2 className="text-2xl font-extrabold text-primary-700 mb-2">הקנייה הושלמה!</h2>
      <p className="text-gray-400 text-sm">כל הפריטים נכנסו לעגלה בהצלחה</p>
    </div>
  )

  if (doneState === 'continue') return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="text-7xl mb-5">✅</div>
      <h2 className="text-2xl font-extrabold text-primary-700 mb-2">הקנייה הושלמה!</h2>
      <p className="text-gray-500 text-sm mb-2">
        פריטי "להמשך" הועברו לרשימת קנייה חדשה
      </p>
      <div className="card-green mt-4 w-full max-w-xs">
        <p className="text-sm text-primary-700 font-semibold">
          📋 "המשך קנייה" מחכה לך בלשונית רשימה
        </p>
        <p className="text-xs text-primary-500 mt-1">
          {deferred.length} פריטים לקנייה במקום אחר
        </p>
      </div>
    </div>
  )

  if (!list || items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-primary-50 rounded-full p-6 mb-5">
        <ShoppingCart className="w-14 h-14 text-primary-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">אין רשימה פעילה</h3>
      <p className="text-gray-400 text-sm">הוסף פריטים ברשימה תחילה</p>
    </div>
  )

  return (
    <div className="pb-6 space-y-3">

      {/* ── Progress bar ── */}
      <div className={`rounded-2xl p-4 transition-colors ${allNonDeferredDone && deferred.length === 0 ? 'bg-primary-600' : 'card-green'}`}>
        <div className="flex justify-between items-center mb-2.5">
          <div>
            <p className={`text-xs font-medium ${allNonDeferredDone && deferred.length === 0 ? 'text-primary-100' : 'text-primary-500'}`}>
              מצב קנייה
            </p>
            <p className={`font-extrabold text-xl leading-tight ${allNonDeferredDone && deferred.length === 0 ? 'text-white' : 'text-primary-800'}`}>
              {checked.length} בעגלה
              {deferred.length > 0 && (
                <span className="text-sm font-medium opacity-70 mr-2">
                  · {deferred.length} להמשך
                </span>
              )}
            </p>
          </div>
          <span className={`text-3xl font-extrabold ${allNonDeferredDone && deferred.length === 0 ? 'text-white' : 'text-primary-600'}`}>
            {pct}%
          </span>
        </div>
        <div className={`h-2.5 rounded-full overflow-hidden ${allNonDeferredDone && deferred.length === 0 ? 'bg-primary-500' : 'bg-primary-100'}`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${allNonDeferredDone && deferred.length === 0 ? 'bg-white' : 'bg-primary-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Active items ── */}
      {active.length > 0 ? (
        <div className="space-y-2">
          {active.map(item => (
            <ActiveItem
              key={item.id}
              item={item}
              onCheck={checkItem}
              onDefer={deferItem}
            />
          ))}
        </div>
      ) : (
        checked.length > 0 && (
          <div className="text-center py-4 text-primary-600 font-semibold text-sm">
            🛒 כל הפריטים הנוכחיים בעגלה!
          </div>
        )
      )}

      {/* ── Checked — collapsible ── */}
      {checked.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-primary-100">
          <button
            onClick={() => setShowChecked(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3
                       bg-primary-50 hover:bg-primary-100 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-primary-700">
              <CheckCircle2 className="w-4 h-4" />
              בעגלה ({checked.length})
            </span>
            {showChecked
              ? <ChevronUp className="w-4 h-4 text-primary-400" />
              : <ChevronDown className="w-4 h-4 text-primary-400" />}
          </button>

          {showChecked && (
            <div className="divide-y divide-gray-50 bg-white">
              {checked.map(item => (
                <button
                  key={item.id}
                  onClick={() => uncheckItem(item)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-right
                             hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  title="לחץ לביטול"
                >
                  <CheckCircle2 className="w-5 h-5 text-primary-400 flex-shrink-0" />
                  <span className="flex-1 text-sm text-gray-400 line-through truncate">
                    {item.name}
                  </span>
                  <Undo2 className="w-3.5 h-3.5 text-gray-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Complete button ── */}
      {allNonDeferredDone && (
        <button
          onClick={completeShop}
          disabled={completing}
          className="btn-primary w-full text-base py-4 shadow-lg shadow-primary-200"
        >
          <Trophy className="w-5 h-5" />
          {completing
            ? 'שומר...'
            : deferred.length > 0
              ? `סיום קנייה + העברת ${deferred.length} פריטים להמשך 🎉`
              : 'סיום קנייה 🎉'}
        </button>
      )}

      {/* ══ להמשך — sticky bottom section ══ */}
      <div className="rounded-2xl overflow-hidden border-2 border-dashed border-gray-200">
        <button
          onClick={() => setShowDeferred(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3
                     bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
            להמשך קנייה
            {deferred.length > 0 && (
              <span className="bg-gray-200 text-gray-600 text-xs font-bold
                               rounded-full px-2 py-0.5 leading-none">
                {deferred.length}
              </span>
            )}
          </span>
          {showDeferred
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showDeferred && (
          <div className="bg-white px-3 py-3 space-y-2">
            {deferred.length === 0 ? (
              <p className="text-center text-gray-400 text-xs py-3">
                פריטים שתלחץ "להמשך" יופיעו כאן
              </p>
            ) : (
              <>
                {deferred.map(item => (
                  <DeferredItem
                    key={item.id}
                    item={item}
                    onUndo={undoDeferItem}
                  />
                ))}
                <p className="text-xs text-gray-400 text-center pt-1">
                  בסיום הקנייה יועברו לרשימה חדשה אוטומטית
                </p>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
