import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Plus, Minus, Trash2, ShoppingBag, CheckCircle2, Camera,
  X, MessageSquare, Pencil,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { ShoppingList, ListItem } from '../lib/types'
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
  const fileRef = useRef<HTMLInputElement>(null)

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
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleImageChange(f)
              e.target.value = ''
            }}
          />

          {imageUrl ? (
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => onLightbox(imageUrl!)} className="flex-shrink-0">
                <img src={imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-100" />
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-primary-600 font-medium px-3 py-1.5 rounded-lg
                             bg-primary-50 hover:bg-primary-100 transition-colors"
                >
                  החלף
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
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl w-full mb-5
                         border-2 border-dashed border-gray-200 text-gray-400
                         hover:border-primary-300 hover:text-primary-500 text-sm font-medium transition-colors"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              {uploading ? 'מעלה...' : 'הוסף תמונה'}
            </button>
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
  onToggle,
  onDelete,
  onEdit,
  onLightbox,
}: {
  item: ListItem
  onToggle: (item: ListItem) => void
  onDelete: (id: string) => void
  onEdit: (item: ListItem) => void
  onLightbox: (src: string) => void
}) {
  const hasExtra = !!(item.note || item.image_url)

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

      {/* Thumbnail */}
      {item.image_url && (
        <button onClick={() => onLightbox(item.image_url!)} className="flex-shrink-0">
          <img
            src={item.image_url}
            alt=""
            className="w-10 h-10 rounded-xl object-cover border border-gray-100"
          />
        </button>
      )}

      {/* Name + qty + note indicator — tappable to edit */}
      <button onClick={() => onEdit(item)} className="flex-1 min-w-0 text-right">
        <div className="flex items-center gap-1">
          <span
            className={`text-base font-medium leading-tight block truncate ${
              item.is_checked ? 'line-through text-gray-400' : 'text-gray-800'
            }`}
          >
            {item.name}
          </span>
          {hasExtra && (
            <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {(item.quantity !== 1 || item.unit !== 'יחידה') && (
            <span className="text-xs text-gray-400">
              {item.quantity} {item.unit}
            </span>
          )}
          {item.note && (
            <span className="text-xs text-gray-400 truncate max-w-[120px]">
              📝 {item.note}
            </span>
          )}
        </div>
      </button>

      {/* Edit icon */}
      <button
        onClick={() => onEdit(item)}
        className="p-1.5 text-gray-200 hover:text-primary-400 transition-colors flex-shrink-0"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {/* Delete */}
      <button
        onClick={() => onDelete(item.id)}
        className="p-1.5 text-gray-200 hover:text-red-400 active:text-red-500 transition-colors flex-shrink-0"
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
  const [newQty, setNewQty]       = useState(1)
  const [loading, setLoading]     = useState(true)
  const [creatingList, setCreatingList] = useState(false)
  const [allSuggestions, setAllSuggestions] = useState<string[]>([])
  const [dupError, setDupError]   = useState<string | null>(null)
  const [pendingImage, setPendingImage] = useState<File | null>(null)

  // Edit & lightbox
  const [editingItem, setEditingItem]     = useState<ListItem | null>(null)
  const [lightboxSrc, setLightboxSrc]     = useState<string | null>(null)

  const inputRef     = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addingRef    = useRef(false)

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
            setItems(prev => {
              if (prev.some(i => i.id === payload.new.id)) return prev
              return [...prev, payload.new as ListItem]
            })
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
    const { data } = await supabase.from('list_items').select('name')
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
      setItems(prev => {
        if (prev.some(i => i.id === data.id)) return prev
        return [...prev, data]
      })
      setAllSuggestions(prev =>
        prev.includes(trimmedName) ? prev : [...prev, trimmedName]
      )
    }

    addingRef.current = false
    inputRef.current?.focus()
  }, [newName, newQty, pendingImage, list, items, profile])

  async function saveItemEdit(id: string, updates: Partial<ListItem>) {
    // Optimistic
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    await supabase.from('list_items').update(updates).eq('id', id)
  }

  async function toggleItem(item: ListItem) {
    const now = new Date().toISOString()
    const checked = !item.is_checked
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
            <ItemRow
              key={item.id} item={item}
              onToggle={toggleItem} onDelete={deleteItem}
              onEdit={setEditingItem} onLightbox={setLightboxSrc}
            />
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
              <ItemRow
                key={item.id} item={item}
                onToggle={toggleItem} onDelete={deleteItem}
                onEdit={setEditingItem} onLightbox={setLightboxSrc}
              />
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

      {/* ── Hidden file input for camera/gallery ── */}
      <input
        ref={fileInputRef}
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

            {/* Camera button */}
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={`w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors ${
                pendingImage
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-gray-50 text-gray-400 hover:text-primary-500 hover:bg-primary-50'
              }`}
            >
              <Camera className="w-5 h-5" />
            </button>

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
    </div>
  )
}
