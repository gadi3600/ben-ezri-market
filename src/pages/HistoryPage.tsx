import { useState, useEffect } from 'react'
import { Clock, Receipt, Plus, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ReceiptModal from '../components/ReceiptModal'

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

// ── Receipt Lightbox ──────────────────────────────────────────────────────────

function ReceiptLightbox({
  receipts,
  onClose,
  onDelete,
}: {
  receipts: LightboxReceipt[]
  onClose: () => void
  onDelete: (id: string) => Promise<void>
}) {
  const [idx, setIdx]       = useState(0)
  const [deleting, setDeleting] = useState(false)

  // Clamp idx when receipts shrink after a delete
  useEffect(() => {
    if (receipts.length > 0 && idx >= receipts.length) {
      setIdx(receipts.length - 1)
    }
  }, [receipts.length, idx])

  const safeIdx = Math.min(idx, Math.max(0, receipts.length - 1))
  const current = receipts[safeIdx]
  if (!current) return null

  async function handleDelete() {
    setDeleting(true)
    await onDelete(current.id)
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col select-none">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 text-white">
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          {receipts.length > 1 && (
            <span className="text-sm font-semibold">{safeIdx + 1} / {receipts.length}</span>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 rounded-xl hover:bg-red-500/20 text-red-400
                       hover:text-red-300 disabled:opacity-40 transition-colors"
            title="מחק תמונה זו"
          >
            {deleting
              ? <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              : <Trash2 className="w-5 h-5" />
            }
          </button>
        </div>
      </div>

      {/* Image — min-h-0 allows flex-1 to actually shrink so max-h-full works */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        <img
          src={current.signedUrl}
          alt={`עמוד ${current.page_number}`}
          className="max-w-full max-h-full object-contain rounded-xl"
        />
      </div>

      {/* Navigation dots + arrows */}
      {receipts.length > 1 && (
        <div className="flex-shrink-0 flex justify-center items-center gap-4 pb-8">
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={safeIdx === 0}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20
                       disabled:opacity-30 text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            {receipts.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`rounded-full transition-all ${
                  i === safeIdx
                    ? 'w-3 h-3 bg-white'
                    : 'w-2 h-2 bg-white/35 hover:bg-white/60'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setIdx(i => Math.min(receipts.length - 1, i + 1))}
            disabled={safeIdx === receipts.length - 1}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20
                       disabled:opacity-30 text-white transition-colors"
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
  const [purchases, setPurchases]             = useState<PurchaseRow[]>([])
  const [loading, setLoading]                 = useState(true)
  const [addReceiptFor, setAddReceiptFor]     = useState<PurchaseRow | null>(null)
  const [lightboxReceipts, setLightboxReceipts] = useState<LightboxReceipt[] | null>(null)
  const [loadingReceipts, setLoadingReceipts] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.family_id) return
    loadHistory()
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

  async function handleDeleteReceipt(receiptId: string) {
    const receipt = lightboxReceipts?.find(r => r.id === receiptId)
    if (!receipt) return

    await supabase.storage.from('receipts').remove([receipt.storage_path])
    await supabase.from('purchase_receipts').delete().eq('id', receiptId)

    // Optimistic update in purchases list
    setPurchases(prev =>
      prev.map(p => ({
        ...p,
        purchase_receipts: p.purchase_receipts.filter(r => r.id !== receiptId),
      })),
    )

    const remaining = (lightboxReceipts ?? []).filter(r => r.id !== receiptId)
    if (remaining.length === 0) {
      setLightboxReceipts(null)
    } else {
      setLightboxReceipts(remaining)
    }
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

  // ── Loading ──
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Empty ──
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
          onDelete={handleDeleteReceipt}
        />
      )}

      {addReceiptFor && (
        <ReceiptModal
          purchaseId={addReceiptFor.id}
          storeName={addReceiptFor.stores?.name}
          celebrationMode={false}
          onClose={() => {
            setAddReceiptFor(null)
            loadHistory()
          }}
        />
      )}

      <div className="space-y-3 pb-6">
        <div className="card-green flex items-center gap-3">
          <Clock className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <div>
            <h2 className="font-bold text-primary-800">היסטוריית קניות</h2>
            <p className="text-sm text-primary-600">{purchases.length} קניות</p>
          </div>
        </div>

        {purchases.map(purchase => {
          const v             = storeVisual(purchase.stores?.name ?? null)
          const receipts      = purchase.purchase_receipts ?? []
          const amount        = formatAmount(purchase.total_amount)
          const isLoading     = loadingReceipts === purchase.id

          return (
            <div key={purchase.id} className="card">
              {/* Store + amount */}
              <div className="flex items-center justify-between mb-2">
                <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl ${v.bg}`}>
                  <span className="text-base">{v.emoji}</span>
                  <span className={`text-sm font-bold ${v.text}`}>
                    {purchase.stores?.name ?? 'ללא חנות'}
                  </span>
                </div>
                {amount && (
                  <span className="text-lg font-extrabold text-gray-800">{amount}</span>
                )}
              </div>

              {/* Date */}
              <p className="text-xs text-gray-400 mb-3">{formatDate(purchase.purchased_at)}</p>

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
            </div>
          )
        })}
      </div>
    </>
  )
}
