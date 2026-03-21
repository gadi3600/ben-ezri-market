export interface Family {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export interface UserProfile {
  id: string
  family_id: string | null
  full_name: string
  avatar_url: string | null
  role: 'admin' | 'member'
  created_at: string
  updated_at: string
}

export interface Store {
  id: string
  name: string
  logo_url: string | null
  website: string | null
  is_active: boolean
  created_at: string
}

export interface ShoppingList {
  id: string
  family_id: string
  name: string
  status: 'active' | 'shopping' | 'completed' | 'archived'
  store_id: string | null
  created_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ListItem {
  id: string
  list_id: string
  product_id: string | null
  name: string
  quantity: number
  unit: string
  note: string | null
  is_checked: boolean
  is_deferred: boolean
  sort_order: number
  added_by: string | null
  checked_by: string | null
  checked_at: string | null
  created_at: string
  updated_at: string
}

export interface Purchase {
  id: string
  family_id: string
  store_id: string | null
  list_id: string | null
  total_amount: number | null
  purchased_by: string | null
  purchased_at: string
  created_at: string
}

export interface PurchaseReceipt {
  id: string
  purchase_id: string
  storage_path: string
  page_number: number
  uploaded_by: string | null
  created_at: string
}
