import { useState } from 'react'
import { ShoppingCart, Mail, Lock, Eye, EyeOff, ArrowRight, User } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'register' | 'forgot'

export default function AuthPage() {
  const [mode, setMode]             = useState<Mode>('login')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [fullName, setFullName]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [info, setInfo]             = useState<string | null>(null)

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
    setInfo(null)
  }

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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPass) { setError('הסיסמאות לא תואמות'); return }
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      if (error) throw error
      setInfo('נשלח אליך אימייל אימות — בדוק את תיבת הדואר ואשר את החשבון')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already registered')) setError('אימייל זה כבר רשום — נסה להתחבר')
      else if (msg.includes('Password should be')) setError('הסיסמה חייבת להכיל לפחות 6 תווים')
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

        {/* ── LOGIN ── */}
        {mode === 'login' && (
          <>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-6 text-center">ברוך השב 👋</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">אימייל</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="input pr-10" placeholder="name@example.com" dir="ltr" required autoComplete="email" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">סיסמה</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    className="input pr-10 pl-10" placeholder="••••••••" dir="ltr" required minLength={6} autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl text-center">{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full mt-2 text-base py-3.5">
                {loading ? 'רגע...' : 'כניסה למערכת'}
              </button>
            </form>
            <button onClick={() => switchMode('forgot')}
              className="w-full mt-3 text-center text-sm text-primary-600 font-medium hover:text-primary-700">
              שכחתי סיסמה
            </button>
            <div className="mt-4 text-center text-sm text-gray-500">
              אין לך חשבון?{' '}
              <button onClick={() => switchMode('register')} className="text-primary-600 font-bold">הרשמה</button>
            </div>
          </>
        )}

        {/* ── REGISTER ── */}
        {mode === 'register' && (
          <>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-6 text-center">יצירת חשבון</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">שם מלא</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    className="input pr-10" placeholder="ישראל ישראלי" required autoComplete="name" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">אימייל</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="input pr-10" placeholder="name@example.com" dir="ltr" required autoComplete="email" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">סיסמה</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    className="input pr-10 pl-10" placeholder="לפחות 6 תווים" dir="ltr" required minLength={6} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">אישור סיסמה</label>
                <input type={showPass ? 'text' : 'password'} value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                  className="input" placeholder="הקלד שוב" dir="ltr" required minLength={6} autoComplete="new-password" />
              </div>
              {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl text-center">{error}</div>}
              {info && <div className="bg-primary-50 border border-primary-100 text-primary-700 text-sm p-3 rounded-xl text-center">{info}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full mt-2 text-base py-3.5">
                {loading ? 'רגע...' : 'יצירת חשבון'}
              </button>
            </form>
            <div className="mt-5 text-center text-sm text-gray-500">
              יש לך חשבון?{' '}
              <button onClick={() => switchMode('login')} className="text-primary-600 font-bold">התחברות</button>
            </div>
          </>
        )}

        {/* ── FORGOT ── */}
        {mode === 'forgot' && (
          <>
            <button onClick={() => switchMode('login')}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
              <ArrowRight className="w-4 h-4" /> חזרה להתחברות
            </button>
            <h2 className="text-xl font-extrabold text-gray-800 mb-2">שחזור סיסמה</h2>
            <p className="text-sm text-gray-400 mb-5">הזן את האימייל שלך ונשלח לך קישור לאיפוס</p>
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input pr-10" placeholder="name@example.com" dir="ltr" required autoFocus />
              </div>
              {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl text-center">{error}</div>}
              {info && <div className="bg-primary-50 border border-primary-100 text-primary-700 text-sm p-3 rounded-xl text-center">{info}</div>}
              <button type="submit" disabled={loading || !email.trim()} className="btn-primary w-full text-base py-3.5">
                {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
