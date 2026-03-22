import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, ShoppingBag, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { ShoppingList, ListItem } from '../lib/types'

// ── Item row ────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ListItem
  onToggle: (item: ListItem) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm border transition-all duration-200 ${
        item.is_checked ? 'border-primary-100 bg-primary-50/40' : 'border-gray-100'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item)}
        className={`w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200 ${
          item.is_checked
            ? 'bg-primary-500 border-primary-500 text-white scale-105'
            : 'border-gray-300 hover:border-primary-400'
        }`}
      >
        {item.is_checked && <span className="text-[11px] font-extrabold">✓</span>}
      </button>

      {/* Name + qty */}
      <div className="flex-1 min-w-0">
        <span
          className={`text-base font-medium leading-tight block truncate ${
            item.is_checked ? 'line-through text-gray-400' : 'text-gray-800'
          }`}
        >
          {item.name}
        </span>
        {(item.quantity !== 1 || item.unit !== 'יחידה') && (
          <span className="text-xs text-gray-400">
            {item.quantity} {item.unit}
          </span>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(item.id)}
        className="p-1.5 text-gray-200 hover:text-red-400 active:text-red-500 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── ListPage ────────────────────────────────────────────────────────────────

export default function ListPage() {
  const { profile } = useAuth()
  const [list, setList]           = useState<ShoppingList | null>(null)
  const [items, setItems]         = useState<ListItem[]>([])
  const [newName, setNewName]     = useState('')
  const [newQty, setNewQty]       = useState('1')
  const [loading, setLoading]     = useState(true)
  const [adding, setAdding]       = useState(false)
  const [creatingList, setCreatingList] = useState(false)
  const [allSuggestions, setAllSuggestions] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Derive filtered suggestions from what user typed (max 5, case-insensitive)
  const suggestions = newName.trim().length > 0
    ? allSuggestions
        .filter(s => s.toLowerCase().includes(newName.toLowerCase()))
        .slice(0, 5)
    : []

  useEffect(() => {
    if (!profile?.family_id) return
    loadList()
    loadSuggestions()
  }, [profile?.family_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
  useEffect(() => {
    if (!list?.id) return
    const channel = supabase
      .channel(`list-items-${list.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'list_items', filter: `list_id=eq.${list.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems(prev => [...prev, payload.new as ListItem])
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(i => (i.id === payload.new.id ? (payload.new as ListItem) : i)))
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== payload.old.id))
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [list?.id])

  async function loadSuggestions() {
    const { data } = await supabase.from('purchase_items').select('name')
    if (data) {
      const unique = [...new Set(data.map(r => r.name as string).filter(Boolean))]
      setAllSuggestions(unique)
    }
  }

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
    } else {
      setList(null)
      setItems([])
    }
    setLoading(false)
  }

  async function createList() {
    if (!profile?.family_id) return
    setCreatingList(true)
    const { data } = await supabase
      .from('shopping_lists')
      .insert({ family_id: profile.family_id, name: 'רשימת קניות', created_by: profile.id })
      .select()
      .single()
    if (data) { setList(data); setItems([]) }
    setCreatingList(false)
    setTimeout(() => inputRef.current?.focus(), 200)
  }

  async function addItem() {
    if (!newName.trim() || !list || adding) return
    setAdding(true)
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) : 0
    await supabase.from('list_items').insert({
      list_id:   list.id,
      name:      newName.trim(),
      quantity:  parseFloat(newQty) || 1,
      unit:      'יחידה',
      added_by:  profile!.id,
      sort_order: maxOrder + 1,
    })
    setNewName('')
    setNewQty('1')
    setAdding(false)
    inputRef.current?.focus()
  }

  async function toggleItem(item: ListItem) {
    const now = new Date().toISOString()
    const checked = !item.is_checked
    // Optimistic
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: checked } : i))
    await supabase.from('list_items').update({
      is_checked: checked,
      checked_by: checked ? profile!.id : null,
      checked_at: checked ? now : null,
    }).eq('id', item.id)
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('list_items').delete().eq('id', id)
  }

  const unchecked = items.filter(i => !i.is_checked)
  const checked   = items.filter(i =>  i.is_checked)
  const pct       = items.length > 0 ? Math.round((checked.length / items.length) * 100) : 0

  // ── Loading ──
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── No list ──
  if (!list) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-primary-50 rounded-full p-6 mb-5">
        <ShoppingBag className="w-14 h-14 text-primary-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">אין רשימה פעילה</h3>
      <p className="text-gray-400 text-sm mb-8">התחל רשימת קניות חדשה עבור המשפחה</p>
      <button onClick={createList} disabled={creatingList} className="btn-primary mx-auto">
        <Plus className="w-5 h-5" />
        {creatingList ? 'יוצר...' : 'רשימה חדשה'}
      </button>
    </div>
  )

  // ── List ──
  return (
    <div className="pb-36">

      {/* Header card */}
      <div className="card-green mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-primary-800 text-lg leading-tight">{list.name}</h2>
          <p className="text-sm text-primary-600 mt-0.5">
            {unchecked.length > 0
              ? `${unchecked.length} נותרו • ${checked.length} בעגלה`
              : checked.length > 0 ? '✅ הכל בעגלה!' : 'הרשימה ריקה'}
          </p>
        </div>
        {items.length > 0 && (
          <div className="text-center">
            <div className="text-3xl font-extrabold text-primary-600 leading-none">{pct}%</div>
            <div className="text-xs text-primary-400 mt-0.5">הושלם</div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="h-2 bg-primary-100 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-sm">הרשימה ריקה — הוסף פריט למטה</p>
        </div>
      )}

      {/* Unchecked items */}
      {unchecked.length > 0 && (
        <div className="space-y-2 mb-4">
          {unchecked.map(item => (
            <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
          ))}
        </div>
      )}

      {/* Checked items */}
      {checked.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2 px-1">
            <CheckCircle2 className="w-4 h-4 text-primary-400" />
            <span className="text-xs font-semibold text-primary-500">כבר בעגלה ({checked.length})</span>
          </div>
          <div className="space-y-2 opacity-55">
            {checked.map(item => (
              <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
            ))}
          </div>
        </>
      )}

      {/* ── Autocomplete suggestions (above input bar) ── */}
      {suggestions.length > 0 && (
        <div className="fixed bottom-[136px] inset-x-0 px-4 z-50">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  setNewName(s)
                  inputRef.current?.focus()
                }}
                className="w-full text-right px-4 py-3 text-sm text-gray-700 font-medium
                           hover:bg-primary-50 active:bg-primary-100 transition-colors
                           border-b border-gray-50 last:border-0"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Add-item bar (sticky above bottom nav) ── */}
      <div className="fixed bottom-[64px] inset-x-0 bg-white/95 backdrop-blur border-t border-gray-100 shadow-lg px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          {/* Qty */}
          <input
            type="number"
            value={newQty}
            onChange={e => setNewQty(e.target.value)}
            className="input w-16 text-center px-1 text-sm"
            min="0.5"
            step="0.5"
          />
          {/* Name */}
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            className="input flex-1"
            placeholder="הוסף מוצר..."
            autoComplete="off"
          />
          {/* Add button */}
          <button
            onClick={addItem}
            disabled={!newName.trim() || adding}
            className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 disabled:opacity-40
                       text-white rounded-xl w-12 h-12 flex items-center justify-center flex-shrink-0
                       transition-colors shadow-sm"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  )
}
