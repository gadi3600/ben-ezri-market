import { useState, useEffect } from 'react'
import {
  Clock, Receipt, Plus, ChevronLeft, ChevronRight,
  X, Trash2, CheckCircle2, Pencil, BarChart3, ChevronDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { isAdmin } from '../lib/permissions'
import ReceiptModal from '../components/ReceiptModal'
import PurchaseAnalysis from '../components/PurchaseAnalysis'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReceiptRow {
  id: string
  storage_path: string
  page_number: number
}

interface LightboxReceipt extends ReceiptRow {
  signedUrl: string
}

interface PurchaseRow {
  id: string
  family_id: string
  store_id: string | null
  list_id: string | null
  total_amount: number | null
  purchased_by: string | null
  purchased_at: string
  created_at: string
  stores: { name: string } | null
  purchase_receipts: ReceiptRow[]
}

interface StoreOption { id: string; name: string }

// ── Store visuals ─────────────────────────────────────────────────────────────

const STORE_VISUALS: Record<string, { emoji: string; bg: string; text: string }> = {
  'רמי לוי':       { emoji: '🛒', bg: 'bg-blue-50',    text: 'text-blue-700'    },
  'מעיין 2000':    { emoji: '🧺', bg: 'bg-orange-50',  text: 'text-orange-700'  },
  'סופר ספיר':     { emoji: '💎', bg: 'bg-primary-50', text: 'text-primary-700' },
  'אינגליש קייק':  { emoji: '🎂', bg: 'bg-purple-50',  text: 'text-purple-700'  },
}

function storeVisual(name: string | null) {
  if (!name) return { emoji: '🛍️', bg: 'bg-gray-50', text: 'text-gray-600' }
  return STORE_VISUALS[name] ?? { emoji: '🏪', bg: 'bg-gray-50', text: 'text-gray-600' }
}

// ── ReceiptLightbox — gallery + fullscreen ────────────────────────────────────

function ReceiptLightbox({
  receipts,
  onClose,
  onDelete,
}: {
  receipts: LightboxReceipt[]
  onClose: () => void
  onDelete: (ids: string[]) => Promise<void>
}) {
  const [mode, setMode]               = useState<'gallery' | 'fullscreen'>('gallery')
  const [fsIdx, setFsIdx]             = useState(0)
  const [selectMode, setSelectMode]   = useState(false)
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [deleting, setDeleting]       = useState(false)

  // Keep fsIdx in bounds after deletions
  useEffect(() => {
    if (receipts.length > 0 && fsIdx >= receipts.length) setFsIdx(receipts.length - 1)
  }, [receipts.length, fsIdx])

  const safeIdx = Math.min(fsIdx, Math.max(0, receipts.length - 1))
  const current = receipts[safeIdx]
  if (!current) return null

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function doDelete(ids: string[]) {
    setDeleting(true)
    await onDelete(ids)
    setSelected(new Set())
    setDeleting(false)
  }

  // ── Gallery ──────────────────────────────────────────────────────────────
  if (mode === 'gallery') {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
        {/* Top bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 text-white">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold">{receipts.length} תמונות</span>
          <button
            onClick={() => { setSelectMode(s => !s); setSelected(new Set()) }}
            className={`text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors ${
              selectMode ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {selectMode ? 'ביטול' : 'בחר'}
          </button>
        </div>

        {/* Thumbnails grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <div className="grid grid-cols-3 gap-2">
            {receipts.map((r, i) => {
              const isSel = selected.has(r.id)
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    if (selectMode) {
                      toggleSelect(r.id)
                    } else {
                      setFsIdx(i)
                      setMode('fullscreen')
                    }
                  }}
                  className="relative aspect-square rounded-xl overflow-hidden bg-white/10 active:scale-95 transition-transform"
                >
                  <img
                    src={r.signedUrl}
                    alt={`עמוד ${r.page_number}`}
                    className="w-full h-full object-cover"
                  />
                  {selectMode && (
                    <div className={`absolute inset-0 rounded-xl transition-all ${
                      isSel ? 'bg-primary-500/30 ring-2 ring-inset ring-primary-400' : 'bg-black/20'
                    }`}>
                      <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSel ? 'bg-primary-500 border-primary-500' : 'bg-black/40 border-white/60'
                      }`}>
                        {isSel && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Bulk delete bar */}
        {selectMode && selected.size > 0 && (
          <div className="flex-shrink-0 p-4 bg-black/40">
            <button
              onClick={() => doDelete([...selected])}
              disabled={deleting}
              className="w-full py-3 rounded-2xl bg-red-500 hover:bg-red-600
                         text-white font-bold text-sm flex items-center justify-center gap-2
                         disabled:opacity-60 transition-colors"
            >
              {deleting
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Trash2 className="w-4 h-4" />
              }
              מחק {selected.size} {selected.size === 1 ? 'תמונה' : 'תמונות'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Fullscreen ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col select-none">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 text-white">
        <button
          onClick={() => setMode('gallery')}
          className="flex items-center gap-1 px-2 py-2 rounded-xl hover:bg-white/10 text-sm transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
          <span>גלריה</span>
        </button>
        {receipts.length > 1 && (
          <span className="text-sm font-semibold">{safeIdx + 1} / {receipts.length}</span>
        )}
        <button
          onClick={() => doDelete([current.id])}
          disabled={deleting}
          className="p-2 rounded-xl hover:bg-red-500/20 text-red-400
                     hover:text-red-300 disabled:opacity-40 transition-colors"
        >
          {deleting
            ? <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            : <Trash2 className="w-5 h-5" />
          }
        </button>
      </div>

      {/* Image — key forces re-render on receipt change (fixes stale display) */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        <img
          key={current.id}
          src={current.signedUrl}
          alt={`עמוד ${current.page_number}`}
          className="max-w-full max-h-full object-contain rounded-xl"
        />
      </div>

      {/* Navigation */}
      {receipts.length > 1 && (
        <div className="flex-shrink-0 flex justify-center items-center gap-4 pb-8">
          <button
            onClick={() => setFsIdx(i => Math.max(0, i - 1))}
            disabled={safeIdx === 0}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {receipts.map((_, i) => (
              <button
                key={i}
                onClick={() => setFsIdx(i)}
                className={`rounded-full transition-all ${
                  i === safeIdx ? 'w-3 h-3 bg-white' : 'w-2 h-2 bg-white/35 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => setFsIdx(i => Math.min(receipts.length - 1, i + 1))}
            disabled={safeIdx === receipts.length - 1}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── HistoryPage ───────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { profile } = useAuth()
  const [purchases, setPurchases]               = useState<PurchaseRow[]>([])
  const [loading, setLoading]                   = useState(true)
  const [addReceiptFor, setAddReceiptFor]       = useState<PurchaseRow | null>(null)
  const [lightboxReceipts, setLightboxReceipts] = useState<LightboxReceipt[] | null>(null)
  const [loadingReceipts, setLoadingReceipts]   = useState<string | null>(null)
  const [analysisFor, setAnalysisFor]           = useState<PurchaseRow | null>(null)

  // Amount editing
  const [editingAmount, setEditingAmount] = useState<string | null>(null)
  const [editAmount, setEditAmount]       = useState('')

  // Store picker
  const [storePickerFor, setStorePickerFor] = useState<PurchaseRow | null>(null)
  const [stores, setStores]                 = useState<StoreOption[]>([])

  useEffect(() => {
    if (!profile?.family_id) return
    loadHistory()
    loadStores()
  }, [profile?.family_id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadHistory() {
    setLoading(true)
    const { data } = await supabase
      .from('purchases')
      .select('*, stores(name), purchase_receipts(id, storage_path, page_number)')
      .eq('family_id', profile!.family_id)
      .order('purchased_at', { ascending: false })
      .limit(30)
    setPurchases((data as PurchaseRow[]) ?? [])
    setLoading(false)
  }

  async function openLightbox(receipts: ReceiptRow[], purchaseId: string) {
    setLoadingReceipts(purchaseId)
    const sorted = [...receipts].sort((a, b) => a.page_number - b.page_number)
    const { data } = await supabase.storage
      .from('receipts')
      .createSignedUrls(sorted.map(r => r.storage_path), 3600)

    const items: LightboxReceipt[] = sorted
      .map((r, i) => ({ ...r, signedUrl: data?.[i]?.signedUrl ?? '' }))
      .filter(r => r.signedUrl)

    setLoadingReceipts(null)
    if (items.length > 0) setLightboxReceipts(items)
  }

  async function handleDeleteReceipts(ids: string[]) {
    const toDelete = (lightboxReceipts ?? []).filter(r => ids.includes(r.id))

    // Delete from Storage (all in parallel, ignore individual failures)
    await Promise.allSettled(
      toDelete.map(r => supabase.storage.from('receipts').remove([r.storage_path])),
    )
    // Delete from DB
    await supabase.from('purchase_receipts').delete().in('id', ids)

    // Optimistic update in purchase list
    setPurchases(prev =>
      prev.map(p => ({
        ...p,
        purchase_receipts: p.purchase_receipts.filter(r => !ids.includes(r.id)),
      })),
    )

    const remaining = (lightboxReceipts ?? []).filter(r => !ids.includes(r.id))
    if (remaining.length === 0) {
      setLightboxReceipts(null)
    } else {
      setLightboxReceipts(remaining)
    }
  }

  async function loadStores() {
    const { data } = await supabase
      .from('stores').select('id, name').eq('is_active', true).eq('family_id', profile!.family_id).order('name')
    if (data) setStores(data as StoreOption[])
  }

  async function updateStore(purchaseId: string, storeId: string, storeName: string) {
    setStorePickerFor(null)
    setPurchases(prev => prev.map(p =>
      p.id === purchaseId ? { ...p, store_id: storeId, stores: { name: storeName } } : p,
    ))
    await supabase.from('purchases').update({ store_id: storeId }).eq('id', purchaseId)
  }

  async function saveAmount(purchaseId: string) {
    const amount = parseFloat(editAmount)
    const value  = !isNaN(amount) && amount > 0 ? amount : null
    await supabase.from('purchases').update({ total_amount: value }).eq('id', purchaseId)
    setPurchases(prev =>
      prev.map(p => p.id === purchaseId ? { ...p, total_amount: value } : p),
    )
    setEditingAmount(null)
  }

  async function deletePurchase(purchase: PurchaseRow) {
    if (!confirm('האם למחוק את הקנייה? פעולה זו תמחק גם את החשבוניות')) return

    // Optimistic removal
    setPurchases(prev => prev.filter(p => p.id !== purchase.id))

    // Delete receipt files from Storage
    const receipts = purchase.purchase_receipts ?? []
    if (receipts.length > 0) {
      await Promise.allSettled(
        receipts.map(r => supabase.storage.from('receipts').remove([r.storage_path])),
      )
    }

    // Delete DB records (cascade handles purchase_items and purchase_receipts)
    await supabase.from('purchase_receipts').delete().eq('purchase_id', purchase.id)
    await supabase.from('purchase_items').delete().eq('purchase_id', purchase.id)
    await supabase.from('purchases').delete().eq('id', purchase.id)
  }

  function formatDate(iso: string | null) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('he-IL', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  function formatAmount(amount: number | null) {
    if (amount === null) return null
    return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (purchases.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-primary-50 rounded-full p-6 mb-5">
        <Clock className="w-14 h-14 text-primary-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">אין היסטוריה עדיין</h3>
      <p className="text-gray-400 text-sm">קניות שהושלמו יופיעו כאן</p>
    </div>
  )

  return (
    <>
      {lightboxReceipts && (
        <ReceiptLightbox
          receipts={lightboxReceipts}
          onClose={() => setLightboxReceipts(null)}
          onDelete={handleDeleteReceipts}
        />
      )}

      {addReceiptFor && (
        <ReceiptModal
          purchaseId={addReceiptFor.id}
          storeName={addReceiptFor.stores?.name}
          celebrationMode={false}
          onClose={() => { setAddReceiptFor(null); loadHistory() }}
        />
      )}

      {analysisFor && (
        <PurchaseAnalysis
          purchaseId={analysisFor.id}
          storeName={analysisFor.stores?.name ?? null}
          purchasedAt={analysisFor.purchased_at}
          totalAmount={analysisFor.total_amount}
          onClose={() => setAnalysisFor(null)}
        />
      )}

      {/* ── Store picker bottom sheet ── */}
      {storePickerFor && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setStorePickerFor(null)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[60vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-5 pb-2 flex-shrink-0">
              <h3 className="text-lg font-extrabold text-gray-800">בחר חנות</h3>
            </div>
            <div className="overflow-y-auto px-5 pb-8">
              {stores.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">
                  אין חנויות — הוסף ב"הגדרות"
                </p>
              ) : (
                <div className="space-y-1 pt-2">
                  {stores.map(s => {
                    const sv = storeVisual(s.name)
                    return (
                      <button
                        key={s.id}
                        onClick={() => updateStore(storePickerFor.id, s.id, s.name)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-colors ${
                          storePickerFor.store_id === s.id
                            ? 'bg-primary-100 text-primary-700 font-bold'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="text-xl">{sv.emoji}</span>
                        <span className="flex-1 text-right">{s.name}</span>
                        {storePickerFor.store_id === s.id && (
                          <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 pb-32">
        <div className="card-green flex items-center gap-3">
          <Clock className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <div>
            <h2 className="font-bold text-primary-800">היסטוריית קניות</h2>
            <p className="text-sm text-primary-600">{purchases.length} קניות</p>
          </div>
        </div>

        {purchases.map(purchase => {
          const v         = storeVisual(purchase.stores?.name ?? null)
          const receipts  = purchase.purchase_receipts ?? []
          const amount    = formatAmount(purchase.total_amount)
          const isLoading = loadingReceipts === purchase.id
          const isEditing = editingAmount === purchase.id

          return (
            <div key={purchase.id} className="card">
              {/* Store + amount row */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setStorePickerFor(purchase)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl ${v.bg} active:opacity-70 transition-opacity`}
                >
                  <span className="text-base">{v.emoji}</span>
                  <span className={`text-sm font-bold ${v.text}`}>
                    {purchase.stores?.name ?? 'ללא חנות'}
                  </span>
                  <ChevronDown className={`w-3 h-3 ${v.text} opacity-60`} />
                </button>

                {/* Amount + edit */}
                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  saveAmount(purchase.id)
                            if (e.key === 'Escape') setEditingAmount(null)
                          }}
                          className="w-24 text-sm font-bold text-center rounded-xl
                                     border border-gray-200 bg-gray-50 px-2 py-1.5 pl-5
                                     focus:outline-none focus:ring-2 focus:ring-primary-300"
                          autoFocus
                        />
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₪</span>
                      </div>
                      <button
                        onClick={() => saveAmount(purchase.id)}
                        className="text-primary-500 hover:text-primary-700 transition-colors"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setEditingAmount(null)}
                        className="text-gray-300 hover:text-gray-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      {amount && (
                        <span className="text-lg font-extrabold text-gray-800">{amount}</span>
                      )}
                      <button
                        onClick={() => {
                          setEditAmount(purchase.total_amount != null ? String(purchase.total_amount) : '')
                          setEditingAmount(purchase.id)
                        }}
                        className="p-1 rounded-lg text-gray-300 hover:text-primary-500
                                   hover:bg-primary-50 transition-colors"
                        title="ערוך סכום"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Date + delete (admin only) */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400">{formatDate(purchase.purchased_at)}</p>
                {isAdmin(profile!.role) && (
                  <button
                    onClick={() => deletePurchase(purchase)}
                    className="p-1.5 rounded-lg text-gray-200 hover:text-red-500
                               hover:bg-red-50 transition-colors"
                    title="מחק קנייה"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Receipt buttons */}
              {receipts.length > 0 ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => openLightbox(receipts, purchase.id)}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1
                               bg-primary-50 text-primary-700 text-sm font-semibold
                               hover:bg-primary-100 active:bg-primary-200
                               transition-colors disabled:opacity-60"
                  >
                    {isLoading
                      ? <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                      : <Receipt className="w-4 h-4 flex-shrink-0" />
                    }
                    <span className="flex-1">צפה בחשבונית</span>
                    <span className="bg-primary-200 text-primary-800 text-xs font-extrabold
                                     rounded-full px-2 py-0.5 min-w-[22px] text-center">
                      {receipts.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setAddReceiptFor(purchase)}
                    title="הוסף תמונות נוספות"
                    className="p-2.5 rounded-xl bg-gray-50 text-gray-400
                               hover:bg-primary-50 hover:text-primary-500 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddReceiptFor(purchase)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl w-full
                             border-2 border-dashed border-gray-200 text-gray-400
                             hover:border-primary-300 hover:text-primary-500
                             text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4 flex-shrink-0" />
                  <span>הוסף חשבונית</span>
                </button>
              )}

              {/* Analysis button */}
              <button
                onClick={() => setAnalysisFor(purchase)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-0.5
                           text-xs text-gray-400 hover:text-primary-500
                           hover:bg-primary-50 rounded-xl transition-colors font-medium"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                תחקיר קנייה
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
