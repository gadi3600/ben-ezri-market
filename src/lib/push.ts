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
  if (!VAPID_PUBLIC_KEY) {
    console.warn('Push: VITE_VAPID_PUBLIC_KEY not set, skipping')
    return false
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push: not supported in this browser')
    return false
  }

  try {
    // Register the push service worker
    const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
    await navigator.serviceWorker.ready

    // Request permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('Push: permission denied')
      return false
    }

    // Subscribe
    let subscription = await reg.pushManager.getSubscription()
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      })
    }

    // Save to Supabase (upsert by user_id)
    const subJson = subscription.toJSON()
    await supabase.from('push_subscriptions').upsert(
      {
        user_id:      userId,
        family_id:    familyId,
        subscription: subJson,
      },
      { onConflict: 'user_id' },
    )

    console.log('Push: registered successfully')
    return true
  } catch (err) {
    console.error('Push: registration failed', err)
    return false
  }
}

export async function sendPushToFamily(
  familyId: string,
  title: string,
  body: string,
): Promise<void> {
  try {
    await fetch(
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
  } catch (err) {
    console.error('Push: send failed', err)
  }
}
