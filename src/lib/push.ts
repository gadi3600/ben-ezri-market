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
    alert('שגיאה: VAPID key לא מוגדר. בדוק את קובץ .env')
    return false
  }

  if (!('serviceWorker' in navigator)) {
    alert('שגיאה: הדפדפן לא תומך ב-Service Worker')
    return false
  }
  if (!('PushManager' in window)) {
    alert('שגיאה: הדפדפן לא תומך בהתראות Push')
    return false
  }
  if (!('Notification' in window)) {
    alert('שגיאה: הדפדפן לא תומך ב-Notification API')
    return false
  }
  console.log('🔔 Push: browser supports push notifications')

  const currentPermission = Notification.permission
  console.log('🔔 Push: current permission =', currentPermission)

  if (currentPermission === 'denied') {
    alert('ההתראות חסומות בדפדפן. יש לאפשר אותן בהגדרות הדפדפן ולנסות שוב.')
    return false
  }

  // Step 1: Register service worker
  let reg: ServiceWorkerRegistration
  try {
    console.log('🔔 Push: registering service worker...')
    reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
    console.log('🔔 Push: service worker registered, scope:', reg.scope)
    await navigator.serviceWorker.ready
    console.log('🔔 Push: service worker ready')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('🔔 Push: SW registration failed', err)
    alert(`שגיאה ברישום Service Worker:\n${msg}`)
    return false
  }

  // Step 2: Request permission
  if (currentPermission === 'default') {
    try {
      console.log('🔔 Push: requesting permission...')
      const permission = await Notification.requestPermission()
      console.log('🔔 Push: permission result =', permission)
      if (permission !== 'granted') {
        alert('לא אושרה הרשאה להתראות')
        return false
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('🔔 Push: permission request failed', err)
      alert(`שגיאה בבקשת הרשאה:\n${msg}`)
      return false
    }
  }

  // Step 3: Subscribe to PushManager
  let subscription: PushSubscription
  try {
    console.log('🔔 Push: checking existing subscription...')
    const existing = await reg.pushManager.getSubscription()

    if (existing) {
      // Unsubscribe old subscription (might be from old VAPID key)
      console.log('🔔 Push: unsubscribing old subscription...')
      await existing.unsubscribe()
    }
    {
      console.log('🔔 Push: creating new subscription...')
      console.log('🔔 Push: VAPID key length =', VAPID_PUBLIC_KEY.length)
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      })
      console.log('🔔 Push: new subscription created')
    }
    console.log('🔔 Push: endpoint =', subscription.endpoint)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('🔔 Push: subscribe failed', err)
    alert(`שגיאה בהרשמה ל-Push:\n${msg}`)
    return false
  }

  // Step 4: Save to Supabase
  try {
    const subJson = subscription.toJSON()
    console.log('🔔 Push: saving to Supabase...', JSON.stringify(subJson).slice(0, 100))
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id:      userId,
        family_id:    familyId,
        subscription: subJson,
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      console.error('🔔 Push: Supabase error', error)
      alert(`שגיאה בשמירה לסופאבייס:\n${error.message}\n\nהאם טבלת push_subscriptions קיימת?`)
      return false
    }

    console.log('🔔 Push: registered successfully ✅')
    alert('התראות הופעלו בהצלחה! ✅')
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('🔔 Push: save failed', err)
    alert(`שגיאה בשמירה:\n${msg}`)
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
