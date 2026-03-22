import { useState } from 'react'
import { ShoppingCart, Mail, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Invalid login credentials'))  setError('אימייל או סיסמה שגויים')
      else setError(msg)
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
        <h2 className="text-2xl font-extrabold text-gray-800 mb-6 text-center">
          ברוך השב 👋
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input pr-10"
                placeholder="••••••••"
                dir="ltr"
                required
                minLength={6}
                autoComplete="current-password"
              />
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

        <p className="mt-5 text-center text-xs text-gray-400">
          הרשמה למערכת אפשרית רק באמצעות הזמנה מהמנהל
        </p>
      </div>
    </div>
  )
}
