import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ShoppingCart, Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { roleLabel } from '../lib/permissions'
import type { Role } from '../lib/permissions'

export default function JoinPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const role  = (params.get('role') ?? 'member') as Role

  console.log('🔗 JoinPage mount:', {
    url: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    token,
    role,
    allParams: Object.fromEntries(params.entries()),
  })

  const [invite, setInvite] = useState<{ email: string; role: Role; family_name: string } | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [invalidInvite, setInvalidInvite] = useState(false)

  const [mode, setMode]         = useState<'login' | 'register'>('register')
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [info, setInfo]         = useState<string | null>(null)

  useEffect(() => {
    console.log('🔗 JoinPage useEffect: token =', token)
    if (token) {
      sessionStorage.setItem('pendingInviteToken', token)
      console.log('🔗 JoinPage: saved to sessionStorage:', token)
      loadInvite(token)
    } else {
      console.log('🔗 JoinPage: no token found in URL')
      setLoadingInvite(false)
      setInvalidInvite(true)
    }
  }, [token])

  async function loadInvite(inviteId: string) {
    setLoadingInvite(true)
    console.log('🔗 loadInvite: fetching invite id =', inviteId)

    const { data, error } = await supabase
      .from('invites')
      .select('email, role, family_id')
      .eq('id', inviteId)
      .maybeSingle()

    console.log('🔗 loadInvite result:', { data, error: error?.message ?? null })

    if (error || !data) {
      setInvalidInvite(true)
      setLoadingInvite(false)
      return
    }

    // Fetch family name separately
    let familyName = 'משפחה'
    if (data.family_id) {
      const { data: fam } = await supabase
        .from('families')
        .select('name')
        .eq('id', data.family_id)
        .maybeSingle()
      if (fam?.name) familyName = fam.name
    }

    setInvite({
      email: data.email,
      role: data.role as Role,
      family_name: familyName,
    })
    setEmail(data.email)
    setLoadingInvite(false)
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
        navigate('/')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Invalid login credentials'))  setError('אימייל או סיסמה שגויים')
      else if (msg.includes('already registered'))    setError('אימייל זה כבר רשום — נסה להתחבר')
      else if (msg.includes('Password should be'))    setError('הסיסמה חייבת להכיל לפחות 6 תווים')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (loadingInvite) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-600 to-primary-800">
      <Loader2 className="w-10 h-10 text-white animate-spin" />
    </div>
  )

  if (invalidInvite) return (
    <div className="min-h-screen bg-gradient-to-b from-primary-600 to-primary-800 flex flex-col items-center justify-center px-5 text-center">
      <div className="bg-white rounded-3xl p-5 inline-flex shadow-xl mb-5">
        <ShoppingCart className="w-14 h-14 text-primary-600" />
      </div>
      <h1 className="text-2xl font-extrabold text-white mb-3">הזמנה לא תקינה</h1>
      <p className="text-primary-200 mb-6">הלינק לא תקין או שההזמנה כבר מומשה</p>
      <button
        onClick={() => navigate('/')}
        className="bg-white/20 hover:bg-white/30 text-white font-semibold px-6 py-3 rounded-2xl transition-colors"
      >
        חזרה לדף הראשי
      </button>
    </div>
  )

  const displayRole = roleLabel(invite?.role ?? role)

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-600 via-primary-600 to-primary-800 flex flex-col items-center justify-center px-5 py-10">

      {/* Logo */}
      <div className="text-center mb-8">
        <div className="bg-white rounded-3xl p-5 inline-flex shadow-xl mb-5">
          <ShoppingCart className="w-14 h-14 text-primary-600" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">בן עזרי מרקט</h1>
        <p className="text-primary-200 mt-2 text-base">מערכת קניות משפחתית חכמה</p>
      </div>

      {/* Invite banner */}
      <div className="bg-white/20 backdrop-blur rounded-2xl px-5 py-4 w-full max-w-sm mb-5 text-center">
        <p className="text-white text-sm font-semibold mb-1">
          הוזמנת להצטרף ל{invite?.family_name ?? 'משפחה'}
        </p>
        <p className="text-primary-100 text-xs">
          תפקיד: <span className="font-bold text-white">{displayRole}</span>
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7">
        <h2 className="text-2xl font-extrabold text-gray-800 mb-6 text-center">
          {mode === 'login' ? 'התחברות' : 'יצירת חשבון'}
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
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input pr-10 pl-10"
                placeholder={mode === 'register' ? 'לפחות 6 תווים' : '••••••••'}
                dir="ltr"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
              : mode === 'login' ? 'כניסה' : 'הרשמה והצטרפות'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-gray-500">
          {mode === 'login' ? (
            <>
              אין לך חשבון?{' '}
              <button onClick={() => { setMode('register'); setError(null); setInfo(null) }} className="text-primary-600 font-bold">
                הרשמה
              </button>
            </>
          ) : (
            <>
              יש לך חשבון?{' '}
              <button onClick={() => { setMode('login'); setError(null); setInfo(null) }} className="text-primary-600 font-bold">
                התחברות
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
