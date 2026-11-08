import { Platform } from 'react-native';

const ANDROID_REMINDER_CHANNEL = 'moodcanvas-daily-reminder';

export function parseReminderTime(value: string) {
  const match = /^(?:([01]\d|2[0-3])):([0-5]\d)$/.exec(value);
  if (!match) return null;

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

export async function scheduleDailyReminder(hour: number, minute: number) {
  if (Platform.OS === 'web') {
    throw new Error('Daily reminders are not available in the web version.');
  }

  const Notifications = await import('expo-notifications');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_REMINDER_CHANNEL, {
      name: 'Daily reflection reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#67539B',
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) {
    throw new Error(
      'Notification permission was not granted. You can enable it in your device settings.',
    );
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'A moment for you',
      body: 'Take a quiet moment to check in with yourself.',
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: Platform.OS === 'android' ? ANDROID_REMINDER_CHANNEL : undefined,
    },
  });
}

export async function cancelDailyReminder(notificationId: string) {
  if (Platform.OS === 'web') {
    throw new Error('Daily reminders are not available in the web version.');
  }

  const Notifications = await import('expo-notifications');
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
