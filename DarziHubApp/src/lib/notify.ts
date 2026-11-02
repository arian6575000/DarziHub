// Local reminders: one notification at 9 AM on each delivery / trial day. Best-effort, never throws.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Repo } from '../db/repo';
import { PENDING } from '../db/types';
import { parseYmd, todayStr } from './dates';
import { translate, Lang } from './i18n';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function ensureNotifyPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch { return false; }
}

export async function cancelReminders() {
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* ignore */ }
}

export async function syncReminders(lang: Lang) {
  try {
    const s = await Repo.getSettings();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!s.notifyEnabled) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    const [orders, customers] = await Promise.all([Repo.listOrders(), Repo.customerMap()]);
    const today = todayStr();
    const now = Date.now();
    const jobs: { at: Date; title: string; body: string }[] = [];
    for (const o of orders) {
      if (!PENDING.includes(o.status)) continue;
      const name = customers[o.customerId]?.name || '';
      const body = translate('notifBody', lang).replace('{order}', o.orderNumber).replace('{name}', name);
      for (const [date, key] of [[o.deliveryDate, 'notifTitleDue'], [o.trialDate, 'notifTitleTrial']] as const) {
        if (!date || date < today) continue;
        const at = parseYmd(date); at.setHours(9, 0, 0, 0);
        if (at.getTime() <= now) continue;
        jobs.push({ at, title: `${o.urgent ? '🔥 ' : ''}${translate(key, lang)}`, body });
      }
    }
    jobs.sort((a, b) => a.at.getTime() - b.at.getTime());
    for (const j of jobs.slice(0, 60)) { // iOS keeps at most 64 pending local notifications
      await Notifications.scheduleNotificationAsync({
        content: { title: j.title, body: j.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: j.at, channelId: 'reminders' },
      });
    }
  } catch { /* reminders are best-effort */ }
}
