import { useState } from 'react'
import { ShoppingCart, Mail, Lock, User } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'register'

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [info, setInfo]         = useState<string | null>(null)

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() } },
        })
        if (error) throw error
        setInfo('נשלח אליך אימייל אימות — בדוק את תיבת הדואר ואשר את החשבון')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Invalid login credentials'))  setError('אימייל או סיסמה שגויים')
      else if (msg.includes('already registered'))    setError('אימייל זה כבר רשום במערכת')
      else if (msg.includes('Password should be'))    setError('הסיסמה חייבת להכיל לפחות 6 תווים')
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
          {mode === 'login' ? 'ברוך השב 👋' : 'יצירת חשבון'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">שם מלא</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="input pr-10"
                  placeholder="ישראל ישראלי"
                  required
                  autoComplete="name"
                />
              </div>
            </div>
          )}

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
                placeholder={mode === 'register' ? 'לפחות 6 תווים' : '••••••••'}
                dir="ltr"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
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
            disabled={loading}
            className="btn-primary w-full mt-2 text-base py-3.5"
          >
            {loading
              ? 'רגע...'
              : mode === 'login' ? 'כניסה למערכת' : 'יצירת חשבון'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-gray-500">
          {mode === 'login' ? (
            <>
              אין לך חשבון?{' '}
              <button onClick={() => switchMode('register')} className="text-primary-600 font-bold">
                הרשמה
              </button>
            </>
          ) : (
            <>
              יש לך חשבון?{' '}
              <button onClick={() => switchMode('login')} className="text-primary-600 font-bold">
                התחברות
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
