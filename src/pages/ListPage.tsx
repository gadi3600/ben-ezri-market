import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Minus, Trash2, ShoppingBag, CheckCircle2, Camera,
  X, MessageSquare, ClipboardList,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { registerPushSubscription, sendPushToFamily } from '../lib/push'
import { canEdit, isAdmin } from '../lib/permissions'
import type { ShoppingList, ListItem } from '../lib/types'

// Extended item with joined user info
interface ListItemWithUser extends ListItem {
  added_by_user: { id: string; full_name: string } | null
}
import ImageLightbox from '../components/ImageLightbox'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function uploadItemImage(file: File, familyId: string, listId: string): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `${familyId}/${listId}/${name}`
  const { error } = await supabase.storage
    .from('list-item-images')
    .upload(path, file, { upsert: false })
  if (error) { console.error('Image upload failed:', error.message); return null }
  const { data } = supabase.storage.from('list-item-images').getPublicUrl(path)
  return data?.publicUrl ?? null
}

// ── EditItemModal ────────────────────────────────────────────────────────────

function EditItemModal({
  item,
  familyId,
  listId,
  onSave,
  onClose,
  onLightbox,
}: {
  item: ListItem
  familyId: string
  listId: string
  onSave: (id: string, updates: Partial<ListItem>) => void
  onClose: () => void
  onLightbox: (src: string) => void
}) {
  const [qty, setQty]       = useState(item.quantity)
  const [note, setNote]     = useState(item.note ?? '')
  const [imageUrl, setImageUrl] = useState(item.image_url)
  const [uploading, setUploading] = useState(false)
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)

  async function handleImageChange(file: File) {
    setUploading(true)
    const url = await uploadItemImage(file, familyId, listId)
    if (url) setImageUrl(url)
    setUploading(false)
  }

  function save() {
    onSave(item.id, {
      quantity:  qty,
      note:      note.trim() || null,
      image_url: imageUrl,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-5 mt-2">
            <h2 className="text-lg font-extrabold text-gray-800 truncate flex-1">{item.name}</h2>
            <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Qty */}
          <label className="block text-sm font-semibold text-gray-600 mb-2">כמות</label>
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center
                         text-gray-500 hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-2xl font-extrabold text-gray-800 w-12 text-center">{qty}</span>
            <button
              onClick={() => setQty(q => q + 1)}
              className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center
                         text-gray-500 hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Note */}
          <label className="block text-sm font-semibold text-gray-600 mb-2">
            <MessageSquare className="w-3.5 h-3.5 inline ml-1" />
            הערה
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            className="input min-h-[80px] mb-5 resize-none text-sm"
            placeholder="הערה לפריט..."
            rows={3}
          />

          {/* Image */}
          <label className="block text-sm font-semibold text-gray-600 mb-2">
            <Camera className="w-3.5 h-3.5 inline ml-1" />
            תמונה
          </label>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageChange(f); e.target.value = '' }} />
          <input ref={galRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageChange(f); e.target.value = '' }} />

          {imageUrl ? (
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => onLightbox(imageUrl!)} className="flex-shrink-0">
                <img src={imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-100" />
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => camRef.current?.click()}
                  className="text-xs text-primary-600 font-medium px-3 py-1.5 rounded-lg
                             bg-primary-50 hover:bg-primary-100 transition-colors"
                >
                  📷 צלם
                </button>
                <button
                  onClick={() => galRef.current?.click()}
                  className="text-xs text-primary-600 font-medium px-3 py-1.5 rounded-lg
                             bg-primary-50 hover:bg-primary-100 transition-colors"
                >
                  🖼️ גלריה
                </button>
                <button
                  onClick={() => setImageUrl(null)}
                  className="text-xs text-red-500 font-medium px-3 py-1.5 rounded-lg
                             bg-red-50 hover:bg-red-100 transition-colors"
                >
                  הסר
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => camRef.current?.click()}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl
                           border-2 border-dashed border-gray-200 text-gray-400
                           hover:border-primary-300 hover:text-primary-500 text-sm font-medium transition-colors"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>📷</span>
                )}
                צלם תמונה
              </button>
              <button
                onClick={() => galRef.current?.click()}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl
                           border-2 border-dashed border-gray-200 text-gray-400
                           hover:border-primary-300 hover:text-primary-500 text-sm font-medium transition-colors"
              >
                <span>🖼️</span>
                מהגלריה
              </button>
            </div>
          )}

          {/* Save */}
          <button onClick={save} className="btn-primary w-full">
            <CheckCircle2 className="w-4 h-4" />
            שמור שינויים
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Item row ────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  currentUserId,
  readOnly,
  selectMode,
  selected,
  onQtyChange,
  onDelete,
  onEdit,
  onLightbox,
  onToggleSelect,
}: {
  item: ListItemWithUser
  currentUserId: string
  readOnly?: boolean
  selectMode?: boolean
  selected?: boolean
  onQtyChange: (id: string, qty: number) => void
  onDelete: (id: string) => void
  onEdit: (item: ListItemWithUser) => void
  onLightbox: (src: string) => void
  onToggleSelect: (id: string) => void
}) {
  const adderName = item.added_by_user
    ? (item.added_by === currentUserId ? 'אני' : item.added_by_user.full_name.split(' ')[0])
    : null

  return (
    <div
      className={`bg-white rounded-2xl px-4 py-3 shadow-sm border transition-all duration-150 ${
        selected ? 'border-primary-300 bg-primary-50/40' : 'border-gray-100'
      }`}
      onClick={selectMode ? () => onToggleSelect(item.id) : undefined}
    >
      <div className="flex items-center gap-3">
        {/* Selection checkbox (in select mode) */}
        {selectMode && (
          <div className={`w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            selected
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'border-gray-300'
          }`}>
            {selected && <CheckCircle2 className="w-3.5 h-3.5" />}
          </div>
        )}

        {/* Thumbnail */}
        {item.image_url && !selectMode && (
          <button onClick={e => { e.stopPropagation(); onLightbox(item.image_url!) }} className="flex-shrink-0">
            <img
              src={item.image_url}
              alt=""
              className="w-10 h-10 rounded-xl object-cover border border-gray-100"
            />
          </button>
        )}

        {/* Name + added by */}
        <button
          onClick={e => { e.stopPropagation(); if (!selectMode && !readOnly) onEdit(item) }}
          className="flex-1 min-w-0 text-right"
        >
          <span className="text-base font-medium leading-tight block truncate text-gray-800">
            {item.name}
          </span>
          {adderName && (
            <span className="text-[11px] text-gray-300 block truncate">{adderName}</span>
          )}
        </button>

        {/* Inline qty +/- (hidden in select mode and for viewer) */}
        {!selectMode && (readOnly ? (
          <span className="text-sm font-bold text-gray-400 flex-shrink-0">×{item.quantity}</span>
        ) : (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onQtyChange(item.id, Math.max(1, item.quantity - 1)) }}
              className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center
                         text-gray-400 hover:text-primary-600 active:bg-gray-200 transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-7 text-center text-sm font-bold text-gray-700 select-none">
              {item.quantity}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onQtyChange(item.id, item.quantity + 1) }}
              className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center
                         text-gray-400 hover:text-primary-600 active:bg-gray-200 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Delete (hidden in select mode and for viewer) */}
        {!selectMode && !readOnly && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(item.id) }}
            className="p-1.5 text-gray-200 hover:text-red-400 active:text-red-500 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Note line below */}
      {item.note && (
        <p className="text-xs text-gray-400 mt-1.5 pr-1 truncate">
          📝 {item.note}
        </p>
      )}
    </div>
  )
}

// ── ListPage ────────────────────────────────────────────────────────────────

export default function ListPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [list, setList]           = useState<ShoppingList | null>(null)
  const [items, setItems]         = useState<ListItemWithUser[]>([])
  const [newName, setNewName]     = useState('')
  const [newQty, setNewQty]       = useState(1)
  const [loading, setLoading]     = useState(true)
  const [creatingList, setCreatingList] = useState(false)
  const [allSuggestions, setAllSuggestions] = useState<string[]>([])
  const [dupError, setDupError]   = useState<string | null>(null)
  const [pendingImage, setPendingImage] = useState<File | null>(null)

  // Edit & lightbox
  const [editingItem, setEditingItem]     = useState<ListItemWithUser | null>(null)
  const [lightboxSrc, setLightboxSrc]     = useState<string | null>(null)

  // Multi-select (admin only)
  const [selectMode, setSelectMode]   = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const inputRef       = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const addingRef      = useRef(false)
  const [showImageMenu, setShowImageMenu] = useState(false)
  const [showPushBanner, setShowPushBanner] = useState(false)

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
    // Show push banner only if permission not yet decided and not dismissed
    if (
      'Notification' in window &&
      Notification.permission === 'default' &&
      localStorage.getItem('pushBannerDismissed') !== 'true'
    ) {
      setShowPushBanner(true)
    }
  }, [profile?.family_id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEnablePush() {
    if (!profile?.family_id) return
    setShowPushBanner(false)
    const ok = await registerPushSubscription(profile.id, profile.family_id)
    if (ok) localStorage.setItem('pushBannerDismissed', 'true')
  }

  function handleDismissPush() {
    setShowPushBanner(false)
    localStorage.setItem('pushBannerDismissed', 'true')
  }

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
            setItems(prev => {
              if (prev.some(i => i.id === payload.new.id)) return prev
              return [...prev, { ...payload.new, added_by_user: null } as ListItemWithUser]
            })
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(i => (i.id === payload.new.id
              ? { ...payload.new, added_by_user: i.added_by_user } as ListItemWithUser
              : i)))
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== payload.old.id))
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [list?.id])

  async function loadSuggestions() {
    if (!profile?.family_id) return
    // Use purchase_items for suggestions (already filtered by family via RLS)
    const { data } = await supabase
      .from('purchase_items')
      .select('name')
      .limit(500)
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
        .select('*, added_by_user:users!added_by(id, full_name)')
        .eq('list_id', data.id)
        .order('sort_order', { ascending: true })
      setItems((itemData as ListItemWithUser[]) ?? [])
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
    inputRef.current?.focus()
  }

  const addItem = useCallback(async () => {
    if (!newName.trim() || !list || addingRef.current || !profile) return

    const trimmedName = newName.trim()

    // Duplicate check
    const exists = items.some(i => i.name.trim().toLowerCase() === trimmedName.toLowerCase())
    if (exists) {
      setDupError('הפריט כבר קיים ברשימה')
      setTimeout(() => setDupError(null), 3000)
      inputRef.current?.focus()
      return
    }

    addingRef.current = true
    setDupError(null)

    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) : 0
    const qty = newQty
    const imageFile = pendingImage

    // Clear inputs immediately — keeps keyboard up
    setNewName('')
    setNewQty(1)
    setPendingImage(null)

    // Upload image if attached
    let imageUrl: string | null = null
    if (imageFile && profile.family_id) {
      imageUrl = await uploadItemImage(imageFile, profile.family_id, list.id)
    }

    const { data } = await supabase.from('list_items').insert({
      list_id:    list.id,
      name:       trimmedName,
      quantity:   qty,
      unit:       'יחידה',
      added_by:   profile.id,
      sort_order: maxOrder + 1,
      image_url:  imageUrl,
    }).select().single()

    if (data) {
      const itemWithUser: ListItemWithUser = {
        ...data,
        added_by_user: { id: profile.id, full_name: profile.full_name },
      }
      setItems(prev => {
        if (prev.some(i => i.id === data.id)) return prev
        return [...prev, itemWithUser]
      })
      setAllSuggestions(prev =>
        prev.includes(trimmedName) ? prev : [...prev, trimmedName]
      )

      // Send push notification to family
      if (profile.family_id) {
        sendPushToFamily(
          profile.family_id,
          'בן עזרי מרקט 🛒',
          `${profile.full_name} הוסיף "${trimmedName}" לרשימה`,
        )
      }
    }

    addingRef.current = false
    inputRef.current?.focus()
  }, [newName, newQty, pendingImage, list, items, profile])

  async function saveItemEdit(id: string, updates: Partial<ListItem>) {
    // Optimistic
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    await supabase.from('list_items').update(updates).eq('id', id)
  }

  async function updateQty(id: string, qty: number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i))
    await supabase.from('list_items').update({ quantity: qty }).eq('id', id)
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('list_items').delete().eq('id', id)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(i => i.id)))
    }
  }

  function cancelSelect() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return
    if (!confirm(`למחוק ${selectedIds.size} פריטים?`)) return
    const ids = [...selectedIds]
    setItems(prev => prev.filter(i => !selectedIds.has(i.id)))
    setSelectMode(false)
    setSelectedIds(new Set())
    await supabase.from('list_items').delete().in('id', ids)
  }

  const itemCount = items.length

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

      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {/* ── Edit modal ── */}
      {editingItem && profile?.family_id && (
        <EditItemModal
          item={editingItem}
          familyId={profile.family_id}
          listId={list.id}
          onSave={saveItemEdit}
          onClose={() => setEditingItem(null)}
          onLightbox={src => { setEditingItem(null); setLightboxSrc(src) }}
        />
      )}

      {/* Push notification banner */}
      {showPushBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">
              אפשר התראות כדי לדעת כשבני המשפחה מוסיפים פריטים
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleEnablePush}
              className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600
                         active:bg-amber-700 px-3 py-1.5 rounded-xl transition-colors"
            >
              אפשר
            </button>
            <button
              onClick={handleDismissPush}
              className="text-xs text-amber-400 hover:text-amber-600 px-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="card-green mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-primary-800 text-lg leading-tight">{list.name}</h2>
            <p className="text-sm text-primary-600 mt-0.5">
              {itemCount > 0 ? `${itemCount} פריטים ברשימה` : 'הרשימה ריקה'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Select button (admin only, when items exist) */}
            {itemCount > 0 && isAdmin(profile!.role) && !selectMode && (
              <button
                onClick={() => setSelectMode(true)}
                className="text-xs font-semibold text-primary-600 px-3 py-1.5 rounded-xl
                           bg-white/70 hover:bg-white transition-colors"
              >
                בחר
              </button>
            )}
            {itemCount > 0 && !selectMode && (
              <div className="text-center">
                <div className="text-3xl font-extrabold text-primary-600 leading-none">{itemCount}</div>
                <div className="text-xs text-primary-400 mt-0.5">פריטים</div>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('/list-history')}
          className="mt-3 flex items-center gap-1.5 text-xs text-primary-500 hover:text-primary-700
                     font-medium transition-colors"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          היסטוריית רשימות
        </button>
      </div>

      {/* Empty state */}
      {itemCount === 0 && (
        <div className="text-center py-10 text-gray-400">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-sm">הרשימה ריקה — הוסף פריט למטה</p>
        </div>
      )}

      {/* Select mode toolbar (admin only) */}
      {selectMode && isAdmin(profile!.role) && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={selectAll}
            className="text-xs font-semibold text-primary-600 px-3 py-1.5 rounded-xl
                       bg-primary-50 hover:bg-primary-100 transition-colors"
          >
            {selectedIds.size === itemCount ? 'בטל הכל' : 'בחר הכל'}
          </button>
          <span className="text-xs text-gray-400">{selectedIds.size}/{itemCount}</span>
          <div className="flex-1" />
          <button
            onClick={cancelSelect}
            className="text-xs font-medium text-gray-500 px-3 py-1.5 rounded-xl
                       hover:bg-gray-100 transition-colors"
          >
            <X className="w-3.5 h-3.5 inline ml-1" />
            ביטול
          </button>
        </div>
      )}

      {/* Items */}
      {itemCount > 0 && (
        <div className="space-y-2 mb-4">
          {items.map(item => (
            <ItemRow
              key={item.id} item={item}
              currentUserId={profile!.id}
              readOnly={!canEdit(profile!.role)}
              selectMode={selectMode}
              selected={selectedIds.has(item.id)}
              onQtyChange={updateQty} onDelete={deleteItem}
              onEdit={setEditingItem} onLightbox={setLightboxSrc}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Bulk delete bar (select mode, admin only) */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-[64px] inset-x-0 bg-red-500 px-4 py-3 z-30">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={deleteSelected}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                         bg-white text-red-600 font-bold text-sm active:scale-95 transition-transform"
            >
              <Trash2 className="w-4 h-4" />
              מחק {selectedIds.size} פריטים
            </button>
          </div>
        </div>
      )}

      {/* ── Autocomplete suggestions (above input bar) ── */}
      {canEdit(profile!.role) && suggestions.length > 0 && (
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

      {/* ── Hidden file inputs + add bar (editors only) ── */}
      {canEdit(profile!.role) && (<>
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) setPendingImage(file)
          e.target.value = ''
          inputRef.current?.focus()
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) setPendingImage(file)
          e.target.value = ''
          inputRef.current?.focus()
        }}
      />

      {/* ── Add-item bar (sticky above bottom nav) ── */}
      <div className="fixed bottom-[64px] inset-x-0 bg-white/95 backdrop-blur border-t border-gray-100 shadow-lg px-4 py-3 z-20">
        <div className="max-w-2xl mx-auto space-y-2">

          {/* Duplicate error */}
          {dupError && (
            <p className="text-xs text-red-500 font-medium text-center">{dupError}</p>
          )}

          {/* Pending image preview */}
          {pendingImage && (
            <div className="flex items-center gap-2">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                <img
                  src={URL.createObjectURL(pendingImage)}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setPendingImage(null)}
                  className="absolute -top-0.5 -right-0.5 bg-black/60 rounded-full p-0.5"
                >
                  <Plus className="w-3 h-3 text-white rotate-45" />
                </button>
              </div>
              <span className="text-xs text-gray-400 truncate">{pendingImage.name}</span>
            </div>
          )}

          {/* Row: Name | Qty | Camera | Add */}
          <div className="flex gap-2 items-center">
            {/* Name — first (rightmost in RTL) */}
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={e => { setNewName(e.target.value); setDupError(null) }}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              className="input flex-1"
              placeholder="הוסף מוצר..."
              autoComplete="off"
            />

            {/* Qty controls */}
            <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 flex-shrink-0">
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => setNewQty(q => Math.max(1, q - 1))}
                className="w-8 h-10 flex items-center justify-center text-gray-400
                           hover:text-primary-600 active:bg-gray-100 transition-colors rounded-r-xl"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-bold text-gray-700 select-none">
                {newQty}
              </span>
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => setNewQty(q => q + 1)}
                className="w-8 h-10 flex items-center justify-center text-gray-400
                           hover:text-primary-600 active:bg-gray-100 transition-colors rounded-l-xl"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Camera/gallery button with menu */}
            <div className="relative flex-shrink-0">
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => setShowImageMenu(v => !v)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                  pendingImage
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-gray-50 text-gray-400 hover:text-primary-500 hover:bg-primary-50'
                }`}
              >
                <Camera className="w-5 h-5" />
              </button>
              {showImageMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowImageMenu(false)} />
                  <div className="absolute bottom-12 left-0 z-40 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-44">
                    <button
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setShowImageMenu(false); cameraInputRef.current?.click() }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 font-medium
                                 hover:bg-primary-50 active:bg-primary-100 transition-colors"
                    >
                      <span>📷</span>
                      <span>צלם תמונה</span>
                    </button>
                    <div className="border-t border-gray-50" />
                    <button
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setShowImageMenu(false); galleryInputRef.current?.click() }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 font-medium
                                 hover:bg-primary-50 active:bg-primary-100 transition-colors"
                    >
                      <span>🖼️</span>
                      <span>בחר מהגלריה</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Add button */}
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={addItem}
              disabled={!newName.trim()}
              className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 disabled:opacity-40
                         text-white rounded-xl w-12 h-12 flex items-center justify-center flex-shrink-0
                         transition-colors shadow-sm"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
      </>)}
    </div>
  )
}
