import { useState, useEffect, useRef } from 'react'
import {
  X, ChevronUp, ChevronDown, ArrowUpDown,
  Send, Loader2, BarChart3,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type SortCol = 'name' | 'quantity' | 'price_per_unit' | 'total_price'
type SortDir = 'asc' | 'desc'

interface PurchaseItem {
  id: string
  name: string
  quantity: number
  unit: string
  price_per_unit: number | null
  total_price: number | null
  products: { barcode: string | null } | null
}

interface ChatMsg { role: 'user' | 'ai'; text: string }

interface Props {
  purchaseId: string
  storeName: string | null
  purchasedAt: string
  totalAmount: number | null
  onClose: () => void
}

// ── Category ──────────────────────────────────────────────────────────────────

interface Category {
  id: string
  label: string
  emoji: string
  color: string
}

const CAT: Record<string, Category> = {
  frozen:     { id: 'frozen',     label: 'קפוא ומוכן',        emoji: '🧊', color: '#67e8f9' },
  meat:       { id: 'meat',       label: 'בשר ודגים',         emoji: '🥩', color: '#ef4444' },
  produce:    { id: 'produce',    label: 'ירקות ופירות',      emoji: '🥦', color: '#22c55e' },
  dairy:      { id: 'dairy',      label: 'מקרר, חלב וביצים',  emoji: '🥛', color: '#3b82f6' },
  cleaning:   { id: 'cleaning',   label: 'ניקוי וטואלטיקה',   emoji: '🧹', color: '#06b6d4' },
  drinks:     { id: 'drinks',     label: 'שתייה',             emoji: '🥤', color: '#8b5cf6' },
  disposable: { id: 'disposable', label: 'חד פעמי',           emoji: '🥡', color: '#f97316' },
  dry:        { id: 'dry',        label: 'מזווה ויבש',         emoji: '🌾', color: '#f59e0b' },
  bakery:     { id: 'bakery',     label: 'לחם ומאפים',        emoji: '🍞', color: '#a16207' },
  snacks:     { id: 'snacks',     label: 'חטיפים וממתקים',    emoji: '🍿', color: '#ec4899' },
  baby:       { id: 'baby',       label: 'תינוקות ופעוטות',   emoji: '👶', color: '#f472b6' },
  health:     { id: 'health',     label: 'בריאות וויטמינים',  emoji: '💊', color: '#10b981' },
}

const OTHER: Category = { id: 'other', label: 'אחר', emoji: '📦', color: '#94a3b8' }

// ── Priority prefix rules — first word determines category ──
const PREFIX_RULES: Array<[string[], Category]> = [
  [['שוקולד', 'שוקו'],                            CAT.snacks],
  [['גבינת', 'גבינה'],                            CAT.dairy],
  [['עוגת', 'עוגה', 'עוגיות'],                    CAT.bakery],
  [['מיץ', 'משקה'],                                CAT.drinks],
  [['קרם שוקולד', 'קרם עוגה', 'קרם וניל'],       CAT.snacks],
  [['קרם לחות', 'קרם גוף', 'קרם ידיים', 'קרם פנים', 'קרם הגנה'], CAT.cleaning],
  [['חיתול', 'טיטול'],                             CAT.baby],
  [['ויטמין'],                                     CAT.health],
]

// ── Exclusion rules — words that cancel a category match ──
const EXCLUSIONS: Record<string, string[]> = {
  meat:    ['שוקולד', 'קפה', 'גבינה', 'גבינת', 'חלב', 'עוגה', 'עוגת', 'קרם', 'ריבה', 'ממרח', 'טחינה', 'חמאת'],
  produce: ['עוגת', 'עוגה', 'ריבת', 'מיץ', 'משקה', 'טעם', 'בטעם', 'שוקולד', 'גלידת', 'גלידה', 'מרק'],
  dairy:   ['שוקולד מריר', 'קוקוס'],
}

// ── Keyword rules — ordered by priority ──
const RULES: Array<[Category, string[]]> = [
  [CAT.disposable, ['כוסות', 'צלחות', 'קערות', 'סכו', 'מגש', 'שקית', 'ניילון', 'אלומיניום', 'רדיד', 'מפיות', 'מפית']],
  [CAT.baby, ['חיתול', 'טיטול', 'מגבון תינוק', 'מגבוני תינוק', 'מוצץ', 'בקבוק תינוק', 'מזון תינוק', 'סימילאק', 'מטרנה', 'מגבוני']],
  [CAT.health, ['ויטמין', 'תוסף תזונה', 'תוסף', 'אומגה', 'פרוביוטיקה', 'אספירין', 'אקמול', 'נורופן', 'תרופה', 'פלסטר', 'חיטוי', 'מסכה רפואית', 'כפפות']],
  [CAT.cleaning, ['שמפו', 'סבון', 'דאודורנט', 'ניקוי', 'אבקת כביסה', 'אבקת', 'נוזל כלים', 'נוזל לכלים', 'נייר טואלט', 'מגבון', 'טמפון', 'פד', 'גליל נייר', 'גליל', 'מרכך כביסה', 'מרכך', 'אקונומיקה', 'קרם לחות', 'קרם גוף', 'קרם ידיים', 'קרם פנים', 'קרם הגנה']],
  [CAT.dairy, ['חלב', 'גבינה', 'גבינת', 'יוגורט', 'ביצ', 'קוטג', 'שמנת', 'חמאה', 'לבן', 'מחלבות', 'תחליב', 'שוקו חלב', 'קוטג׳', 'קשקבל', 'מוצרלה', 'צפתית', 'עמק']],
  [CAT.meat, ['עוף', 'בשר', 'דג ', 'דגים', 'סלמון', 'טונה', 'נקניק', 'שניצל', 'המבורגר', 'פרגית', 'חזה עוף', 'חזה', 'כבד', 'קציצ', 'פילה', 'שוק עוף', 'כנפיים', 'אנטריקוט', 'סטייק', 'טחון', 'כרעיים', 'צלי']],
  [CAT.produce, ['עגבניה', 'עגבניות', 'מלפפון', 'חסה', 'גזר', 'בצל', 'תפוח', 'תפוז', 'בננה', 'אבוקדו', 'לימון', 'פלפל', 'ברוקולי', 'כרובית', 'קישוא', 'חציל', 'תרד', 'שום', 'מנגו', 'תות', 'ענב', 'אבטיח', 'מלון', 'פטריות', 'כוסברה', 'פטרוזיליה', 'פטרוז', 'קולורבי', 'גמבה', 'ארטישוק', 'כרוב', 'סלרי', 'שמיר', 'נענע', 'רוקט', 'אפרסק', 'שזיף', 'אגס', 'קלמנטינה', 'פומלה', 'רימון']],
  [CAT.drinks, ['מים מינרל', 'מים', 'מיץ', 'קולה', 'ספרייט', 'פאנטה', 'בירה', 'יין', 'סודה', 'לימונדה', 'נקטר', 'משקה', 'רד בול', 'פיוז טי', 'אייס טי']],
  [CAT.bakery, ['לחם', 'פיתה', 'לחמניה', 'לחמניות', 'חלה', 'באגט', 'מאפה', 'בורקס', 'קרואסון', 'עוגה', 'עוגת', 'טורט', 'מאפין', 'רוגלך', 'סמבוסק', 'ג׳חנון', 'מלאווח', 'לאפה', 'פוקצ׳ה', 'סופגניה', 'דונאט']],
  [CAT.dry, ['אורז', 'פסטה', 'קמח', 'סוכר', 'שמן', 'מלח', 'קפה', 'תה', 'טחינה', 'חלווה', 'ריבה', 'שימורי', 'עדשים', 'שעועית', 'חומוס', 'פתיתים', 'קורנפלקס', 'תירס', 'מרק', 'שקדי מרק', 'אטריות', 'קוסקוס', 'בולגור', 'קינואה', 'דבש', 'סילאן']],
  [CAT.frozen, ['גלידה', 'גלידת', 'קפוא']],
  [CAT.snacks, ['במבה', 'ביסלי', 'שוקולד', 'סוכריות', 'עוגיות', 'חטיף', 'פופקורן', 'דניאלה', 'קרקר', 'וופל', 'אגוזים', 'שקדים', 'בוטנים', 'גרעינים', 'חלבה', 'אוראו']],
]

// Context-aware classifier:
//   1. Special: פיקדון, חד פעמי
//   2. Priority prefix rules — first word overrides everything
//   3. Keyword prefix match (longer phrases first) with exclusion checking
//   4. Keyword substring match with exclusion checking
function classifyItem(name: string): Category {
  const lower = name.trim().toLowerCase()

  if (/^פיקדון$/.test(lower))   return OTHER
  if (lower.includes('פיקדון')) return CAT.drinks
  if (lower.includes('חד פעמי')) return CAT.disposable

  for (const [prefixes, cat] of PREFIX_RULES) {
    for (const p of prefixes) {
      if (lower.startsWith(p)) return cat
    }
  }

  for (const [cat, keywords] of RULES) {
    const sorted = [...keywords].sort((a, b) => b.length - a.length)
    for (const kw of sorted) {
      if (lower.startsWith(kw)) {
        const excl = EXCLUSIONS[cat.id]
        if (excl && excl.some(e => lower.includes(e) && e !== kw)) continue
        return cat
      }
    }
  }

  for (const [cat, keywords] of RULES) {
    const sorted = [...keywords].sort((a, b) => b.length - a.length)
    for (const kw of sorted) {
      if (lower.includes(kw)) {
        const excl = EXCLUSIONS[cat.id]
        if (excl && excl.some(e => lower.includes(e) && e !== kw)) continue
        return cat
      }
    }
  }

  return OTHER
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return `₪${Number(n).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

// Weight-based items have decimal quantities (e.g. 2.1456 kg) — count as 1 unit
function unitQty(q: number): number {
  const n = Number(q)
  return Number.isInteger(n) ? n : 1
}

function fmtQty(q: number, unit: string) {
  const n = Number(q)
  return unit === 'יחידה' ? String(n) : `${n} ${unit}`
}

// ── Pie slice type (no SVG angles needed) ─────────────────────────────────────

interface PieSlice {
  category: Category
  total: number
  percent: number
}

// ── CSS conic-gradient Donut Chart ────────────────────────────────────────────
// Uses CSS conic-gradient — works reliably on all mobile browsers.
// Clicking the legend toggles selection; clicking the chart deselects.

function DonutChart({
  slices,
  selectedCat,
  onSelect,
}: {
  slices: PieSlice[]
  selectedCat: string | null
  onSelect: (id: string | null) => void
}) {
  // Build gradient stops
  let acc = 0
  const stops = slices.map(s => {
    const from = acc
    acc += s.percent
    // If a category is selected, dim non-selected slices
    const color = selectedCat && selectedCat !== s.category.id
      ? `${s.category.color}55`  // ~33% opacity via hex alpha
      : s.category.color
    return `${color} ${from.toFixed(3)}% ${acc.toFixed(3)}%`
  })

  const gradient = `conic-gradient(from -90deg, ${stops.join(', ')})`
  const selected = slices.find(s => s.category.id === selectedCat)

  return (
    <div
      className="relative w-[160px] h-[160px] mx-auto rounded-full cursor-pointer"
      style={{ background: gradient }}
      onClick={() => onSelect(null)}
      title="לחץ לאיפוס הסינון"
    >
      {/* Donut hole — inset 28px gives ~64px inner circle on a 120px chart */}
      <div
        className="absolute rounded-full bg-white flex flex-col items-center justify-center"
        style={{ inset: '38px' }}
      >
        <span className="text-lg leading-none select-none">
          {selected ? selected.category.emoji : '🛒'}
        </span>
        <span className="text-[9px] text-gray-500 font-semibold mt-0.5 select-none">
          {selected ? `${selected.percent.toFixed(0)}%` : 'כל הקנייה'}
        </span>
      </div>
    </div>
  )
}

// ── PurchaseAnalysis ──────────────────────────────────────────────────────────

export default function PurchaseAnalysis({
  purchaseId,
  storeName,
  purchasedAt,
  totalAmount,
  onClose,
}: Props) {
  const [items, setItems]     = useState<PurchaseItem[]>([])
  const [loading, setLoading] = useState(true)

  // table sort
  const [sortCol, setSortCol] = useState<SortCol>('total_price')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // category filter
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

  // ai chat
  const [messages, setMessages]       = useState<ChatMsg[]>([])
  const [question, setQuestion]       = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadItems() }, [purchaseId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase
      .from('purchase_items')
      .select('*, products(barcode)')
      .eq('purchase_id', purchaseId)
      .order('total_price', { ascending: false, nullsFirst: false })
    setItems((data as PurchaseItem[]) ?? [])
    setLoading(false)
  }

  // ── sort ────────────────────────────────────────────────────────────────────

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir(col === 'name' ? 'asc' : 'desc')
    }
  }

  // ── stats ───────────────────────────────────────────────────────────────────

  const totalQty     = items.reduce((s, i) => s + unitQty(i.quantity), 0)
  const calcTotal    = items.reduce((s, i) => s + Number(i.total_price ?? 0), 0)
  const displayTotal = totalAmount ?? (calcTotal > 0 ? calcTotal : null)
  const avgPerItem   = items.length > 0 && displayTotal ? displayTotal / items.length : null

  const top5 = [...items]
    .filter(i => i.total_price !== null)
    .sort((a, b) => Number(b.total_price) - Number(a.total_price))
    .slice(0, 5)

  // ── categories ──────────────────────────────────────────────────────────────

  const itemsWithCat = items.map(item => ({
    ...item,
    category: classifyItem(item.name),
  }))

  const catTotals: Record<string, { category: Category; total: number }> = {}
  for (const item of itemsWithCat) {
    const id = item.category.id
    if (!catTotals[id]) catTotals[id] = { category: item.category, total: 0 }
    catTotals[id].total += Number(item.total_price ?? 0)
  }

  const grandTotal = Object.values(catTotals).reduce((s, c) => s + c.total, 0)

  const pieSlices: PieSlice[] = Object.values(catTotals)
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .map(c => ({
      category: c.category,
      total:    c.total,
      percent:  grandTotal > 0 ? (c.total / grandTotal) * 100 : 0,
    }))

  // ── filtered + sorted items ─────────────────────────────────────────────────

  const filteredItems = selectedCat
    ? itemsWithCat.filter(i => i.category.id === selectedCat)
    : itemsWithCat

  const sorted = [...filteredItems].sort((a, b) => {
    if (sortCol === 'name') {
      const cmp = a.name.localeCompare(b.name, 'he')
      return sortDir === 'asc' ? cmp : -cmp
    }
    const va = Number(a[sortCol] ?? -Infinity)
    const vb = Number(b[sortCol] ?? -Infinity)
    return sortDir === 'asc' ? va - vb : vb - va
  })

  const selectedSlice = pieSlices.find(s => s.category.id === selectedCat)

  // ── AI chat ─────────────────────────────────────────────────────────────────

  async function sendQuestion() {
    if (!question.trim() || chatLoading) return
    const q = question.trim()
    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setChatLoading(true)

    const date = new Date(purchasedAt).toLocaleDateString('he-IL', {
      day: 'numeric', month: 'long', year: 'numeric',
    })

    const lines = items.map(i =>
      `• ${i.name}: ${fmtQty(i.quantity, i.unit)}` +
      (i.price_per_unit ? `, ₪${i.price_per_unit} ליחידה` : '') +
      (i.total_price    ? `, סה"כ ₪${i.total_price}`       : ''),
    ).join('\n')

    const context =
      `קנייה ב${storeName ?? 'חנות לא ידועה'} — ${date}` +
      (displayTotal ? ` — סה"כ ${fmt(displayTotal)}` : '') +
      `\n\nפריטים שנרכשו (${items.length} מוצרים, ${totalQty} יחידות):\n${lines}`

    try {
      const res = await fetch(
        'https://lbeivhmaesgissghtzzh.supabase.co/functions/v1/chat-purchase',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ purchaseContext: context, question: q }),
        },
      )
      if (res.ok) {
        const { answer } = await res.json()
        setMessages(prev => [...prev, { role: 'ai', text: answer ?? '...' }])
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: 'לא הצלחתי לענות כרגע. נסה שוב.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'שגיאה בחיבור לשרת.' }])
    } finally {
      setChatLoading(false)
    }
  }

  // ── SortIcon helper ──────────────────────────────────────────────────────────

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-30 inline" />
    return sortDir === 'asc'
      ? <ChevronUp   className="w-3 h-3 text-primary-600 inline" />
      : <ChevronDown className="w-3 h-3 text-primary-600 inline" />
  }

  const headerDate = new Date(purchasedAt).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long',
  })

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">

      {/* Header */}
      <div className="bg-gradient-to-l from-primary-600 to-primary-700 text-white
                      px-4 py-3.5 flex-shrink-0 flex items-center gap-3">
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-extrabold leading-tight">תחקיר קנייה</h2>
          <p className="text-primary-100 text-xs truncate">
            {storeName ?? 'ללא חנות'} · {headerDate}
            {displayTotal ? ` · ${fmt(displayTotal)}` : ''}
          </p>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6">
          <BarChart3 className="w-16 h-16 text-gray-200 mb-4" />
          <p className="text-gray-600 font-bold text-lg">אין פריטים לקנייה זו</p>
          <p className="text-gray-400 text-sm mt-2 leading-relaxed">
            פריטים נשמרים אוטומטית עם השלמת קנייה.<br />
            קניות ישנות טרם הפיצ'ר לא יכללו פריטים.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pb-40">
          <div className="px-4 py-4 space-y-4 pb-40 max-w-2xl mx-auto">

            {/* ── Stats ── */}
            <div className="grid grid-cols-4 gap-2">
              <div className="card text-center py-3 px-1">
                <p className="text-xl font-extrabold text-primary-600 leading-tight">
                  {displayTotal !== null ? fmt(displayTotal) : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">סה"כ</p>
              </div>
              <div className="card text-center py-3 px-1">
                <p className="text-2xl font-extrabold text-primary-600">{items.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">מוצרים</p>
              </div>
              <div className="card text-center py-3 px-1">
                <p className="text-2xl font-extrabold text-primary-600">{totalQty}</p>
                <p className="text-xs text-gray-400 mt-0.5">יחידות</p>
              </div>
              <div className="card text-center py-3 px-1">
                <p className="text-lg font-extrabold text-primary-600 leading-tight">{fmt(avgPerItem)}</p>
                <p className="text-xs text-gray-400 mt-0.5">ממוצע</p>
              </div>
            </div>

            {/* ── Top 5 ── */}
            {top5.length > 0 && (
              <div className="card">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  5 המוצרים היקרים ביותר
                </p>
                <div className="space-y-2">
                  {top5.map((item, i) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className={`text-xs font-extrabold w-5 flex-shrink-0 ${
                        i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-300'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-gray-700 truncate">{item.name}</span>
                      <span className="text-sm font-bold text-gray-800 flex-shrink-0">{fmt(item.total_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Category Donut Chart ── */}
            {pieSlices.length > 0 && (
              <div className="card">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  חלוקה לקטגוריות
                </p>

                <div className="flex flex-col gap-4">
                  {/* Donut */}
                  <div className="max-w-[180px] mx-auto w-full">
                    <DonutChart
                      slices={pieSlices}
                      selectedCat={selectedCat}
                      onSelect={setSelectedCat}
                    />
                    {selectedCat && (
                      <button
                        onClick={() => setSelectedCat(null)}
                        className="w-full text-center text-xs text-primary-500 hover:text-primary-700
                                   font-semibold mt-2 transition-colors"
                      >
                        הצג הכל
                      </button>
                    )}
                  </div>

                  {/* Legend */}
                  <div className="space-y-1.5">
                    {pieSlices.map(slice => {
                      const isSel = selectedCat === slice.category.id
                      return (
                        <button
                          key={slice.category.id}
                          onClick={() => setSelectedCat(isSel ? null : slice.category.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-right
                                      transition-all ${isSel
                                        ? 'bg-gray-100 ring-1 ring-gray-300'
                                        : 'hover:bg-gray-50'
                                      } ${selectedCat && !isSel ? 'opacity-40' : ''}`}
                        >
                          <div
                            className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: slice.category.color }}
                          />
                          <span className="text-xs">{slice.category.emoji}</span>
                          <span className="flex-1 text-xs text-gray-700 font-medium truncate text-right">
                            {slice.category.label}
                          </span>
                          <span className="text-xs font-bold text-gray-800 flex-shrink-0">
                            {fmt(slice.total)}
                          </span>
                          <span
                            className="text-xs font-semibold flex-shrink-0 w-9 text-left"
                            style={{ color: slice.category.color }}
                          >
                            {slice.percent.toFixed(0)}%
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Selected category summary */}
                {selectedSlice && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">
                      {selectedSlice.category.emoji} {selectedSlice.category.label}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold" style={{ color: selectedSlice.category.color }}>
                        {fmt(selectedSlice.total)}
                      </span>
                      <span className="text-xs text-gray-400 font-semibold">
                        {selectedSlice.percent.toFixed(1)}% מסך הקנייה
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Product table ── */}
            <div className="card overflow-hidden p-0">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-700">
                  {selectedSlice
                    ? `${selectedSlice.category.emoji} ${selectedSlice.category.label}`
                    : 'כל הפריטים'
                  }
                </p>
                <p className="text-xs text-gray-400">
                  {filteredItems.length} מוצרים
                  {selectedSlice ? ` · ${fmt(selectedSlice.total)}` : ''}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[320px]">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-right py-2.5 px-3 font-semibold">
                        <button onClick={() => handleSort('name')} className="flex items-center gap-1">
                          מוצר <SortIcon col="name" />
                        </button>
                      </th>
                      <th className="text-center py-2.5 px-2 font-semibold">
                        <button
                          onClick={() => handleSort('quantity')}
                          className="flex items-center gap-1 mx-auto"
                        >
                          כמות <SortIcon col="quantity" />
                        </button>
                      </th>
                      <th className="text-left py-2.5 px-2 font-semibold">
                        <button onClick={() => handleSort('price_per_unit')} className="flex items-center gap-1">
                          <SortIcon col="price_per_unit" /> ליח'
                        </button>
                      </th>
                      <th className="text-left py-2.5 px-2 font-semibold">
                        <button onClick={() => handleSort('total_price')} className="flex items-center gap-1">
                          <SortIcon col="total_price" /> סה"כ
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sorted.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: item.category.color }}
                            />
                            <p className="font-medium text-gray-800 leading-tight">{item.name}</p>
                          </div>
                          {item.products?.barcode && (
                            <p className="text-xs text-gray-400 font-mono mt-0.5 pr-3">{item.products.barcode}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center text-gray-600 text-xs">
                          {fmtQty(item.quantity, item.unit)}
                        </td>
                        <td className="py-2.5 px-2 text-left text-gray-500 text-xs">
                          {fmt(item.price_per_unit)}
                        </td>
                        <td className="py-2.5 px-2 text-left font-bold text-gray-800">
                          {fmt(item.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── AI Chat ── */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🤖</span>
                <p className="font-bold text-gray-700">שאל AI על הקנייה</p>
              </div>

              {messages.length > 0 && (
                <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-primary-500 text-white ms-8'
                          : 'bg-gray-100 text-gray-800 me-8'
                      }`}
                    >
                      {m.text}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="bg-gray-100 rounded-2xl px-3.5 py-2.5 flex items-center gap-2 me-8">
                      <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                      <span className="text-xs text-gray-400">חושב...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}

              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {['מה היה המוצר היקר ביותר?', 'מה המוצרים ב-5 המוצרים היקרים?', 'כמה הוצאתי על ירקות?'].map(q => (
                    <button
                      key={q}
                      onClick={() => setQuestion(q)}
                      className="text-xs bg-gray-100 hover:bg-primary-50 hover:text-primary-700
                                 text-gray-500 rounded-full px-3 py-1.5 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendQuestion()}
                  placeholder="שאל שאלה על הקנייה..."
                  className="input flex-1 text-sm"
                  disabled={chatLoading}
                />
                <button
                  onClick={sendQuestion}
                  disabled={!question.trim() || chatLoading}
                  className="btn-primary px-3.5 flex-shrink-0 disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
