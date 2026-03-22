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
  if (!VAPID_PUBLIC_KEY) return false
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false
  if (Notification.permission === 'denied') return false

  try {
    // Use the PWA service worker (already registered by vite-plugin-pwa)
    const reg = await navigator.serviceWorker.ready

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return false
    }

    // Always create fresh subscription (handles VAPID key rotation)
    const existing = await reg.pushManager.getSubscription()
    if (existing) await existing.unsubscribe()

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    })

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id:      userId,
        family_id:    familyId,
        subscription: subscription.toJSON(),
      },
      { onConflict: 'user_id' },
    )

    return !error
  } catch (err) {
    console.error('Push registration failed:', err)
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
    console.error('Push send failed:', err)
  }
}
