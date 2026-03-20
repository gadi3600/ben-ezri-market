import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { ShoppingCart, Store, History, Settings } from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthPage        from './pages/AuthPage'
import FamilySetupPage from './pages/FamilySetupPage'
import ListPage        from './pages/ListPage'
import ShopPage        from './pages/ShopPage'
import HistoryPage     from './pages/HistoryPage'
import SettingsPage    from './pages/SettingsPage'

// ── Nav items ───────────────────────────────────────────────────────────────

const navItems = [
  { to: '/',        label: 'רשימה',    emoji: '🛒', Icon: ShoppingCart },
  { to: '/shop',    label: 'קנייה',    emoji: '🏪', Icon: Store        },
  { to: '/history', label: 'היסטוריה', emoji: '📊', Icon: History      },
  { to: '/settings',label: 'הגדרות',   emoji: '⚙️', Icon: Settings     },
]

// ── Inner app (needs AuthContext) ────────────────────────────────────────────

function AppContent() {
  const { session, profile, loading } = useAuth()

  // Loading splash
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary-600 to-primary-700">
      <div className="bg-white/20 rounded-3xl p-5 mb-5">
        <ShoppingCart className="w-12 h-12 text-white" />
      </div>
      <div className="w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin" />
    </div>
  )

  // Not logged in
  if (!session) return <AuthPage />

  // Logged in but no family yet
  if (!profile?.family_id) return <FamilySetupPage />

  // Full app
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-gradient-to-l from-primary-600 to-primary-700 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <div className="bg-white/20 rounded-xl p-2 flex-shrink-0">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold leading-tight tracking-tight">בן עזרי מרקט</h1>
            <p className="text-primary-100 text-xs font-medium truncate">
              שלום, {profile.full_name} 👋
            </p>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4">
        <Routes>
          <Route path="/"         element={<ListPage />}     />
          <Route path="/shop"     element={<ShopPage />}     />
          <Route path="/history"  element={<HistoryPage />}  />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* ── Bottom navigation ── */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t-2 border-primary-100
                      shadow-[0_-4px_20px_rgba(0,0,0,0.07)] z-10">
        <div className="max-w-2xl mx-auto flex">
          {navItems.map(({ to, label, emoji }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5
                 text-xs font-semibold transition-all duration-200 relative
                 ${isActive ? 'text-primary-600' : 'text-gray-400 hover:text-gray-500'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 inset-x-4 h-0.5 rounded-b-full bg-primary-500" />
                  )}
                  <span className={`text-2xl leading-tight transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                    {emoji}
                  </span>
                  <span className="leading-tight">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
        {/* iOS safe area */}
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
      </nav>
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
