export type Role = 'admin' | 'member' | 'viewer'

export function canEdit(role: Role): boolean {
  return role === 'admin' || role === 'member'
}

export function isAdmin(role: Role): boolean {
  return role === 'admin'
}

export function roleLabel(role: Role): string {
  switch (role) {
    case 'admin':  return 'מנהל'
    case 'member': return 'חבר'
    case 'viewer': return 'צופה'
  }
}
