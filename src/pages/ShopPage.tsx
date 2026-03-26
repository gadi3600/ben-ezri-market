import { useState, useEffect, useRef, useMemo, memo } from 'react'
import {
  ShoppingCart, CheckCircle2, Trophy,
  ChevronDown, ChevronUp, ArrowLeft, Undo2,
  Plus, X, MapPin, MoveUp, MoveDown,
  Search, ChevronLeft, ChevronsUpDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { ShoppingList, ListItem, Store } from '../lib/types'
import { canEdit } from '../lib/permissions'
import { classifyItem, buildAllCategories } from '../lib/categories'
import type { Category, CustomCategoryRow } from '../lib/categories'
import ReceiptModal from '../components/ReceiptModal'
import ImageLightbox from '../components/ImageLightbox'

// Extended item with joined user info
interface ListItemWithUser extends ListItem {
  added_by_user: { id: string; full_name: string } | null
}


// ── Store visual config ───────────────────────────────────────────────────────

const STORE_VISUALS: Record<string, { emoji: string; bg: string; ring: string; text: string }> = {
  'רמי לוי':       { emoji: '🛒', bg: 'bg-blue-50',    ring: 'ring-blue-300',    text: 'text-blue-800'    },
  'מעיין 2000':    { emoji: '🧺', bg: 'bg-orange-50',  ring: 'ring-orange-300',  text: 'text-orange-800'  },
  'סופר ספיר':     { emoji: '💎', bg: 'bg-primary-50', ring: 'ring-primary-300', text: 'text-primary-800' },
  'אינגליש קייק':  { emoji: '🎂', bg: 'bg-purple-50',  ring: 'ring-purple-300',  text: 'text-purple-800'  },
}

function storeVisual(name: string) {
  return STORE_VISUALS[name] ?? { emoji: '🏪', bg: 'bg-gray-50', ring: 'ring-gray-300', text: 'text-gray-700' }
}

// ── StorePickerModal ─────────────────────────────────────────────────────────

function StorePickerModal({
  stores,
  familyId,
  onSelect,
  onSkip,
}: {
  stores: Store[]
  familyId: string
  onSelect: (store: Store) => Promise<void>
  onSkip: () => void
}) {
  const [showAdd, setShowAdd]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSelect(store: Store) {
    setSelected(store.id)
    await onSelect(store)
  }

  async function handleAddStore() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('stores')
        .insert({ name: newName.trim(), family_id: familyId })
        .select()
        .single()
      if (error) throw error
      if (data) await handleSelect(data)
    } catch {
      await onSelect({ id: '', name: newName.trim(), family_id: null, logo_url: null, website: null, is_active: true, created_at: '' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onSkip} />

      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[88vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pb-8">
          <div className="flex items-center justify-between mb-5 mt-2">
            <div>
              <h2 className="text-xl font-extrabold text-gray-800">באיזו חנות אתה קונה?</h2>
              <p className="text-sm text-gray-400 mt-0.5">בחר חנות לשמירת הקנייה</p>
            </div>
            <button
              onClick={onSkip}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {stores.map(store => {
              const v = storeVisual(store.name)
              const isSelected = selected === store.id
              return (
                <button
                  key={store.id}
                  onClick={() => handleSelect(store)}
                  disabled={!!selected}
                  className={`
                    flex flex-col items-center justify-center gap-2 p-4 rounded-2xl
                    border-2 transition-all duration-150 active:scale-95
                    ${isSelected
                      ? `${v.bg} ring-2 ring-offset-1 ${v.ring} border-transparent scale-105`
                      : `${v.bg} border-transparent hover:ring-2 ${v.ring}`
                    }
                    ${selected && !isSelected ? 'opacity-40' : ''}
                  `}
                >
                  <span className="text-3xl">{v.emoji}</span>
                  <span className={`text-sm font-bold ${v.text}`}>{store.name}</span>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-primary-500 absolute top-2 left-2" />
                  )}
                </button>
              )
            })}
          </div>

          {!showAdd ? (
            <button
              onClick={() => { setShowAdd(true); setTimeout(() => inputRef.current?.focus(), 100) }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                         border-2 border-dashed border-gray-200 text-gray-400
                         hover:border-primary-300 hover:text-primary-500 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              הוסף חנות חדשה
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStore()}
                className="input flex-1"
                placeholder="שם החנות..."
              />
              <button
                onClick={handleAddStore}
                disabled={!newName.trim() || saving}
                className="btn-primary px-4 flex-shrink-0"
              >
                {saving ? '...' : 'הוסף'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewName('') }}
                className="p-3 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={onSkip}
            className="w-full mt-3 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium"
          >
            דלג — קנה ללא בחירת חנות
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ItemDetailModal — shows full item details in ShopPage ────────────────────

function ItemDetailModal({
  item,
  onClose,
  onLightbox,
}: {
  item: ListItem
  onClose: () => void
  onLightbox: (src: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-[90%] max-w-sm mx-auto p-5">
        <button
          onClick={onClose}
          className="absolute top-3 left-3 p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-extrabold text-gray-800 mb-3 pl-10">{item.name}</h3>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">כמות:</span>
            <span className="font-bold text-gray-800">{item.quantity} {item.unit}</span>
          </div>

          {item.note && (
            <div>
              <span className="text-sm text-gray-400">הערה:</span>
              <p className="text-sm text-gray-700 mt-1 bg-gray-50 rounded-xl px-3 py-2">
                {item.note}
              </p>
            </div>
          )}

          {item.image_url && (
            <button onClick={() => { onClose(); onLightbox(item.image_url!) }} className="w-full">
              <img
                src={item.image_url}
                alt=""
                className="w-full max-h-48 object-cover rounded-2xl border border-gray-100"
              />
              <p className="text-xs text-gray-400 mt-1">לחץ להגדלה</p>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ActiveItem ────────────────────────────────────────────────────────────────


const ActiveItem = memo(function ActiveItem({
  item,
  itemCategory,
  readOnly,
  index,
  total,
  onCheck,
  onDefer,
  onTap,
  onMoveUp,
  onMoveDown,
  onMoveTo,
  onChangeCategory,
  categories,
}: {
  item: ListItemWithUser
  itemCategory: Category
  readOnly?: boolean
  index: number
  total: number
  onCheck: (item: ListItemWithUser) => void
  onDefer: (item: ListItemWithUser) => void
  onTap: (item: ListItemWithUser) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMoveTo: (targetIdx: number) => void
  onChangeCategory: (catId: string) => void
  categories: Category[]
}) {
  const hasExtra = !!(item.note || item.image_url)
  const [editingPos, setEditingPos] = useState(false)
  const [posValue, setPosValue] = useState('')
  const [showCatPicker, setShowCatPicker] = useState(false)

  function handlePosSubmit() {
    const target = parseInt(posValue, 10) - 1
    if (!isNaN(target) && target >= 0 && target < total && target !== index) {
      onMoveTo(target)
    }
    setEditingPos(false)
  }

  return (
    <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-3
                    shadow-sm border border-gray-100">
      {/* Position number + arrows */}
      <div className="flex flex-col items-center gap-0 flex-shrink-0 w-8">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="w-6 h-5 rounded flex items-center justify-center
                     text-gray-300 hover:text-primary-600 disabled:opacity-20 transition-colors"
        >
          <MoveUp className="w-3 h-3" />
        </button>
        {editingPos ? (
          <input
            type="number"
            value={posValue}
            onChange={e => setPosValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handlePosSubmit(); if (e.key === 'Escape') setEditingPos(false) }}
            onBlur={handlePosSubmit}
            className="w-8 h-5 text-center text-xs font-bold border border-primary-300 rounded bg-primary-50
                       focus:outline-none"
            autoFocus
            min={1}
            max={total}
          />
        ) : (
          <button
            onClick={() => { setPosValue(String(index + 1)); setEditingPos(true) }}
            className="w-6 h-5 text-[10px] font-bold text-gray-400 hover:text-primary-600
                       hover:bg-primary-50 rounded transition-colors"
          >
            {index + 1}
          </button>
        )}
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="w-6 h-5 rounded flex items-center justify-center
                     text-gray-300 hover:text-primary-600 disabled:opacity-20 transition-colors"
        >
          <MoveDown className="w-3 h-3" />
        </button>
      </div>

      {/* Category picker */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowCatPicker(v => !v)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm
                     hover:bg-gray-100 active:bg-gray-200 transition-colors"
          title={itemCategory.label}
        >
          {itemCategory.emoji}
        </button>
        {showCatPicker && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowCatPicker(false)} />
            <div className="absolute top-8 right-0 z-40 bg-white rounded-2xl shadow-xl border border-gray-100
                            overflow-hidden w-44 max-h-64 overflow-y-auto">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { onChangeCategory(cat.id); setShowCatPicker(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors
                             ${cat.id === itemCategory.id ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <span className="text-base">{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Name + qty — tappable area */}
      <button onClick={() => onTap(item)} className="flex-1 min-w-0 text-right relative">
        <div className="flex items-start gap-1.5">
          <p className="text-base font-semibold text-gray-800 leading-tight whitespace-normal break-words">
            {item.name}
            {item.quantity !== 1 && (
              <span className="text-sm font-bold text-gray-400 mr-1">×{item.quantity}</span>
            )}
          </p>
          {hasExtra && (
            <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />
          )}
        </div>
      </button>

      {/* ✓ לעגלה + → להמשך (hidden for viewer) */}
      {!readOnly && (
        <>
          <button
            onClick={() => onCheck(item)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl
                       bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                       transition-colors text-white text-xs font-bold flex-shrink-0 min-h-[40px]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>לעגלה</span>
          </button>
          <button
            onClick={() => onDefer(item)}
            className="flex items-center gap-1 px-3 py-2.5 rounded-xl
                       bg-gray-100 hover:bg-gray-200 active:bg-gray-300
                       transition-colors text-gray-500 text-xs font-semibold flex-shrink-0 min-h-[40px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>להמשך</span>
          </button>
        </>
      )}
    </div>
  )
})

// ── DeferredItem ──────────────────────────────────────────────────────────────

const DeferredItem = memo(function DeferredItem({
  item,
  onUndo,
}: {
  item: ListItem
  onUndo: (item: ListItem) => void
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3
                    border border-gray-200 shadow-sm">
      <ArrowLeft className="w-4 h-4 text-gray-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-600 truncate">{item.name}</p>
        {(item.quantity !== 1 || item.unit !== 'יחידה') && (
          <p className="text-xs text-gray-400">{item.quantity} {item.unit}</p>
        )}
      </div>
      <button
        onClick={() => onUndo(item)}
        title="החזר לרשימה הנוכחית"
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                   text-primary-600 bg-primary-50 hover:bg-primary-100
                   active:bg-primary-200 transition-colors"
      >
        <Undo2 className="w-3.5 h-3.5" />
        החזר
      </button>
    </div>
  )
})

// ── ShopPage ──────────────────────────────────────────────────────────────────

type DoneState = 'idle' | 'complete' | 'continue'

function patch(items: ListItemWithUser[], id: string, p: Partial<ListItem>) {
  return items.map(i => (i.id === id ? { ...i, ...p } : i))
}

export default function ShopPage() {
  const { profile } = useAuth()

  // data
  const [list, setList]           = useState<ShoppingList | null>(null)
  const [items, setItems]         = useState<ListItemWithUser[]>([])
  const [stores, setStores]       = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)

  // ui — restore doneState from localStorage
  const [loading, setLoading]         = useState(true)
  const [completing, setCompleting]   = useState(false)
  const [showPicker, setShowPicker]   = useState(false)
  const [showChecked, setShowChecked] = useState(false)
  const [showDeferred, setShowDeferred] = useState(true)
  const [doneState, setDoneState]     = useState<DoneState>(() => {
    const saved = localStorage.getItem('shopDoneState')
    return (saved === 'complete' || saved === 'continue') ? saved : 'idle'
  })
  const [deferredCount, setDeferredCount] = useState(() => {
    return parseInt(localStorage.getItem('shopDeferredCount') ?? '0', 10)
  })

  // detail modal & lightbox
  const [detailItem, setDetailItem]     = useState<ListItemWithUser | null>(null)
  const [lightboxSrc, setLightboxSrc]   = useState<string | null>(null)

  // receipt modal
  const [completedPurchaseId, setCompletedPurchaseId] = useState<string | null>(null)
  const [showReceiptModal, setShowReceiptModal]       = useState(false)

  // ── load ──
  useEffect(() => {
    if (!profile?.family_id) return
    loadAll()
  }, [profile?.family_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── realtime ──
  useEffect(() => {
    if (!list?.id) return
    const ch = supabase
      .channel(`shop-rt-${list.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'list_items', filter: `list_id=eq.${list.id}` },
        (payload) => setItems(prev => prev.map(i => i.id === payload.new.id
          ? { ...payload.new, added_by_user: i.added_by_user } as ListItemWithUser
          : i)),
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [list?.id])

  async function loadAll() {
    setLoading(true)
    console.time('⏱ ShopPage total')

    // Run ALL queries in parallel (stores + list + order data + custom categories)
    console.time('⏱ batch1: stores+list+order+customCats')
    const [storeRes, listRes, orderRes, customCatRes] = await Promise.all([
      supabase.from('stores').select('*').eq('is_active', true).eq('family_id', profile!.family_id).order('name'),
      supabase
        .from('shopping_lists').select('*')
        .eq('family_id', profile!.family_id)
        .in('status', ['active', 'shopping'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('shopping_order')
        .select('type, order_data')
        .eq('family_id', profile!.family_id)
        .in('type', ['customOrder', 'catOrder']),
      supabase
        .from('custom_categories')
        .select('id, family_id, name, emoji, created_by')
        .eq('family_id', profile!.family_id)
        .order('created_at'),
    ])
    console.timeEnd('⏱ batch1: stores+list+order+customCats')

    const storeData = storeRes.data
    const listData = listRes.data
    const orderData = orderRes.data
    if (storeRes.error) console.error('⏱ stores error:', storeRes.error.message)
    if (listRes.error) console.error('⏱ list error:', listRes.error.message)
    if (orderRes.error) console.error('⏱ order error:', orderRes.error.message)

    if (storeData) setStores(storeData)
    if (customCatRes.data) setCustomCats(customCatRes.data)

    // Apply order data
    for (const row of orderData ?? []) {
      if (row.type === 'customOrder' && Array.isArray(row.order_data)) setCustomOrder(row.order_data)
      // catOverrides removed — item_categories is single source of truth
      if (row.type === 'catOrder' && Array.isArray(row.order_data)) setCatOrder(row.order_data as string[])
    }
    setTimeout(() => { orderLoadedRef.current = true }, 100)

    if (listData) {
      setList(listData)

      // Load items + categories in parallel
      console.time('⏱ batch2: items+categories')
      const [itemRes, catRes] = await Promise.all([
        supabase
          .from('list_items')
          .select('*, added_by_user:users!added_by(id, full_name)')
          .eq('list_id', listData.id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('item_categories')
          .select('name, category')
          .eq('family_id', profile!.family_id),
      ])
      console.timeEnd('⏱ batch2: items+categories')

      const itemData = itemRes.data
      const catData = catRes.data
      if (itemRes.error) console.error('⏱ items error:', itemRes.error.message)
      if (catRes.error) console.error('⏱ categories error:', catRes.error.message)
      console.log(`⏱ loaded: ${(itemData ?? []).length} items, ${(catData ?? []).length} categories`)

      setItems((itemData as ListItemWithUser[]) ?? [])

      // Apply saved categories
      if (catData) {
        const map: Record<string, string> = {}
        for (const r of catData) map[r.name] = r.category
        console.log('🏷️ loaded savedCats:', Object.keys(map).length, 'entries', map)
        setSavedCats(map)
      } else {
        console.log('🏷️ no catData returned from item_categories')
      }

      // doneState logic
      const savedDone = localStorage.getItem('shopDoneState')
      const savedListId = localStorage.getItem('shopCompletedListId')
      if (savedDone && savedListId !== listData.id) {
        localStorage.removeItem('shopDoneState')
        localStorage.removeItem('shopDeferredCount')
        localStorage.removeItem('shopCompletedListId')
        setDoneState('idle')
      }

      if (listData.store_id) {
        const found = storeData?.find(s => s.id === listData.store_id)
        if (found) setSelectedStore(found)
        setShowPicker(false)
      } else {
        const currentDone = localStorage.getItem('shopDoneState')
        if (!currentDone || currentDone === 'idle') {
          setShowPicker(true)
        }
      }
    }

    console.timeEnd('⏱ ShopPage total')
    setLoading(false)
  }

  // ── store selection ──
  async function handleSelectStore(store: Store) {
    setSelectedStore(store)
    setShowPicker(false)
    if (list && store.id) {
      await supabase.from('shopping_lists').update({ store_id: store.id }).eq('id', list.id)
    }
  }

  // ── item actions ──
  async function checkItem(item: ListItem) {
    const now = new Date().toISOString()
    setItems(prev => patch(prev, item.id, {
      is_checked: true, is_deferred: false,
      checked_by: profile!.id, checked_at: now,
    }))
    await supabase.from('list_items').update({
      is_checked: true, is_deferred: false,
      checked_by: profile!.id, checked_at: now,
    }).eq('id', item.id)
  }

  async function deferItem(item: ListItem) {
    setItems(prev => patch(prev, item.id, {
      is_deferred: true, is_checked: false,
      checked_by: null, checked_at: null,
    }))
    setShowDeferred(true)
    await supabase.from('list_items').update({
      is_deferred: true, is_checked: false,
      checked_by: null, checked_at: null,
    }).eq('id', item.id)
  }

  async function undoDeferItem(item: ListItem) {
    setItems(prev => patch(prev, item.id, { is_deferred: false }))
    await supabase.from('list_items').update({ is_deferred: false }).eq('id', item.id)
  }

  async function uncheckItem(item: ListItem) {
    setItems(prev => patch(prev, item.id, { is_checked: false, checked_by: null, checked_at: null }))
    await supabase.from('list_items').update({
      is_checked: false, checked_by: null, checked_at: null,
    }).eq('id', item.id)
  }

  // ── complete shopping ──
  async function completeShop() {
    if (!list || !profile?.family_id) return
    setCompleting(true)

    const deferred = items.filter(i => i.is_deferred)
    setDeferredCount(deferred.length)

    // 1. Mark list as completed
    await supabase.from('shopping_lists').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', list.id)

    // 2. Save purchase record — capture ID
    const { data: purchaseData } = await supabase
      .from('purchases')
      .insert({
        family_id:    profile.family_id,
        store_id:     selectedStore?.id ?? null,
        list_id:      list.id,
        purchased_by: profile.id,
        purchased_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (purchaseData?.id) {
      setCompletedPurchaseId(purchaseData.id)

      // Save checked items as purchase_items (for history analysis)
      const checkedItems = items.filter(i => i.is_checked)
      if (checkedItems.length > 0) {
        await supabase.from('purchase_items').insert(
          checkedItems.map(item => ({
            purchase_id: purchaseData.id,
            product_id:  item.product_id ?? null,
            name:        item.name,
            quantity:    item.quantity,
            unit:        item.unit,
          })),
        )

        // Mark checked list_items with store and purchase time
        const checkedIds = checkedItems.map(i => i.id)
        await supabase.from('list_items').update({
          purchased_store_id: selectedStore?.id ?? null,
          purchased_at:       new Date().toISOString(),
        }).in('id', checkedIds)
      }
    }

    // 3. Move deferred items to new list
    if (deferred.length > 0) {
      const { data: newList } = await supabase
        .from('shopping_lists')
        .insert({
          family_id:  profile.family_id,
          name:       'המשך קנייה',
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
    }

    // 4. Save item categories to DB for future sessions
    const catRows = items
      .filter(i => i.is_checked || i.is_deferred)
      .map(item => ({
        name:       item.name,
        category:   getItemCategory(item).id,
        family_id:  profile.family_id,
        updated_at: new Date().toISOString(),
      }))
    if (catRows.length > 0) {
      await supabase.from('item_categories').upsert(catRows, { onConflict: 'name,family_id' })
    }

    setCompleting(false)
    setShowReceiptModal(true) // Show receipt modal before done screen
  }

  function handleReceiptClose() {
    setShowReceiptModal(false)
    const state = deferredCount > 0 ? 'continue' : 'complete'
    setDoneState(state)
    localStorage.setItem('shopDoneState', state)
    localStorage.setItem('shopDeferredCount', String(deferredCount))
    if (list) localStorage.setItem('shopCompletedListId', list.id)
  }

  // ── derived state ──
  const active    = items.filter(i => !i.is_checked && !i.is_deferred)
  const checked   = items.filter(i =>  i.is_checked)
  const deferred  = items.filter(i =>  i.is_deferred)
  const total     = items.length
  const allDone   = total > 0 && active.length === 0
  const pct       = total > 0 ? Math.round((checked.length / total) * 100) : 0
  const v = selectedStore ? storeVisual(selectedStore.name) : null

  // ── saved categories from DB (name → category) ──
  const [savedCats, setSavedCats] = useState<Record<string, string>>({})

  // ── custom categories ──
  const [customCats, setCustomCats] = useState<CustomCategoryRow[]>([])
  const { allCats: allCatsMap, allList: allCatsList, order: dynamicCatOrder } = buildAllCategories(customCats)

  // ── custom sort order + category overrides (synced to DB) ──
  // Loaded in loadAll(), not separate useEffects
  const [customOrder, setCustomOrder] = useState<string[]>([])
  const orderLoadedRef = useRef(false)
  const skipRealtimeRef = useRef(false)

  // Debounced save — batches all changes into one save per type
  // Per-type debounce timers so concurrent saves don't cancel each other
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  function saveOrderToDB(type: string, orderData: unknown) {
    if (!profile?.family_id || !orderLoadedRef.current) return
    if (saveTimersRef.current[type]) clearTimeout(saveTimersRef.current[type])
    saveTimersRef.current[type] = setTimeout(() => {
      skipRealtimeRef.current = true
      supabase.from('shopping_order').upsert({
        family_id:  profile.family_id,
        type,
        order_data: orderData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'family_id,type' }).then(({ error }) => {
        if (error) console.error(`⏱ saveOrderToDB(${type}) error:`, error.message)
        setTimeout(() => { skipRealtimeRef.current = false }, 1000)
      })
    }, 300)
  }

  // Realtime sync — listen for changes from other users
  useEffect(() => {
    if (!profile?.family_id) return
    const ch = supabase
      .channel('shopping-order-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_order', filter: `family_id=eq.${profile.family_id}` },
        (payload) => {
          if (skipRealtimeRef.current) return
          const row = payload.new as { type: string; order_data: unknown }
          if (row.type === 'customOrder' && Array.isArray(row.order_data)) setCustomOrder(row.order_data)
          // catOverrides removed — item_categories is single source of truth
          if (row.type === 'catOrder' && Array.isArray(row.order_data)) setCatOrder(row.order_data as string[])
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.family_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Get effective category: DB saved (by name) → auto-classify
  function getItemCategory(item: ListItemWithUser): Category {
    const savedId = savedCats[item.name]
    if (savedId && allCatsMap[savedId]) return allCatsMap[savedId]
    return classifyItem(item.name)
  }

  // Default category-sorted flat list
  const defaultSorted = useMemo(() => {
    return [...active].sort((a, b) => {
      const catA = dynamicCatOrder.indexOf(getItemCategory(a).id)
      const catB = dynamicCatOrder.indexOf(getItemCategory(b).id)
      return catA - catB
    })
  }, [active, savedCats, customCats]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flat sorted list
  const flatActive = useMemo(() => {
    const seen = new Set<string>()
    function dedup(arr: ListItemWithUser[]) {
      return arr.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true })
    }
    if (customOrder.length === 0) return dedup(defaultSorted)
    const orderMap = new Map(customOrder.map((id, idx) => [id, idx]))
    return dedup([...active].sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999)))
  }, [active, customOrder, defaultSorted])

  // Group by unique category (using overrides)
  const groupedActive = useMemo(() => {
    const catMap = new Map<string, { category: Category; items: ListItemWithUser[]; firstIdx: number }>()
    flatActive.forEach((item, idx) => {
      const cat = getItemCategory(item)
      if (!catMap.has(cat.id)) {
        catMap.set(cat.id, { category: cat, items: [], firstIdx: idx })
      }
      catMap.get(cat.id)!.items.push(item)
    })
    return [...catMap.values()].sort((a, b) => a.firstIdx - b.firstIdx)
  }, [flatActive, savedCats]) // eslint-disable-line react-hooks/exhaustive-deps

  // Display order: categories then items within each
  const displayOrder = useMemo(() => groupedActive.flatMap(g => g.items), [groupedActive])

  function moveItem(itemId: string, direction: 'up' | 'down') {
    const ids = displayOrder.map(i => i.id)
    const idx = ids.indexOf(itemId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= ids.length) return

    const neighborCat = getItemCategory(displayOrder[swapIdx]).id
    const movedItem = displayOrder[idx]
    const movedCat = getItemCategory(movedItem).id
    if (neighborCat !== movedCat && profile?.family_id) {
      setSavedCats(prev => ({ ...prev, [movedItem.name]: neighborCat }))
      supabase.from('item_categories').upsert({
        name: movedItem.name, category: neighborCat, family_id: profile.family_id, updated_at: new Date().toISOString(),
      }, { onConflict: 'name,family_id' })
    }

    ;[ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]]
    setCustomOrder(ids)
    saveOrderToDB('customOrder', ids)
  }

  function moveItemTo(itemId: string, targetIdx: number) {
    const ids = displayOrder.map(i => i.id)
    const fromIdx = ids.indexOf(itemId)
    if (fromIdx < 0 || targetIdx < 0 || targetIdx >= ids.length) return

    const targetCat = getItemCategory(displayOrder[targetIdx]).id
    const movedItem = displayOrder[fromIdx]
    const movedCat = getItemCategory(movedItem).id
    if (targetCat !== movedCat && profile?.family_id) {
      setSavedCats(prev => ({ ...prev, [movedItem.name]: targetCat }))
      supabase.from('item_categories').upsert({
        name: movedItem.name, category: targetCat, family_id: profile.family_id, updated_at: new Date().toISOString(),
      }, { onConflict: 'name,family_id' })
    }

    ;[ids[fromIdx], ids[targetIdx]] = [ids[targetIdx], ids[fromIdx]]
    setCustomOrder(ids)
    saveOrderToDB('customOrder', ids)
  }

  function changeItemCategory(itemId: string, newCatId: string) {
    const item = items.find(i => i.id === itemId)
    if (!item || !profile?.family_id) return

    // Update local state immediately
    setSavedCats(prev => ({ ...prev, [item.name]: newCatId }))

    // Initialize custom order if needed
    if (customOrder.length === 0) {
      const newOrder = displayOrder.map(i => i.id)
      setCustomOrder(newOrder)
      saveOrderToDB('customOrder', newOrder)
    }

    // Save to item_categories (single source of truth)
    supabase.from('item_categories').upsert({
      name:       item.name,
      category:   newCatId,
      family_id:  profile.family_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'name,family_id' }).then(({ error }) => {
      if (error) console.error('🏷️ ShopPage save FAILED:', error.message, error.code)
    })
  }

  // ── search ──
  const [searchQuery, setSearchQuery] = useState('')

  // ── collapse state (local only — personal preference) ──
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('shopCollapsedCats')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })

  // ── category order (synced to DB) ──
  const [catOrder, setCatOrder] = useState<string[]>([])

  useEffect(() => {
    if (collapsedCats.size > 0) localStorage.setItem('shopCollapsedCats', JSON.stringify([...collapsedCats]))
    else localStorage.removeItem('shopCollapsedCats')
  }, [collapsedCats])

  // Apply custom category order to groupedActive
  const sortedGroups = useMemo(() => {
    if (catOrder.length === 0) return groupedActive
    const orderMap = new Map(catOrder.map((id, idx) => [id, idx]))
    return [...groupedActive].sort((a, b) =>
      (orderMap.get(a.category.id) ?? 999) - (orderMap.get(b.category.id) ?? 999)
    )
  }, [groupedActive, catOrder])

  // Search filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.trim().toLowerCase()
    return active.filter(i => i.name.toLowerCase().includes(q))
  }, [searchQuery, active])

  function toggleCollapse(catId: string) {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      next.has(catId) ? next.delete(catId) : next.add(catId)
      return next
    })
  }

  function toggleCollapseAll() {
    const allIds = sortedGroups.map(g => g.category.id)
    if (collapsedCats.size >= allIds.length) {
      setCollapsedCats(new Set())
    } else {
      setCollapsedCats(new Set(allIds))
    }
  }

  function moveCategoryOrder(catId: string, direction: 'up' | 'down') {
    const currentOrder = sortedGroups.map(g => g.category.id)
    const idx = currentOrder.indexOf(catId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= currentOrder.length) return
    ;[currentOrder[idx], currentOrder[swapIdx]] = [currentOrder[swapIdx], currentOrder[idx]]
    setCatOrder(currentOrder)
    saveOrderToDB('catOrder', currentOrder)
  }

  function resetOrder() {
    setCustomOrder([])
    setCatOrder([])
    setCollapsedCats(new Set())
    localStorage.removeItem('shopCollapsedCats')
    // DB cleanup
    if (profile?.family_id) {
      supabase.from('shopping_order').delete().eq('family_id', profile.family_id)
    }
  }

  // ════════════════════════════════════════
  // SCREENS
  // ════════════════════════════════════════

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Done: all checked, none deferred ──
  if (doneState === 'complete') return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="text-7xl mb-5 animate-bounce">🎉</div>
      <h2 className="text-2xl font-extrabold text-primary-700 mb-2">הקנייה הושלמה!</h2>
      <p className="text-gray-400 text-sm">כל הפריטים נקנו בהצלחה</p>
      {selectedStore && (
        <div className={`mt-5 flex items-center gap-2 px-4 py-2.5 rounded-2xl ${v?.bg}`}>
          <span className="text-xl">{v?.emoji}</span>
          <span className={`text-sm font-semibold ${v?.text}`}>{selectedStore.name}</span>
        </div>
      )}
    </div>
  )

  // ── Done: some deferred → new list created ──
  if (doneState === 'continue') return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="text-7xl mb-5">✅</div>
      <h2 className="text-2xl font-extrabold text-primary-700 mb-2">הקנייה הושלמה!</h2>
      <p className="text-gray-500 text-sm mb-5">הפריטים שבחרת לדחות הועברו לרשימה חדשה</p>
      <div className="card-green w-full max-w-xs text-right">
        <p className="text-sm font-bold text-primary-800 mb-1">📋 "המשך קנייה" נוצרה</p>
        <p className="text-xs text-primary-600">
          {deferredCount} {deferredCount === 1 ? 'פריט ממתין' : 'פריטים ממתינים'} לקנייה במקום אחר
        </p>
        <p className="text-xs text-primary-500 mt-1">תמצא אותה בלשונית הרשימה 🛒</p>
      </div>
    </div>
  )

  // ── No list ──
  if (!list || items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-primary-50 rounded-full p-6 mb-5">
        <ShoppingCart className="w-14 h-14 text-primary-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">אין רשימה פעילה</h3>
      <p className="text-gray-400 text-sm">הוסף פריטים ברשימה תחילה</p>
    </div>
  )

  // ════════════════════════════════════════
  // MAIN SHOPPING SCREEN
  // ════════════════════════════════════════

  return (
    <>
      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {/* ── Item Detail Modal ── */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onLightbox={setLightboxSrc}
        />
      )}

      {/* ── Store Picker Modal ── */}
      {showPicker && (
        <StorePickerModal
          stores={stores}
          familyId={profile!.family_id!}
          onSelect={handleSelectStore}
          onSkip={() => setShowPicker(false)}
        />
      )}

      {/* ── Receipt Modal (shown after completing) ── */}
      {showReceiptModal && completedPurchaseId && (
        <ReceiptModal
          purchaseId={completedPurchaseId}
          storeName={selectedStore?.name}
          celebrationMode={true}
          onClose={handleReceiptClose}
        />
      )}

      <div className="pb-32 space-y-3">

        {/* ── Header: store badge + progress ── */}
        <div className={`rounded-2xl p-4 transition-all ${allDone ? 'bg-primary-600' : 'bg-primary-50 border border-primary-100'}`}>

          <div className="flex items-center justify-between mb-3">
            {selectedStore ? (
              <button
                onClick={() => setShowPicker(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold
                            ${v?.bg} ${v?.text} border border-transparent ring-1 ${v?.ring}`}
              >
                <span>{v?.emoji}</span>
                <span>{selectedStore.name}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowPicker(true)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary-500
                           transition-colors font-medium"
              >
                <MapPin className="w-3.5 h-3.5" />
                בחר חנות
              </button>
            )}

            <span className={`text-3xl font-extrabold ${allDone ? 'text-white' : 'text-primary-600'}`}>
              {pct}%
            </span>
          </div>

          {/* Progress bar */}
          <div className={`h-3 rounded-full overflow-hidden ${allDone ? 'bg-primary-500' : 'bg-primary-100'}`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out
                          ${allDone ? 'bg-white' : 'bg-primary-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className={`flex gap-4 mt-2 text-xs font-medium ${allDone ? 'text-primary-100' : 'text-primary-500'}`}>
            <span>✓ {checked.length} בעגלה</span>
            {deferred.length > 0 && <span>→ {deferred.length} להמשך</span>}
            {active.length > 0 && <span>· {active.length} נותרו</span>}
          </div>
        </div>

        {/* ── Search + toolbar ── */}
        {active.length > 0 && (
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="חפש פריט..."
                className="w-full rounded-xl border border-gray-200 bg-white pr-9 pl-3 py-2 text-sm
                           placeholder-gray-400 focus:outline-none focus:border-primary-400 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={toggleCollapseAll}
              className="p-2 rounded-xl text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              title={collapsedCats.size >= sortedGroups.length ? 'פתח הכל' : 'כווץ הכל'}
            >
              <ChevronsUpDown className="w-4 h-4" />
            </button>
            {(customOrder.length > 0 || catOrder.length > 0) && (
              <button
                onClick={resetOrder}
                className="text-xs text-gray-400 hover:text-primary-600 font-medium
                           px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors whitespace-nowrap"
              >
                ↺ איפוס
              </button>
            )}
          </div>
        )}

        {/* ── Search results (flat, no categories) ── */}
        {searchResults ? (
          searchResults.length > 0 ? (
            <div className="space-y-1.5">
              {searchResults.map(item => {
                const dispIdx = displayOrder.indexOf(item)
                return (
                  <ActiveItem
                    key={item.id} item={item}
                    itemCategory={getItemCategory(item)}
                    readOnly={!canEdit(profile!.role)}
                    index={dispIdx}
                    total={displayOrder.length}
                    onCheck={checkItem} onDefer={deferItem}
                    onTap={setDetailItem}
                    onMoveUp={() => moveItem(item.id, 'up')}
                    onMoveDown={() => moveItem(item.id, 'down')}
                    onMoveTo={(targetIdx) => moveItemTo(item.id, targetIdx)}
                    onChangeCategory={(catId) => changeItemCategory(item.id, catId)}
                    categories={allCatsList}
                  />
                )
              })}
            </div>
          ) : (
            <p className="text-center text-gray-400 text-sm py-4">לא נמצאו פריטים</p>
          )
        ) : active.length > 0 ? (
          /* ── Active items grouped by category ── */
          <div className="space-y-3">
            {sortedGroups.map((group, groupIdx) => {
              const isCollapsed = collapsedCats.has(group.category.id)
              return (
                <div key={group.category.id}>
                  {/* Category header with controls */}
                  <div className="flex items-center gap-1.5 px-1 mb-1.5">
                    <button onClick={() => toggleCollapse(group.category.id)}
                      className="text-gray-400 hover:text-primary-600 transition-colors">
                      {isCollapsed
                        ? <ChevronLeft className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />
                      }
                    </button>
                    <span className="text-base">{group.category.emoji}</span>
                    <span className="text-xs font-bold text-gray-500">{group.category.label}</span>
                    <span className="text-xs text-gray-300">({group.items.length})</span>
                    <div className="flex-1" />
                    {/* Category move arrows */}
                    <button
                      onClick={() => moveCategoryOrder(group.category.id, 'up')}
                      disabled={groupIdx === 0}
                      className="w-5 h-5 rounded flex items-center justify-center
                                 text-gray-300 hover:text-primary-600 disabled:opacity-20 transition-colors"
                    >
                      <MoveUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moveCategoryOrder(group.category.id, 'down')}
                      disabled={groupIdx === sortedGroups.length - 1}
                      className="w-5 h-5 rounded flex items-center justify-center
                                 text-gray-300 hover:text-primary-600 disabled:opacity-20 transition-colors"
                    >
                      <MoveDown className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Items (hidden when collapsed) */}
                  {!isCollapsed && (
                    <div className="space-y-1.5">
                      {group.items.map(item => {
                        const dispIdx = displayOrder.indexOf(item)
                        return (
                          <ActiveItem
                            key={item.id} item={item}
                            itemCategory={getItemCategory(item)}
                            readOnly={!canEdit(profile!.role)}
                            index={dispIdx}
                            total={displayOrder.length}
                            onCheck={checkItem} onDefer={deferItem}
                            onTap={setDetailItem}
                            onMoveUp={() => moveItem(item.id, 'up')}
                            onMoveDown={() => moveItem(item.id, 'down')}
                            onMoveTo={(targetIdx) => moveItemTo(item.id, targetIdx)}
                            onChangeCategory={(catId) => changeItemCategory(item.id, catId)}
                            categories={allCatsList}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          checked.length > 0 && (
            <div className="text-center py-3">
              <p className="text-primary-600 font-bold text-sm">🛒 כל הפריטים הנוכחיים בעגלה!</p>
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
                               hover:bg-gray-50 transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary-400 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-400 line-through text-right truncate">
                      {item.name}
                    </span>
                    <Undo2 className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Complete button ── */}
        {allDone && canEdit(profile!.role) && (
          <button
            onClick={completeShop}
            disabled={completing || !!completedPurchaseId}
            className="btn-primary w-full text-base py-4 shadow-lg shadow-primary-200"
          >
            <Trophy className="w-5 h-5" />
            {completing
              ? 'שומר קנייה...'
              : deferred.length > 0
                ? `סיים + העבר ${deferred.length} פריטים להמשך 🎉`
                : 'סיים קנייה 🎉'}
          </button>
        )}

        {/* ── Deferred — collapsible bottom section ── */}
        <div className="rounded-2xl overflow-hidden border-2 border-dashed border-gray-200">
          <button
            onClick={() => setShowDeferred(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5
                       bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-600">
              <ArrowLeft className="w-4 h-4 text-gray-400" />
              רשימת המשך
              {deferred.length > 0 && (
                <span className="bg-gray-200 text-gray-700 text-xs font-extrabold
                                 rounded-full px-2.5 py-0.5 min-w-[22px] text-center">
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
                <p className="text-center text-gray-400 text-xs py-4">
                  לחץ "להמשך" על פריט כדי להעביר אותו לכאן
                </p>
              ) : (
                <>
                  {deferred.map(item => (
                    <DeferredItem key={item.id} item={item} onUndo={undoDeferItem} />
                  ))}
                  <p className="text-xs text-gray-400 text-center pt-2 pb-1">
                    בסיום הקנייה, הפריטים יועברו לרשימה חדשה אוטומטית
                  </p>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  )
}
