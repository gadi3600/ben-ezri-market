export interface Category {
  id: string
  label: string
  emoji: string
  color: string
}

export const CAT: Record<string, Category> = {
  produce:    { id: 'produce',    label: 'ירקות ופירות',      emoji: '🥦', color: '#22c55e' },
  dairy:      { id: 'dairy',      label: 'מקרר, חלב וביצים',  emoji: '🥛', color: '#3b82f6' },
  meat:       { id: 'meat',       label: 'בשר ודגים',         emoji: '🥩', color: '#ef4444' },
  dry:        { id: 'dry',        label: 'מזווה ויבש',         emoji: '🌾', color: '#f59e0b' },
  bakery:     { id: 'bakery',     label: 'לחם ומאפים',        emoji: '🍞', color: '#a16207' },
  frozen:     { id: 'frozen',     label: 'קפוא ומוכן',        emoji: '🧊', color: '#67e8f9' },
  drinks:     { id: 'drinks',     label: 'שתייה',             emoji: '🥤', color: '#8b5cf6' },
  snacks:     { id: 'snacks',     label: 'חטיפים וממתקים',    emoji: '🍿', color: '#ec4899' },
  cleaning:   { id: 'cleaning',   label: 'ניקוי וטואלטיקה',   emoji: '🧹', color: '#06b6d4' },
  disposable: { id: 'disposable', label: 'חד פעמי',           emoji: '🥡', color: '#f97316' },
  baby:       { id: 'baby',       label: 'תינוקות ופעוטות',   emoji: '👶', color: '#f472b6' },
  health:     { id: 'health',     label: 'בריאות וויטמינים',  emoji: '💊', color: '#10b981' },
}

export const OTHER: Category = { id: 'other', label: 'אחר', emoji: '📦', color: '#94a3b8' }

// ── Priority prefix rules — first word determines category regardless of rest ──
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

// ── Exclusion rules — if item contains an exclusion word, skip that category ──
// Key: category id → words that cancel a match for that category
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

// Category order for display (produce first = start of store)
export const CATEGORY_ORDER = [
  'produce', 'dairy', 'meat', 'dry', 'bakery', 'frozen', 'drinks', 'snacks', 'cleaning', 'disposable', 'baby', 'health', 'other',
]

// Custom category DB row
export interface CustomCategoryRow {
  id: string
  family_id: string
  name: string
  emoji: string
  created_by: string | null
}

// Color palette for custom categories (cycles through)
const CUSTOM_COLORS = ['#6366f1', '#d946ef', '#14b8a6', '#f43f5e', '#84cc16', '#a855f7', '#0ea5e9', '#e11d48']

export function customCatToCategory(row: CustomCategoryRow, index: number): Category {
  return {
    id: `custom_${row.id}`,
    label: row.name,
    emoji: row.emoji,
    color: CUSTOM_COLORS[index % CUSTOM_COLORS.length],
  }
}

// Build merged maps/lists from system + custom categories
export function buildAllCategories(customRows: CustomCategoryRow[]): {
  allCats: Record<string, Category>
  allList: Category[]
  order: string[]
} {
  const allCats: Record<string, Category> = { ...CAT, other: OTHER }
  const customCats = customRows.map((r, i) => customCatToCategory(r, i))
  for (const c of customCats) allCats[c.id] = c
  const order = [...CATEGORY_ORDER]
  // Insert custom categories before 'other'
  const otherIdx = order.indexOf('other')
  for (const c of customCats) order.splice(otherIdx, 0, c.id)
  const allList = order.map(id => allCats[id]).filter(Boolean)
  return { allCats, allList, order }
}

// Suggest emoji for a category name via AI
let suggestController: AbortController | null = null

export async function suggestEmoji(name: string): Promise<string> {
  if (!name.trim()) return '📁'
  // Abort previous in-flight request
  if (suggestController) suggestController.abort()
  suggestController = new AbortController()

  try {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-emoji`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ name }),
        signal: suggestController.signal,
      },
    )
    const data = await resp.json()
    return data?.emoji || '📁'
  } catch {
    return '📁'
  }
}

export function classifyItem(name: string): Category {
  const lower = name.trim().toLowerCase()

  // 1. Special cases
  if (/^פיקדון$/.test(lower)) return OTHER
  if (lower.includes('פיקדון')) return CAT.drinks
  if (lower.includes('חד פעמי')) return CAT.disposable

  // 2. Priority prefix rules — first phrase determines category
  for (const [prefixes, cat] of PREFIX_RULES) {
    for (const p of prefixes) {
      if (lower.startsWith(p)) return cat
    }
  }

  // 3. Full-phrase prefix match (longer phrases first for precision)
  for (const [cat, keywords] of RULES) {
    // Sort keywords by length descending so "חזה עוף" matches before "חזה"
    const sorted = [...keywords].sort((a, b) => b.length - a.length)
    for (const kw of sorted) {
      if (lower.startsWith(kw)) {
        // Check exclusions
        const excl = EXCLUSIONS[cat.id]
        if (excl && excl.some(e => lower.includes(e) && e !== kw)) continue
        return cat
      }
    }
  }

  // 4. Substring match with exclusion checking
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
