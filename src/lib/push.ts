import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export async function registerPushSubscription(userId: string, familyId: string): Promise<boolean> {
  console.log('🔔 Push: starting registration...')

  if (!VAPID_PUBLIC_KEY) {
    console.warn('🔔 Push: VITE_VAPID_PUBLIC_KEY not set, skipping')
    return false
  }
  console.log('🔔 Push: VAPID key found')

  if (!('serviceWorker' in navigator)) {
    console.warn('🔔 Push: Service Worker not supported')
    return false
  }
  if (!('PushManager' in window)) {
    console.warn('🔔 Push: PushManager not supported')
    return false
  }
  if (!('Notification' in window)) {
    console.warn('🔔 Push: Notification API not supported')
    return false
  }
  console.log('🔔 Push: browser supports push notifications')

  // Check current permission state
  const currentPermission = Notification.permission
  console.log('🔔 Push: current permission =', currentPermission)

  if (currentPermission === 'denied') {
    console.warn('🔔 Push: notifications blocked by user. User needs to enable in browser settings.')
    return false
  }

  try {
    // Register the push service worker
    console.log('🔔 Push: registering service worker...')
    const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
    console.log('🔔 Push: service worker registered, scope:', reg.scope)

    await navigator.serviceWorker.ready
    console.log('🔔 Push: service worker ready')

    // Request permission if not yet granted
    if (currentPermission === 'default') {
      console.log('🔔 Push: requesting permission...')
      const permission = await Notification.requestPermission()
      console.log('🔔 Push: permission result =', permission)
      if (permission !== 'granted') {
        console.log('🔔 Push: user did not grant permission')
        return false
      }
    }

    // Subscribe to push
    console.log('🔔 Push: checking existing subscription...')
    let subscription = await reg.pushManager.getSubscription()

    if (subscription) {
      console.log('🔔 Push: existing subscription found')
    } else {
      console.log('🔔 Push: no subscription, creating new one...')
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      })
      console.log('🔔 Push: new subscription created')
    }

    console.log('🔔 Push: subscription endpoint =', subscription.endpoint)

    // Save to Supabase (upsert by user_id)
    const subJson = subscription.toJSON()
    console.log('🔔 Push: saving subscription to Supabase...')
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id:      userId,
        family_id:    familyId,
        subscription: subJson,
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      console.error('🔔 Push: failed to save subscription', error.message)
      return false
    }

    console.log('🔔 Push: registered successfully ✅')
    return true
  } catch (err) {
    console.error('🔔 Push: registration failed', err)
    return false
  }
}

export async function sendPushToFamily(
  familyId: string,
  title: string,
  body: string,
): Promise<void> {
  try {
    console.log('🔔 Push: sending notification to family', familyId)
    const res = await fetch(
      'https://lbeivhmaesgissghtzzh.supabase.co/functions/v1/send-push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ family_id: familyId, title, body }),
      },
    )
    const result = await res.json()
    console.log('🔔 Push: send result', result)
  } catch (err) {
    console.error('🔔 Push: send failed', err)
  }
}
