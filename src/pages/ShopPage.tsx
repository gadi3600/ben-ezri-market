import { useState, useEffect } from 'react'
import { ShoppingCart, Circle, CheckCircle2, Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { ShoppingList, ListItem } from '../lib/types'

export default function ShopPage() {
  const { profile } = useAuth()
  const [list, setList]         = useState<ShoppingList | null>(null)
  const [items, setItems]       = useState<ListItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [completing, setCompleting] = useState(false)
  const [showChecked, setShowChecked] = useState(false)
  const [done, setDone]         = useState(false)

  useEffect(() => {
    if (!profile?.family_id) return
    loadList()
  }, [profile?.family_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime — reflect other family members checking items
  useEffect(() => {
    if (!list?.id) return
    const channel = supabase
      .channel(`shop-${list.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'list_items', filter: `list_id=eq.${list.id}` },
        (payload) => {
          setItems(prev => prev.map(i => (i.id === payload.new.id ? (payload.new as ListItem) : i)))
        },
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

  async function toggleItem(item: ListItem) {
    const checked = !item.is_checked
    const now = new Date().toISOString()
    // Optimistic
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: checked } : i))
    await supabase.from('list_items').update({
      is_checked: checked,
      checked_by: checked ? profile!.id : null,
      checked_at: checked ? now : null,
    }).eq('id', item.id)
  }

  async function completeShop() {
    if (!list) return
    setCompleting(true)
    await supabase.from('shopping_lists').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', list.id)
    setDone(true)
    setCompleting(false)
  }

  const unchecked = items.filter(i => !i.is_checked)
  const checked   = items.filter(i =>  i.is_checked)
  const pct       = items.length > 0 ? Math.round((checked.length / items.length) * 100) : 0
  const allDone   = items.length > 0 && unchecked.length === 0

  // ── Loading ──
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Shopping complete ──
  if (done) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-5">🎉</div>
      <h2 className="text-2xl font-extrabold text-primary-700 mb-2">הקנייה הושלמה!</h2>
      <p className="text-gray-400 text-sm">כל הפריטים נקנו בהצלחה</p>
    </div>
  )

  // ── No list ──
  if (!list || items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-primary-50 rounded-full p-6 mb-5">
        <ShoppingCart className="w-14 h-14 text-primary-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">אין רשימה פעילה</h3>
      <p className="text-gray-400 text-sm">הוסף פריטים לרשימה תחילה בלשונית "רשימה"</p>
    </div>
  )

  return (
    <div className="pb-6">

      {/* Progress header */}
      <div className={`rounded-2xl p-4 mb-4 transition-colors ${allDone ? 'bg-primary-600 text-white' : 'card-green'}`}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className={`text-sm font-medium ${allDone ? 'text-primary-100' : 'text-primary-600'}`}>
              {allDone ? '🎉 הכל בעגלה! אפשר לסיים' : 'מצב קנייה'}
            </p>
            <p className={`font-extrabold text-xl ${allDone ? 'text-white' : 'text-primary-800'}`}>
              {checked.length} / {items.length} פריטים
            </p>
          </div>
          <div className={`text-4xl font-extrabold ${allDone ? 'text-white' : 'text-primary-600'}`}>
            {pct}%
          </div>
        </div>
        {/* Progress bar */}
        <div className={`h-3 rounded-full overflow-hidden ${allDone ? 'bg-primary-500' : 'bg-primary-100'}`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-white' : 'bg-primary-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Unchecked items — big tap targets */}
      {unchecked.length > 0 && (
        <div className="space-y-2 mb-4">
          {unchecked.map(item => (
            <button
              key={item.id}
              onClick={() => toggleItem(item)}
              className="w-full flex items-center gap-4 bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100
                         text-right active:scale-[0.98] transition-transform"
            >
              <Circle className="w-8 h-8 text-gray-300 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-lg font-semibold text-gray-800 block truncate">{item.name}</span>
                {(item.quantity !== 1 || item.unit !== 'יחידה') && (
                  <span className="text-sm text-gray-400">{item.quantity} {item.unit}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Checked items — collapsible */}
      {checked.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowChecked(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              בעגלה ({checked.length})
            </span>
            {showChecked ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showChecked && (
            <div className="space-y-2 mt-2 opacity-55">
              {checked.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item)}
                  className="w-full flex items-center gap-4 bg-primary-50 rounded-2xl px-4 py-3.5
                             border border-primary-100 text-right active:scale-[0.98] transition-transform"
                >
                  <CheckCircle2 className="w-8 h-8 text-primary-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-base font-medium text-gray-400 line-through block truncate">
                      {item.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Complete shopping button */}
      {allDone && (
        <div className="mt-4 px-1">
          <button
            onClick={completeShop}
            disabled={completing}
            className="btn-primary w-full text-lg py-4 bg-primary-600 shadow-lg shadow-primary-200"
          >
            <Trophy className="w-6 h-6" />
            {completing ? 'שומר קנייה...' : 'סיום קנייה 🎉'}
          </button>
        </div>
      )}
    </div>
  )
}
