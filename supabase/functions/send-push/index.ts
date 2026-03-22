import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PRIVATE_KEY  = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_PUBLIC_KEY   = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_SUBJECT      = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@benezri.market'

// ── Web Push helpers (minimal implementation for Deno) ───────────────────────

function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4)
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importVapidKey(privateKeyB64: string): Promise<CryptoKey> {
  const raw = base64UrlDecode(privateKeyB64)
  // VAPID private key is 32 bytes raw → wrap as PKCS8 for P-256
  // For web-push compatibility, we import as JWK
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: privateKeyB64,
    x: VAPID_PUBLIC_KEY.length > 43 ? '' : '', // filled below
    y: '',
  }
  // Extract x,y from public key (65 bytes uncompressed: 04 || x || y)
  const pubBytes = base64UrlDecode(VAPID_PUBLIC_KEY)
  if (pubBytes.length === 65) {
    jwk.x = base64UrlEncode(pubBytes.slice(1, 33))
    jwk.y = base64UrlEncode(pubBytes.slice(33, 65))
  }
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

async function createVapidAuthHeader(
  audience: string,
  subject: string,
  privateKey: CryptoKey,
): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  })))
  const unsigned = `${header}.${payload}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsigned),
  )
  // Convert DER signature to raw r||s (64 bytes)
  const sig = new Uint8Array(signature)
  let r: Uint8Array, s: Uint8Array
  if (sig.length === 64) {
    r = sig.slice(0, 32)
    s = sig.slice(32, 64)
  } else {
    // DER format: 30 len 02 rlen r 02 slen s
    const rLen = sig[3]
    const rStart = 4 + (rLen - 32)
    r = sig.slice(rStart, rStart + 32)
    const sLen = sig[5 + rLen]
    const sStart = 6 + rLen + (sLen - 32)
    s = sig.slice(sStart, sStart + 32)
  }
  const rawSig = new Uint8Array(64)
  rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32))
  rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32))

  return `${unsigned}.${base64UrlEncode(rawSig.buffer)}`
}

async function sendWebPush(subscription: {
  endpoint: string
  keys: { p256dh: string; auth: string }
}, payload: string): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint)
    const audience = `${url.protocol}//${url.host}`

    const privateKey = await importVapidKey(VAPID_PRIVATE_KEY)
    const jwt = await createVapidAuthHeader(audience, VAPID_SUBJECT, privateKey)

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      },
      body: payload,
    })

    if (res.status === 410 || res.status === 404) {
      // Subscription expired — clean up
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
      await supabase.from('push_subscriptions')
        .delete()
        .eq('subscription->>endpoint', subscription.endpoint)
      return false
    }

    return res.ok
  } catch (err) {
    console.error('sendWebPush error:', err)
    return false
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const { family_id, title, body } = await req.json()
    if (!family_id || !title) {
      return new Response(JSON.stringify({ error: 'Missing family_id or title' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('family_id', family_id)

    const payload = JSON.stringify({ title, body })
    let sent = 0
    for (const row of subs ?? []) {
      const sub = row.subscription as { endpoint: string; keys: { p256dh: string; auth: string } }
      if (sub?.endpoint) {
        const ok = await sendWebPush(sub, payload)
        if (ok) sent++
      }
    }

    return new Response(JSON.stringify({ sent, total: (subs ?? []).length }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('send-push error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
