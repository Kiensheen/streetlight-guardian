import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FirebaseMessaging } from '@capgo/capacitor-firebase-messaging';

const CHANNEL_ID = 'streetlight-faults';

const hashToInt = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
};

export const initNativePushNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Streetlight Fault Alerts',
      description: 'Active fault notifications',
      importance: 5,
      visibility: 1,
      sound: 'default',
    });
  } catch (error) {
    console.warn('[NativePush] Failed to create notification channel', error);
  }

  try {
    const pushPermission = await PushNotifications.checkPermissions();
    if (pushPermission.receive !== 'granted') {
      await PushNotifications.requestPermissions();
    }
    await PushNotifications.register();
  } catch (error) {
    console.warn('[NativePush] PushNotifications registration failed', error);
  }

  try {
    const messagingPermission = await FirebaseMessaging.checkPermissions();
    if (messagingPermission.receive !== 'granted') {
      await FirebaseMessaging.requestPermissions();
    }
    const tokenResult = await FirebaseMessaging.getToken();
    if (tokenResult.token) {
      console.log('[NativePush] FCM token received');
    }
  } catch (error) {
    console.warn('[NativePush] FirebaseMessaging setup failed', error);
  }
};

export const sendFaultNotification = async (
  faultId: string,
  streetlightName: string,
  faultTypeLabel: string,
): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    const id = hashToInt(faultId);
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title: 'New Fault Detected',
        body: `${streetlightName} - ${faultTypeLabel}`,
        channelId: CHANNEL_ID,
        smallIcon: 'ic_launcher',
      }],
    });
    return;
  }

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('New Fault Detected', {
      body: `${streetlightName} - ${faultTypeLabel}`,
      icon: '/vite.svg',
      tag: faultId,
    });
  }
};

export const clearFaultNotification = async (faultId: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  const id = hashToInt(faultId);
  await LocalNotifications.cancel({
    notifications: [{ id }],
  });
};
