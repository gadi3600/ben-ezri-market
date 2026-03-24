import { useState } from 'react'
import { ShoppingCart, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'forgot'

export default function AuthPage() {
  const [mode, setMode]           = useState<Mode>('login')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [info, setInfo]           = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Invalid login credentials')) setError('אימייל או סיסמה שגויים')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      })
      if (error) throw error
      setInfo('נשלח אליך מייל לאיפוס סיסמה — בדוק את תיבת הדואר')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-600 via-primary-600 to-primary-800 flex flex-col items-center justify-center px-5 py-10">

      {/* Logo */}
      <div className="text-center mb-10">
        <div className="bg-white rounded-3xl p-5 inline-flex shadow-xl mb-5">
          <ShoppingCart className="w-14 h-14 text-primary-600" />
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">בן עזרי מרקט</h1>
        <p className="text-primary-200 mt-2 text-base">מערכת קניות משפחתית חכמה</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7">

        {mode === 'login' && (
          <>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-6 text-center">
              ברוך השב 👋
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">אימייל</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input pr-10"
                    placeholder="name@example.com"
                    dir="ltr"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">סיסמה</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pr-10 pl-10"
                    placeholder="••••••••"
                    dir="ltr"
                    required
                    minLength={6}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-2 text-base py-3.5"
              >
                {loading ? 'רגע...' : 'כניסה למערכת'}
              </button>
            </form>

            <button
              onClick={() => { setMode('forgot'); setError(null); setInfo(null) }}
              className="w-full mt-3 text-center text-sm text-primary-600 font-medium hover:text-primary-700"
            >
              שכחתי סיסמה
            </button>

            <p className="mt-4 text-center text-xs text-gray-400">
              הרשמה למערכת אפשרית רק באמצעות הזמנה מהמנהל
            </p>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <button
              onClick={() => { setMode('login'); setError(null); setInfo(null) }}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4"
            >
              <ArrowRight className="w-4 h-4" /> חזרה להתחברות
            </button>

            <h2 className="text-xl font-extrabold text-gray-800 mb-2">שחזור סיסמה</h2>
            <p className="text-sm text-gray-400 mb-5">הזן את האימייל שלך ונשלח לך קישור לאיפוס</p>

            <form onSubmit={handleForgot} className="space-y-4">
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input pr-10"
                  placeholder="name@example.com"
                  dir="ltr"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl text-center">
                  {error}
                </div>
              )}
              {info && (
                <div className="bg-primary-50 border border-primary-100 text-primary-700 text-sm p-3 rounded-xl text-center">
                  {info}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="btn-primary w-full text-base py-3.5"
              >
                {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
