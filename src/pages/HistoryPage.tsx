import { useState, useEffect } from 'react'
import { Clock, ShoppingBag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { ShoppingList } from '../lib/types'

interface HistoryList extends ShoppingList {
  item_count?: number
}

export default function HistoryPage() {
  const { profile } = useAuth()
  const [lists, setLists]   = useState<HistoryList[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.family_id) return
    loadHistory()
  }, [profile?.family_id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadHistory() {
    setLoading(true)
    const { data } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('family_id', profile!.family_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(30)
    setLists(data ?? [])
    setLoading(false)
  }

  function formatDate(iso: string | null) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('he-IL', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (lists.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-primary-50 rounded-full p-6 mb-5">
        <Clock className="w-14 h-14 text-primary-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">אין היסטוריה עדיין</h3>
      <p className="text-gray-400 text-sm">רשימות שהושלמו יופיעו כאן</p>
    </div>
  )

  return (
    <div className="space-y-3 pb-6">
      <div className="card-green flex items-center gap-3 mb-4">
        <Clock className="w-5 h-5 text-primary-600" />
        <div>
          <h2 className="font-bold text-primary-800">היסטוריית קניות</h2>
          <p className="text-sm text-primary-600">{lists.length} קניות</p>
        </div>
      </div>

      {lists.map(list => (
        <div key={list.id} className="card flex items-center gap-3">
          <div className="bg-primary-50 rounded-xl p-2.5 flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-primary-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 truncate">{list.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(list.completed_at)}</p>
          </div>
          <span className="badge bg-primary-100 text-primary-700 text-xs">הושלם</span>
        </div>
      ))}
    </div>
  )
}
