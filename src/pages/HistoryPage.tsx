import { useState, useEffect } from 'react'
import { Clock, Receipt, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ReceiptModal from '../components/ReceiptModal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReceiptRow {
  id: string
  storage_path: string
  page_number: number
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
  urls,
  onClose,
}: {
  urls: string[]
  onClose: () => void
}) {
  const [idx, setIdx] = useState(0)

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        {urls.length > 1 && (
          <span className="text-sm font-semibold">
            {idx + 1} / {urls.length}
          </span>
        )}
        <div className="w-9" />
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center px-4 pb-4 overflow-hidden">
        <img
          src={urls[idx]}
          alt={`עמוד ${idx + 1}`}
          className="max-w-full max-h-full object-contain rounded-xl"
        />
      </div>

      {/* Pagination */}
      {urls.length > 1 && (
        <div className="flex justify-center items-center gap-4 pb-6">
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20
                       disabled:opacity-30 text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === idx ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setIdx(i => Math.min(urls.length - 1, i + 1))}
            disabled={idx === urls.length - 1}
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
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [loading, setLoading]     = useState(true)

  const [addReceiptFor, setAddReceiptFor]     = useState<PurchaseRow | null>(null)
  const [lightboxUrls, setLightboxUrls]       = useState<string[] | null>(null)
  const [loadingReceipts, setLoadingReceipts] = useState<string | null>(null) // purchaseId

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

    const urls = (data ?? []).map(d => d.signedUrl).filter(Boolean)
    setLoadingReceipts(null)
    if (urls.length > 0) setLightboxUrls(urls)
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
      {/* Receipt lightbox */}
      {lightboxUrls && (
        <ReceiptLightbox
          urls={lightboxUrls}
          onClose={() => setLightboxUrls(null)}
        />
      )}

      {/* Add/edit receipt modal */}
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
        {/* Header */}
        <div className="card-green flex items-center gap-3">
          <Clock className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <div>
            <h2 className="font-bold text-primary-800">היסטוריית קניות</h2>
            <p className="text-sm text-primary-600">{purchases.length} קניות</p>
          </div>
        </div>

        {purchases.map(purchase => {
          const v        = storeVisual(purchase.stores?.name ?? null)
          const receipts = purchase.purchase_receipts ?? []
          const amount   = formatAmount(purchase.total_amount)
          const isLoadingThis = loadingReceipts === purchase.id

          return (
            <div key={purchase.id} className="card">
              {/* Store + amount row */}
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

              {/* Receipt button(s) */}
              {receipts.length > 0 ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => openLightbox(receipts, purchase.id)}
                    disabled={isLoadingThis}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1
                               bg-primary-50 text-primary-700 text-sm font-semibold
                               hover:bg-primary-100 active:bg-primary-200
                               transition-colors disabled:opacity-60"
                  >
                    {isLoadingThis ? (
                      <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Receipt className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="flex-1">צפה בחשבונית</span>
                    <span className="bg-primary-200 text-primary-800 text-xs font-extrabold
                                     rounded-full px-2 py-0.5 min-w-[22px] text-center">
                      {receipts.length}
                    </span>
                  </button>

                  {/* Add more pages */}
                  <button
                    onClick={() => setAddReceiptFor(purchase)}
                    title="הוסף תמונות נוספות"
                    className="p-2.5 rounded-xl bg-gray-50 text-gray-400
                               hover:bg-primary-50 hover:text-primary-500
                               transition-colors"
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
