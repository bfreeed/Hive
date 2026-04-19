import { useEffect } from 'react';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer;
}

export function usePushNotifications() {
  const currentUser = useStore((s) => s.currentUser);

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (currentUser.id === '__loading__') return;

    const setup = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/service-worker.js');

        // Check if already subscribed
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          // Re-save in case it was lost from DB (idempotent upsert)
          await saveSub(currentUser.id, existing);
          return;
        }

        // Ask for permission (only prompts if not already decided)
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        await saveSub(currentUser.id, sub);
      } catch (err) {
        console.error('Push notification setup failed:', err);
      }
    };

    setup();
  }, [currentUser.id]);
}

async function saveSub(userId: string, sub: PushSubscription) {
  await supabase.from('push_subscriptions').upsert(
    { user_id: userId, subscription: sub.toJSON(), updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}
