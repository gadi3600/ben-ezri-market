import { useState, useRef } from 'react'
import { DollarSign, X, Upload, CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'choose' | 'manual' | 'uploading' | 'analyzing' | 'result'

interface ReceiptItem {
  name: string
  quantity: number
  unit: string
  price_per_unit: number | null
  total_price: number | null
}

interface AnalysisResult {
  total: number | null
  store: string | null
  date: string | null
  items: ReceiptItem[]
}

interface Props {
  purchaseId: string
  storeName?: string
  celebrationMode?: boolean
  onClose: (totalAmount?: number) => void
}

export default function ReceiptModal({
  purchaseId,
  storeName,
  celebrationMode = false,
  onClose,
}: Props) {
  const { profile } = useAuth()
  const [step, setStep]                       = useState<Step>('choose')
  const [files, setFiles]                     = useState<File[]>([])
  const [manualAmount, setManualAmount]       = useState('')
  const [analysis, setAnalysis]               = useState<AnalysisResult | null>(null)
  const [confirmedAmount, setConfirmedAmount] = useState('')
  const [error, setError]                     = useState<string | null>(null)
  const [skippedCount, setSkippedCount]       = useState(0)
  const [savedCount, setSavedCount]           = useState(0)
  const [analyzedCount, setAnalyzedCount]     = useState(0)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  function addFiles(fl: FileList | null) {
    if (!fl) return
    setFiles(prev => [...prev, ...Array.from(fl)])
  }

  async function handleUpload() {
    if (!files.length || !profile?.family_id) return
    setStep('uploading')
    setError(null)

    try {
      // Determine starting page number
      const { data: existingRecords } = await supabase
        .from('purchase_receipts')
        .select('page_number')
        .eq('purchase_id', purchaseId)
        .order('page_number', { ascending: false })
        .limit(1)
      const maxPage = existingRecords?.[0]?.page_number ?? 0

      const paths: string[] = []

      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx]
        const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
        const path = `${profile.family_id}/${purchaseId}/${name}`

        const { error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(path, file, { upsert: false })
        if (uploadErr) throw uploadErr

        await supabase.from('purchase_receipts').insert({
          purchase_id:  purchaseId,
          storage_path: path,
          page_number:  maxPage + paths.length + 1,
          uploaded_by:  profile.id,
        })

        paths.push(path)
      }

      console.log(`📤 Upload complete: ${paths.length} uploaded, ${files.length} total files`)

      setSkippedCount(0)
      setSavedCount(paths.length)

      if (paths.length === 0) {
        setStep('choose')
        return
      }

      setStep('analyzing')

      // Get signed URLs → call Edge Function proxy (avoids CORS)
      const { data: signed } = await supabase.storage
        .from('receipts')
        .createSignedUrls(paths, 300)

      const imageUrls = (signed ?? []).map(s => s.signedUrl).filter(Boolean)
      setAnalyzedCount(imageUrls.length)
      console.log(`🔍 Sending ${imageUrls.length} image URLs to analyze-receipt`)

      if (imageUrls.length > 0) {
        const fnRes = await fetch(
          'https://lbeivhmaesgissghtzzh.supabase.co/functions/v1/analyze-receipt',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ imageUrls, purchaseId }),
          },
        )
        if (fnRes.ok) {
          const result = await fnRes.json() as AnalysisResult
          if (!('error' in result)) {
            setAnalysis(result)
            if (result.total) setConfirmedAmount(String(result.total))
            // Items are saved inside the Edge Function using service role key
          }
        }
      }

      setStep('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהעלאה')
      setStep('choose')
    }
  }

  async function saveAndClose(amount?: number) {
    if (amount && amount > 0) {
      await supabase.from('purchases').update({ total_amount: amount }).eq('id', purchaseId)
    }
    onClose(amount)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={() => onClose()} />

      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-5 mt-2">
            <div>
              <h2 className="text-xl font-extrabold text-gray-800">
                {celebrationMode ? 'הקנייה הושלמה! 🎉' : 'הוסף חשבונית'}
              </h2>
              <p className="text-sm text-gray-400">
                {storeName ? `${storeName} · ` : ''}
                {celebrationMode ? 'הוסף חשבונית לקנייה' : 'תמונה אחת או יותר'}
              </p>
            </div>
            <button
              onClick={() => onClose()}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── CHOOSE ── */}
          {step === 'choose' && (
            <div className="space-y-3">
              {/* Hidden inputs: camera + gallery */}
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
                onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
              <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { addFiles(e.target.files); e.target.value = '' }} />

              {/* Two buttons: camera + gallery */}
              <div className="flex gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl
                             bg-primary-50 border-2 border-primary-200
                             hover:bg-primary-100 active:bg-primary-200 transition-colors"
                >
                  <span className="text-2xl">📷</span>
                  <div className="text-center">
                    <p className="font-bold text-primary-800 text-sm">צלם חשבונית</p>
                    <p className="text-xs text-primary-500">פתח מצלמה</p>
                  </div>
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl
                             bg-gray-50 border-2 border-gray-200
                             hover:bg-gray-100 active:bg-gray-200 transition-colors"
                >
                  <span className="text-2xl">🖼️</span>
                  <div className="text-center">
                    <p className="font-bold text-gray-700 text-sm">בחר מהגלריה</p>
                    <p className="text-xs text-gray-400">תמונה אחת או יותר</p>
                  </div>
                </button>
              </div>

              {files.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {files.map((f, i) => (
                      <div
                        key={i}
                        className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0"
                      >
                        <img
                          src={URL.createObjectURL(f)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {/* Add more button with menu */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        className="w-16 h-[30px] rounded-lg border-2 border-dashed border-gray-200
                                   flex items-center justify-center text-gray-300
                                   hover:border-primary-300 hover:text-primary-400 transition-colors text-xs"
                      >
                        📷
                      </button>
                      <button
                        onClick={() => galleryInputRef.current?.click()}
                        className="w-16 h-[30px] rounded-lg border-2 border-dashed border-gray-200
                                   flex items-center justify-center text-gray-300
                                   hover:border-primary-300 hover:text-primary-400 transition-colors text-xs"
                      >
                        🖼️
                      </button>
                    </div>
                  </div>

                  <button onClick={handleUpload} className="btn-primary w-full">
                    <Upload className="w-4 h-4" />
                    העלה ונתח ({files.length} {files.length === 1 ? 'תמונה' : 'תמונות'})
                  </button>
                </div>
              )}

              <button
                onClick={() => setStep('manual')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl
                           bg-gray-50 border-2 border-gray-100
                           hover:bg-gray-100 transition-colors"
              >
                <div className="bg-gray-400 rounded-xl p-2.5 flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div className="text-right flex-1">
                  <p className="font-bold text-gray-700">הזן סכום ידנית</p>
                  <p className="text-xs text-gray-400">סכום כולל בלבד</p>
                </div>
              </button>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <button
                onClick={() => onClose()}
                className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium"
              >
                סיים ללא חשבונית
              </button>
            </div>
          )}

          {/* ── MANUAL ── */}
          {step === 'manual' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">הזן את הסכום הכולל של הקנייה</p>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={manualAmount}
                  onChange={e => setManualAmount(e.target.value)}
                  onKeyDown={e =>
                    e.key === 'Enter' && saveAndClose(parseFloat(manualAmount) || undefined)
                  }
                  className="input text-2xl font-bold text-center pl-8"
                  placeholder="0.00"
                  autoFocus
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₪</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('choose')} className="btn-secondary flex-1">חזור</button>
                <button
                  onClick={() => saveAndClose(parseFloat(manualAmount) || undefined)}
                  disabled={!manualAmount || isNaN(parseFloat(manualAmount))}
                  className="btn-primary flex-1"
                >
                  אשר
                </button>
              </div>
            </div>
          )}

          {/* ── UPLOADING ── */}
          {step === 'uploading' && (
            <div className="flex flex-col items-center py-10 gap-4">
              <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
              <div className="text-center">
                <p className="font-bold text-gray-700">מעלה תמונות...</p>
                <p className="text-sm text-gray-400 mt-1">
                  {files.length} {files.length === 1 ? 'תמונה' : 'תמונות'}
                </p>
              </div>
            </div>
          )}

          {/* ── ANALYZING ── */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-700">
                  מנתח {analyzedCount} {analyzedCount === 1 ? 'תמונה' : 'תמונות'} עם AI...
                </p>
                <p className="text-sm text-gray-400 mt-1">זה עשוי לקחת כמה שניות</p>
              </div>
            </div>
          )}

          {/* ── RESULT ── */}
          {step === 'result' && (
            <div className="space-y-4">
              {skippedCount > 0 && (
                <p className="text-xs text-amber-600 text-center bg-amber-50 rounded-xl py-2 px-3">
                  {skippedCount} {skippedCount === 1 ? 'תמונה כפולה דולגה' : 'תמונות כפולות דולגו'}
                </p>
              )}

              {analysis && (analysis.store || analysis.date || analysis.items?.length) ? (
                <div className="card-green">
                  <p className="text-xs font-bold text-primary-600 uppercase tracking-wide mb-3">
                    תוצאות AI
                  </p>
                  <div className="space-y-2">
                    {analysis.store && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-primary-800">{analysis.store}</span>
                        <span className="text-primary-400 text-xs">חנות</span>
                      </div>
                    )}
                    {analysis.date && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-primary-800">{analysis.date}</span>
                        <span className="text-primary-400 text-xs">תאריך</span>
                      </div>
                    )}
                    {analysis.items?.length > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-primary-800">{analysis.items.length} פריטים</span>
                        <span className="text-primary-400 text-xs">זוהו ונשמרו</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400">לא ניתן לנתח את החשבונית אוטומטית</p>
                  <p className="text-xs text-gray-300 mt-1">התמונות נשמרו בהצלחה</p>
                </div>
              )}

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">סכום כולל (₪)</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={confirmedAmount}
                    onChange={e => setConfirmedAmount(e.target.value)}
                    className="input text-xl font-bold text-center pl-8"
                    placeholder="0.00"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₪</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => onClose()} className="btn-secondary flex-1">דלג</button>
                <button
                  onClick={() => saveAndClose(parseFloat(confirmedAmount) || undefined)}
                  className="btn-primary flex-1"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  שמור
                </button>
              </div>

              <p className="text-xs text-center text-gray-400">
                ✓ {savedCount} {savedCount === 1 ? 'תמונה נשמרה' : 'תמונות נשמרו'}
                {analyzedCount > 0 && ` · נותחו ${analyzedCount} ${analyzedCount === 1 ? 'תמונה' : 'תמונות'} בהצלחה`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
