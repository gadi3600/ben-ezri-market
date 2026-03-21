import { useState, useRef } from 'react'
import { Camera, DollarSign, X, Upload, CheckCircle2, Loader2, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
const SUPPORTED: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
function toSupportedMediaType(type: string): SupportedMediaType {
  return (SUPPORTED.includes(type as SupportedMediaType) ? type : 'image/jpeg') as SupportedMediaType
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'choose' | 'manual' | 'uploading' | 'analyzing' | 'result'

interface AnalysisResult {
  total: number | null
  store: string | null
  date: string | null
  items_count: number | null
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
  const [step, setStep]                   = useState<Step>('choose')
  const [files, setFiles]                 = useState<File[]>([])
  const [manualAmount, setManualAmount]   = useState('')
  const [analysis, setAnalysis]           = useState<AnalysisResult | null>(null)
  const [confirmedAmount, setConfirmedAmount] = useState('')
  const [error, setError]                 = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(fl: FileList | null) {
    if (!fl) return
    setFiles(prev => [...prev, ...Array.from(fl)])
  }

  async function handleUpload() {
    if (!files.length || !profile?.family_id) return
    setStep('uploading')
    setError(null)

    try {
      // Convert files to base64 while we still have the File objects
      const base64List = await Promise.all(files.map(fileToBase64))

      // Upload to Supabase Storage + save receipt records
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${profile.family_id}/${purchaseId}/${Date.now()}_${i + 1}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(path, file, { upsert: true })
        if (uploadErr) throw uploadErr

        await supabase.from('purchase_receipts').insert({
          purchase_id: purchaseId,
          storage_path: path,
          page_number: i + 1,
          uploaded_by: profile.id,
        })
      }

      setStep('analyzing')

      // Call Anthropic API directly from the browser with base64 images
      const imageContent = files.map((file, i) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: toSupportedMediaType(file.type),
          data: base64List[i],
        },
      }))

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: [
                ...imageContent,
                {
                  type: 'text',
                  text: 'ניתח את החשבונית. החזר JSON בלבד (ללא markdown, ללא הסבר) בפורמט: {"total": מספר_עשרוני_או_null, "store": "שם_החנות_או_null", "date": "DD/MM/YYYY_או_null", "items_count": מספר_שלם_או_null}',
                },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`Anthropic ${response.status}: ${await response.text()}`)
      }

      const claude = await response.json()
      const text: string = claude.content[0].text
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const result = JSON.parse(match[0]) as AnalysisResult
        setAnalysis(result)
        if (result.total) setConfirmedAmount(String(result.total))
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
        {/* Handle */}
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
              {/* Photo option */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-4 p-4 rounded-2xl
                           bg-primary-50 border-2 border-primary-200
                           hover:bg-primary-100 active:bg-primary-200 transition-colors"
              >
                <div className="bg-primary-500 rounded-xl p-2.5 flex-shrink-0">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <div className="text-right flex-1">
                  <p className="font-bold text-primary-800">צרף חשבונית</p>
                  <p className="text-xs text-primary-500">צלם או בחר מגלריה · אפשר מספר תמונות</p>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => addFiles(e.target.files)}
              />

              {/* Thumbnails + upload button */}
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
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200
                                 flex items-center justify-center text-gray-300 flex-shrink-0
                                 hover:border-primary-300 hover:text-primary-400 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  <button onClick={handleUpload} className="btn-primary w-full">
                    <Upload className="w-4 h-4" />
                    העלה ונתח ({files.length} {files.length === 1 ? 'תמונה' : 'תמונות'})
                  </button>
                </div>
              )}

              {/* Manual option */}
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                  ₪
                </span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('choose')} className="btn-secondary flex-1">
                  חזור
                </button>
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
                <p className="font-bold text-gray-700">מנתח חשבונית עם AI...</p>
                <p className="text-sm text-gray-400 mt-1">זה עשוי לקחת כמה שניות</p>
              </div>
            </div>
          )}

          {/* ── RESULT ── */}
          {step === 'result' && (
            <div className="space-y-4">
              {analysis && (analysis.store || analysis.date || analysis.items_count) ? (
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
                    {analysis.items_count && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-primary-800">
                          {analysis.items_count} פריטים
                        </span>
                        <span className="text-primary-400 text-xs">כמות</span>
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

              {/* Editable total amount */}
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                    ₪
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => onClose()} className="btn-secondary flex-1">
                  דלג
                </button>
                <button
                  onClick={() => saveAndClose(parseFloat(confirmedAmount) || undefined)}
                  className="btn-primary flex-1"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  שמור
                </button>
              </div>

              <p className="text-xs text-center text-gray-400">
                ✓ {files.length} {files.length === 1 ? 'תמונה נשמרה' : 'תמונות נשמרו'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
