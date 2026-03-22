import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push'

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY   = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY  = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT      = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@benezri.market'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

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
      .select('id, subscription')
      .eq('family_id', family_id)

    const payload = JSON.stringify({ title, body })
    let sent = 0
    const errors: string[] = []

    for (const row of subs ?? []) {
      const sub = row.subscription
      if (!sub?.endpoint) continue

      try {
        await webpush.sendNotification(sub, payload)
        sent++
      } catch (err: unknown) {
        const pushErr = err as { statusCode?: number; body?: string }
        console.error('Push failed for', sub.endpoint, pushErr)

        // Clean up expired/invalid subscriptions
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', row.id)
          errors.push(`expired: ${sub.endpoint.slice(-20)}`)
        } else {
          errors.push(`${pushErr.statusCode ?? 'unknown'}: ${String(pushErr.body ?? err).slice(0, 100)}`)
        }
      }
    }

    return new Response(JSON.stringify({ sent, total: (subs ?? []).length, errors }), {
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
