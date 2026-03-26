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
  frozen:     { id: 'frozen',     label: 'קפוא ומוכן',        emoji: '🧊', color: '#67e8f9' },
  drinks:     { id: 'drinks',     label: 'שתייה',             emoji: '🥤', color: '#8b5cf6' },
  snacks:     { id: 'snacks',     label: 'חטיפים וממתקים',    emoji: '🍿', color: '#ec4899' },
  cleaning:   { id: 'cleaning',   label: 'ניקוי וטואלטיקה',   emoji: '🧹', color: '#06b6d4' },
  disposable: { id: 'disposable', label: 'חד פעמי',           emoji: '🥡', color: '#f97316' },
}

export const OTHER: Category = { id: 'other', label: 'אחר', emoji: '📦', color: '#94a3b8' }

const RULES: Array<[Category, string[]]> = [
  [CAT.disposable, ['כוסות', 'צלחות', 'קערות', 'סכו', 'מגש', 'שקית', 'ניילון', 'אלומיניום', 'רדיד', 'מפיות', 'מפית']],
  [CAT.cleaning, ['שמפו', 'סבון', 'קרם', 'דאודורנט', 'ניקוי', 'אבקת', 'נוזל כלים', 'נוזל לכלים', 'נייר טואלט', 'מגבון', 'טמפון', 'פד', 'גליל', 'מרכך']],
  [CAT.dairy, ['חלב', 'גבינה', 'יוגורט', 'ביצ', 'קוטג', 'שמנת', 'חמאה', 'לבן', 'מחלבות', 'תחליב']],
  [CAT.meat, ['עוף', 'בשר', 'דג', 'סלמון', 'טונה', 'נקניק', 'שניצל', 'המבורגר', 'פרגית', 'חזה', 'כבד', 'קציצ', 'פילה', 'שוק']],
  [CAT.produce, ['עגבניה', 'מלפפון', 'חסה', 'גזר', 'בצל', 'תפוח', 'תפוז', 'בננה', 'אבוקדו', 'לימון', 'פלפל', 'ברוקולי', 'כרובית', 'קישוא', 'חציל', 'תרד', 'שום', 'מנגו', 'תות', 'ענב', 'אבטיח', 'מלון', 'פטריות', 'כוסברה', 'פטרוז', 'קולורבי', 'גמבה', 'ארטישוק']],
  [CAT.drinks, ['מים', 'מיץ', 'קולה', 'ספרייט', 'פאנטה', 'בירה', 'יין', 'סודה', 'לימונדה', 'נקטר', 'משקה', 'רד בול']],
  [CAT.dry, ['אורז', 'פסטה', 'קמח', 'סוכר', 'שמן', 'מלח', 'לחם', 'פיתה', 'קפה', 'תה', 'טחינה', 'חלווה', 'ריבה', 'שימורי', 'עדשים', 'שעועית', 'חומוס', 'פתיתים', 'קורנפלקס', 'תירס', 'מרק']],
  [CAT.frozen, ['גלידה', 'קפוא']],
  [CAT.snacks, ['במבה', 'ביסלי', 'שוקולד', 'סוכריות', 'עוגיות', 'חטיף', 'פופקורן', 'דניאלה']],
]

// Category order for display (produce first = start of store)
export const CATEGORY_ORDER = [
  'produce', 'dairy', 'meat', 'dry', 'frozen', 'drinks', 'snacks', 'cleaning', 'disposable', 'other',
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

export function classifyItem(name: string): Category {
  const lower = name.trim().toLowerCase()
  if (/^פיקדון$/.test(lower)) return OTHER
  if (lower.includes('פיקדון')) return CAT.drinks
  if (lower.includes('חד פעמי')) return CAT.disposable

  for (const [cat, keywords] of RULES) {
    for (const kw of keywords) {
      if (lower.startsWith(kw)) return cat
    }
  }
  for (const [cat, keywords] of RULES) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return cat
    }
  }
  return OTHER
}
