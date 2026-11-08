import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit/v2';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { AnimatedPressable as Pressable } from '@/components/AnimatedPressable';
import { cancelDailyReminder, parseReminderTime, scheduleDailyReminder } from '@/lib/daily-reminders';
import AuthScreen from '../components/AuthScreen';
import { supabase } from '../lib/supabase';
import { ThemePreferenceKey } from '@/constants/theme';

const PROFILE_KEY = '@moodcanvas/profile-name';
const REMINDER_KEY = '@moodcanvas/daily-reminder';
const TAB_ENTERING = FadeInDown.duration(220);
const ENTRY_ENTERING = FadeIn.duration(180);
type ThemeMode = 'light' | 'dark' | 'system';

const moods = [
  { label: 'Happy', emoji: '😊' },
  { label: 'Calm', emoji: '😌' },
  { label: 'Okay', emoji: '🙂' },
  { label: 'Sad', emoji: '😔' },
  { label: 'Stressed', emoji: '😣' },
];

type Entry = {
  id: number;
  mood: string;
  emoji: string;
  note: string;
  date: string;
  isoDate: string;
};
type MoodFilter = 'all' | (typeof moods)[number]['label'];
type EntrySortOrder = 'newest' | 'oldest';

type SavedReminder = {
  enabled: true;
  time: string;
  notificationId: string;
};

type CloudReflection = {
  id: number;
  client_id: string;
  mood: string;
  emoji: string;
  note: string;
  entry_date: string;
};

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getWeekDateKeys(date: Date) {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return getLocalDateKey(day);
  });
}

function JournalApp() {
  const [userId, setUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [passwordMessage, setPasswordMessage] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState('');
  const [note, setNote] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [moodFilter, setMoodFilter] = useState<MoodFilter>('all');
  const [entrySortOrder, setEntrySortOrder] = useState<EntrySortOrder>('newest');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
const [syncMessage, setSyncMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileInput, setProfileInput] = useState('');
  const [reminderTime, setReminderTime] = useState('20:00');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderNotificationId, setReminderNotificationId] = useState<string | null>(null);
  const [reminderMessage, setReminderMessage] = useState('');
  const [isUpdatingReminder, setIsUpdatingReminder] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [chartPeriod, setChartPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [themeMessage, setThemeMessage] = useState('');
  const systemColorScheme = useColorScheme();
  const isDarkTheme = themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<
    'journal' | 'insights' | 'calendar' | 'settings'
  >('journal');
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const contentScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
  let active = true;

  supabase.auth.getUser().then(({ data, error }) => {
    if (error) {
      console.error('Getting current user failed:', error);
    }

    if (active) {
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? null);
    }
  });

  return () => {
    active = false;
  };
}, []);

  const navigationItems = [
    { key: 'journal' as const, label: 'Journal', icon: '✍️' },
    { key: 'insights' as const, label: 'Insights', icon: '📊' },
    { key: 'calendar' as const, label: 'Calendar', icon: '🗓️' },
    { key: 'settings' as const, label: 'Settings', icon: '⚙️' },
  ];

  function navigateToTab(tab: typeof activeTab) {
    setActiveTab(tab);
    contentScrollRef.current?.scrollTo({ y: 0, animated: true });
  }

const [currentMonth, setCurrentMonth] = useState(new Date());

const [selectedDate, setSelectedDate] = useState(new Date());
const calendarAnchorDay = useRef(new Date().getDate());

  useEffect(() => {
    let active = true;
    async function loadTheme() {
      try {
        const savedTheme = await AsyncStorage.getItem(ThemePreferenceKey);
        if (active && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
          setThemeMode(savedTheme);
        }
      } catch (error) {
        console.error('Loading appearance preference failed:', error);
      }
    }
    loadTheme();
    return () => { active = false; };
  }, []);

  async function changeTheme(mode: ThemeMode) {
    try {
      await AsyncStorage.setItem(ThemePreferenceKey, mode);
      setThemeMode(mode);
      setThemeMessage(`Appearance set to ${mode === 'system' ? 'System default' : mode === 'dark' ? 'Dark mode' : 'Light mode'}.`);
    } catch (error) {
      console.error('Saving appearance preference failed:', error);
      setThemeMessage('Could not save your appearance preference.');
    }
  }

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!userId) {
        setProfileName('');
        setProfileInput('');
        return;
      }

      try {
        const accountProfileKey = `${PROFILE_KEY}:${userId}`;
        let savedName = await AsyncStorage.getItem(accountProfileKey);

        if (savedName === null) {
          const legacyName = await AsyncStorage.getItem(PROFILE_KEY);
          if (legacyName !== null) {
            await AsyncStorage.setItem(accountProfileKey, legacyName);
            await AsyncStorage.removeItem(PROFILE_KEY);
            savedName = legacyName;
          }
        }

        if (active && savedName !== null) {
          setProfileName(savedName);
          setProfileInput(savedName);
        }
      } catch (error) {
        console.error('Loading profile failed:', error);
      }
    }

    loadProfile();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    let active = true;

    async function loadReminder() {
      if (!userId) return;

      try {
        const storedReminder = await AsyncStorage.getItem(`${REMINDER_KEY}:${userId}`);
        if (!active || storedReminder === null) return;

        const parsed: unknown = JSON.parse(storedReminder);
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          !('enabled' in parsed) ||
          parsed.enabled !== true ||
          !('time' in parsed) ||
          typeof parsed.time !== 'string' ||
          !parseReminderTime(parsed.time) ||
          !('notificationId' in parsed) ||
          typeof parsed.notificationId !== 'string'
        ) {
          throw new Error('Saved reminder settings are invalid.');
        }

        setReminderTime(parsed.time);
        setReminderNotificationId(parsed.notificationId);
        setReminderEnabled(true);
      } catch (error) {
        console.error('Loading daily reminder failed:', error);
        if (active) setReminderMessage('Could not load your reminder settings.');
      }
    }

    loadReminder();
    return () => { active = false; };
  }, [userId]);

  function exportReflections() {
    if (entries.length === 0) {
      setExportMessage('There are no reflections to export yet.');
      return;
    }

    if (Platform.OS !== 'web') {
      setExportMessage('JSON download is currently available in the web version.');
      return;
    }

    try {
      const backup = {
        app: 'MoodCanvas',
        exportedAt: new Date().toISOString(),
        reflectionCount: entries.length,
        reflections: entries,
      };
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `moodcanvas-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportMessage('Your journal backup has been downloaded.');
    } catch (error) {
      console.error('Exporting reflections failed:', error);
      setExportMessage('Could not export your reflections. Please try again.');
    }
  }
async function changePassword() {
  setPasswordMessage('');

  if (!newPassword || !confirmPassword) {
    setPasswordMessage('Please fill in both password fields.');
    return;
  }

  if (newPassword.length < 6) {
    setPasswordMessage('Password must contain at least 6 characters.');
    return;
  }

  if (newPassword !== confirmPassword) {
    setPasswordMessage('Passwords do not match.');
    return;
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordMessage(error.message);
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage('Your password has been changed successfully!');

  } catch (error) {
    console.error('Password update failed:', error);
    setPasswordMessage('Something went wrong. Please try again.');
  }
}
async function refreshJournal() {
  if (!userId || isRefreshing) return;

  setIsRefreshing(true);
  setSyncMessage('');

  try {
    const { data, error } = await supabase
      .from('reflections')
      .select('id, client_id, mood, emoji, note, entry_date')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const cloudEntries: Entry[] = (data as CloudReflection[]).map((row) => {
      const isoDate = row.entry_date;

      return {
        id: Number(row.client_id),
        mood: row.mood,
        emoji: row.emoji,
        note: row.note,
        date: getDateFromKey(isoDate).toLocaleDateString(),
        isoDate,
      };
    });

    setEntries(cloudEntries);
    setSyncMessage('Your journal is synced successfully!');

  } catch (error) {
    console.error('Manual sync failed:', error);
    setSyncMessage('Sync failed. Please check your internet connection.');
  } finally {
    setIsRefreshing(false);
  }
}
  async function saveProfile() {
    const cleanedName = profileInput.trim();
    if (!userId) {
      setSettingsMessage('Please sign in again before saving your profile.');
      return;
    }
    if (!cleanedName) {
      setSettingsMessage('Please enter a name before saving.');
      return;
    }
    try {
      await AsyncStorage.setItem(`${PROFILE_KEY}:${userId}`, cleanedName);
      setProfileName(cleanedName);
      setProfileInput(cleanedName);
      setSettingsMessage('Your profile name has been saved.');
    } catch (error) {
      console.error('Saving profile failed:', error);
      setSettingsMessage('Could not save your profile name. Please try again.');
    }
  }

  async function updateDailyReminder(shouldEnable: boolean) {
    if (!userId || isUpdatingReminder) return;

    if (shouldEnable && !parseReminderTime(reminderTime)) {
      setReminderMessage('Enter a valid time in 24-hour HH:mm format.');
      return;
    }

    setIsUpdatingReminder(true);
    setReminderMessage('');

    try {
      const storageKey = `${REMINDER_KEY}:${userId}`;

      if (!shouldEnable) {
        if (reminderNotificationId) {
          await cancelDailyReminder(reminderNotificationId);
        }
        await AsyncStorage.removeItem(storageKey);
        setReminderEnabled(false);
        setReminderNotificationId(null);
        setReminderMessage('Your daily reminder is turned off.');
        return;
      }

      const time = parseReminderTime(reminderTime);
      if (!time) {
        throw new Error('Enter a valid time in 24-hour HH:mm format.');
      }

      const newNotificationId = await scheduleDailyReminder(time.hour, time.minute);
      const savedReminder: SavedReminder = {
        enabled: true,
        time: reminderTime,
        notificationId: newNotificationId,
      };

      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(savedReminder));
      } catch (error) {
        try {
          await cancelDailyReminder(newNotificationId);
        } catch (cancelError) {
          console.error('Cleaning up an unsaved daily reminder failed:', cancelError);
        }
        throw error;
      }

      setReminderEnabled(true);
      setReminderNotificationId(newNotificationId);

      if (reminderNotificationId && reminderNotificationId !== newNotificationId) {
        try {
          await cancelDailyReminder(reminderNotificationId);
        } catch (error) {
          console.error('Replacing the previous daily reminder failed:', error);
          setReminderMessage(
            'Your new reminder is saved, but the previous schedule could not be cleared.',
          );
          return;
        }
      }

      setReminderMessage(`Daily reminder set for ${reminderTime}.`);
    } catch (error) {
      console.error('Updating daily reminder failed:', error);
      setReminderMessage(
        error instanceof Error ? error.message : 'Could not update your daily reminder.',
      );
    } finally {
      setIsUpdatingReminder(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadEntries() {
      if (!userId) {
        if (active) setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('reflections')
          .select('id, client_id, mood, emoji, note, entry_date')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const cloudEntries: Entry[] = (data as CloudReflection[]).map((row) => {
          const isoDate = row.entry_date;
          const displayDate = getDateFromKey(isoDate).toLocaleDateString();
          return {
            id: Number(row.client_id),
            mood: row.mood,
            emoji: row.emoji,
            note: row.note,
            date: displayDate,
            isoDate,
          };
        });

        if (active) setEntries(cloudEntries);
      } catch (error) {
        console.error('Loading cloud reflections failed:', error);
        if (active) setMessage('Could not load cloud reflections. Please check your connection.');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadEntries();
    return () => { active = false; };
  }, [userId]);

  async function persistEntry(entry: Entry) {
    if (!userId) throw new Error('You are not signed in. Please sign in again.');
    const { error } = await supabase.from('reflections').upsert(
      {
        user_id: userId,
        client_id: String(entry.id),
        mood: entry.mood,
        emoji: entry.emoji,
        note: entry.note,
        entry_date: entry.isoDate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,client_id' }
    );
    if (error) throw error;
  }

  async function deleteCloudEntry(entryId: number) {
    if (!userId) throw new Error('You are not signed in. Please sign in again.');
    const { error } = await supabase
      .from('reflections')
      .delete()
      .eq('user_id', userId)
      .eq('client_id', String(entryId));
    if (error) throw error;
  }

  function resetForm() {
    setSelectedMood('');
    setNote('');
    setEditingId(null);
  }

  async function saveReflection() {
    if (isLoading || isSaving || !userId) return;

    if (!selectedMood) {
      setMessage('Please choose a mood.');
      return;
    }

    if (!note.trim()) {
      setMessage('Please write a reflection.');
      return;
    }

    const mood = moods.find((item) => item.label === selectedMood);
    if (!mood) return;

    const existingEntry = editingId === null ? null : entries.find((entry) => entry.id === editingId);
    const entryToSave: Entry = {
      id: editingId ?? Date.now(),
      mood: mood.label,
      emoji: mood.emoji,
      note: note.trim(),
      date: existingEntry?.date ?? new Date().toLocaleDateString(),
      isoDate: existingEntry?.isoDate ?? getLocalDateKey(new Date()),
    };

    setIsSaving(true);
    setMessage('');

    try {
      await persistEntry(entryToSave);
      const updatedEntries = editingId === null
        ? [entryToSave, ...entries]
        : entries.map((entry) => entry.id === editingId ? entryToSave : entry);
      setEntries(updatedEntries);
      resetForm();
      setMessage(editingId === null
        ? 'Reflection saved securely to your cloud account!'
        : 'Reflection updated in the cloud!');
    } catch (error) {
      console.error('Saving cloud reflection failed:', error);
      setMessage('Could not save to cloud. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(entry: Entry) {
    setEditingId(entry.id);
    setSelectedMood(entry.mood);
    setNote(entry.note);
    setMessage('');
    navigateToTab('journal');
  }

  async function deleteReflection(id: number) {
    if (isSaving) return;

    const entryToDelete = entries.find((entry) => entry.id === id);
    if (!entryToDelete) return;

    if (Platform.OS === 'web') {
      if (!window.confirm('Delete this reflection? This action cannot be undone.')) return;
    } else {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Delete reflection?',
          'This action cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        );
      });
      if (!confirmed) return;
    }

    try {
      await deleteCloudEntry(id);
      const updatedEntries = entries.filter((entry) => entry.id !== id);
      setEntries(updatedEntries);
      if (editingId === id) resetForm();
      setMessage('Reflection deleted from your cloud journal.');
    } catch (error) {
      console.error('Deleting cloud reflection failed:', error);
      setMessage('Could not delete reflection from cloud. Please try again.');
    }
  }

  const totalEntries = entries.length;
  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, Entry[]>();
    for (const entry of entries) {
      const dateEntries = grouped.get(entry.isoDate) ?? [];
      dateEntries.push(entry);
      grouped.set(entry.isoDate, dateEntries);
    }
    return grouped;
  }, [entries]);
  const visibleEntries = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return entries
      .filter((entry) => moodFilter === 'all' || entry.mood === moodFilter)
      .filter((entry) => !normalizedSearch || entry.note.toLowerCase().includes(normalizedSearch))
      .slice()
      .sort((first, second) =>
        entrySortOrder === 'newest'
          ? second.isoDate.localeCompare(first.isoDate) || second.id - first.id
          : first.isoDate.localeCompare(second.isoDate) || first.id - second.id
      );
  }, [entries, entrySortOrder, moodFilter, searchQuery]);

const calendarYear = currentMonth.getFullYear();
const calendarMonth = currentMonth.getMonth();

const daysInMonth = new Date(
  calendarYear,
  calendarMonth + 1,
  0
).getDate();

const firstWeekday = new Date(
  calendarYear,
  calendarMonth,
  1
).getDay();

const monthName = currentMonth.toLocaleDateString(
  undefined,
  { month: 'long', year: 'numeric' }
);

const selectedDateKey = getLocalDateKey(selectedDate);
const selectedDateLabel = selectedDate.toLocaleDateString();

const selectedDateEntries = entriesByDate.get(selectedDateKey) ?? [];

const calendarCells = [
  ...Array(firstWeekday).fill(null),
  ...Array.from(
    { length: daysInMonth },
    (_, index) => index + 1
  ),
];

function navigateCalendarMonth(monthOffset: number) {
  const nextMonth = new Date(
    calendarYear,
    calendarMonth + monthOffset,
    1
  );
  const lastDayOfMonth = new Date(
    nextMonth.getFullYear(),
    nextMonth.getMonth() + 1,
    0
  ).getDate();

  setCurrentMonth(nextMonth);
  setSelectedDate(
    new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      Math.min(calendarAnchorDay.current, lastDayOfMonth)
    )
  );
}

function selectCalendarDate(date: Date) {
  calendarAnchorDay.current = date.getDate();
  setSelectedDate(date);
}

function navigateCalendarToToday() {
  const today = new Date();
  calendarAnchorDay.current = today.getDate();
  setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  setSelectedDate(today);
}

const periodDateKeys = useMemo(
  () =>
    chartPeriod === 'weekly'
      ? getWeekDateKeys(selectedDate)
      : Array.from(
          {
            length: new Date(
              currentMonth.getFullYear(),
              currentMonth.getMonth() + 1,
              0
            ).getDate(),
          },
          (_, index) =>
            getLocalDateKey(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1)
            )
        ),
  [chartPeriod, currentMonth, selectedDate],
);
const periodLabel =
  chartPeriod === 'weekly'
    ? `${getDateFromKey(periodDateKeys[0]).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })} – ${getDateFromKey(periodDateKeys[6]).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })}`
    : monthName;

const chartData = useMemo(() => {
  const labels: string[] = [];
  const values: number[] = [];

  for (const dateKey of periodDateKeys) {
    const date = getDateFromKey(dateKey);
    labels.push(
      chartPeriod === 'weekly'
        ? `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${date.getDate()}`
        : String(date.getDate())
    );
    values.push(entriesByDate.get(dateKey)?.length ?? 0);
  }

  return { labels, values };
}, [chartPeriod, entriesByDate, periodDateKeys]);
const chartLabels = chartData.labels;
const chartValues = chartData.values;
const periodEntries = useMemo(
  () => periodDateKeys.flatMap((dateKey) => entriesByDate.get(dateKey) ?? []),
  [entriesByDate, periodDateKeys],
);
const periodMoodCounts = useMemo(() => {
  const counts = new Map<string, number>();
  for (const entry of periodEntries) {
    counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
  }

  return moods.map((mood) => ({
    ...mood,
    count: counts.get(mood.label) ?? 0,
  }));
}, [periodEntries]);
const periodHighestMoodCount = Math.max(0, ...periodMoodCounts.map((item) => item.count));
const periodMostCommon =
  periodHighestMoodCount === 0
    ? null
    : periodMoodCounts.filter((item) => item.count === periodHighestMoodCount);
const periodTotalEntries = periodEntries.length;
const averageChartEntries =
  chartValues.length > 0
    ? (periodTotalEntries / chartValues.length).toFixed(1)
    : '0';
const chartViewportWidth = Math.max(280, Math.min(width - (isDesktop ? 360 : 44), 740));
const chartWidth =
  chartPeriod === 'monthly'
    ? Math.max(chartViewportWidth, chartValues.length * 38)
    : chartViewportWidth;

  return (
    <View style={[styles.appShell, !isDesktop && styles.mobileAppShell, isDarkTheme && styles.darkAppShell]}>
      {isDesktop && (
        <View style={[styles.sidebar, isDarkTheme && styles.darkSurface]}>
          <Text style={[styles.sidebarBrand, isDarkTheme && styles.darkBrand]}>moodcanvas</Text>
          <Text style={styles.sidebarCaption}>YOUR PERSONAL SPACE</Text>
          <View style={styles.sidebarNav}>
            {navigationItems.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => navigateToTab(item.key)}
                accessibilityRole="tab"
                accessibilityLabel={`${item.label} section`}
                accessibilityState={{ selected: activeTab === item.key }}
                style={[
                  styles.sidebarItem,
                  activeTab === item.key && styles.sidebarItemActive,
                  isDarkTheme && activeTab === item.key && styles.darkSidebarItemActive,
                ]}
              >
                <Text style={styles.navIcon}>{item.icon}</Text>
                <Text
                  style={[
  styles.sidebarItemText,
  isDarkTheme && styles.darkMutedText,
  activeTab === item.key && (isDarkTheme ? styles.darkSidebarItemTextActive : styles.sidebarItemTextActive),
]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => navigateToTab('journal')}
            accessibilityRole="button"
            style={styles.sidebarComposeButton}
          >
            <Text style={styles.sidebarComposeIcon}>＋</Text>
            <Text style={styles.sidebarComposeText}>New reflection</Text>
          </Pressable>
          <Text style={styles.sidebarFooter}>Your day matters. So do you.</Text>
        </View>
      )}

      <View style={styles.mainArea}>
        <ScrollView
          ref={contentScrollRef}
          style={[styles.screen, isDarkTheme && styles.darkScreen]}
          contentContainerStyle={[
            styles.content,
            !isDesktop && { paddingTop: Math.max(30, insets.top + 12) },
            isDesktop && styles.desktopContent,
          ]}
        >
          {!isDesktop && (
            <View style={styles.mobileHeader}>
              <View>
                <Text style={[styles.brand, isDarkTheme && styles.darkBrand]}>moodcanvas</Text>
                <Text style={[styles.brandCaption, isDarkTheme && styles.darkMutedText]}>
                  YOUR PERSONAL SPACE
                </Text>
              </View>
              <View style={[styles.avatar, isDarkTheme && styles.darkAvatar]}>
                <Text style={[styles.avatarText, isDarkTheme && styles.darkBrand]}>
                  {(profileName.trim()[0] ?? 'M').toLocaleUpperCase()}
                </Text>
              </View>
            </View>
          )}
          <Text style={[styles.greeting, isDarkTheme && styles.darkText]}>
            {activeTab === 'journal'
              ? profileName
                ? `Welcome back, ${profileName}.`
                : 'A little space for you.'
              : activeTab === 'insights'
                ? 'Your mood, at a glance.'
                : activeTab === 'calendar'
                  ? 'Your moments, day by day.'
                  : 'Make this space yours.'}
          </Text>
          <Text style={[styles.subtitle, isDarkTheme && styles.darkMutedText]}>
            {activeTab === 'journal'
              ? 'Pause, check in, and reflect on your day.'
              : activeTab === 'insights'
                ? 'Notice the patterns in your reflections.'
                : activeTab === 'calendar'
                  ? 'Revisit the moments you have recorded.'
                  : 'A few details about your MoodCanvas journal.'}
          </Text>
          {activeTab !== 'journal' && (
            <Pressable
              onPress={() => navigateToTab('journal')}
              accessibilityRole="button"
              style={styles.quickComposeButton}
            >
              <Text style={styles.quickComposeIcon}>＋</Text>
              <Text style={styles.quickComposeText}>Write a reflection</Text>
            </Pressable>
          )}

      <Animated.View
        key={activeTab}
        style={styles.tabContent}
        entering={reduceMotion ? undefined : TAB_ENTERING}
      >
      {activeTab === 'journal' ? (
        <>
          <View style={[styles.card, isDarkTheme && styles.darkCard]}>
            <Text
  style={[
    styles.sectionTitle,
    isDarkTheme && styles.darkText,
  ]}
>
              {editingId === null
                ? 'How are you feeling?'
                : 'Edit your reflection'}
            </Text>

            <View style={styles.moodGrid}>
              {moods.map((mood) => (
                <Pressable
                  key={mood.label}
                  selected={selectedMood === mood.label}
                  onPress={() => {
                    setSelectedMood(mood.label);
                    setMessage('');
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={`${mood.label} mood`}
                  accessibilityState={{ selected: selectedMood === mood.label }}
                  style={[
                    styles.moodOption,
                    isDarkTheme && styles.darkMoodOption,
                    selectedMood === mood.label &&
                      (isDarkTheme ? styles.darkSelectedMood : styles.selectedMood),
                  ]}
                >
                  <Text style={styles.emoji}>{mood.emoji}</Text>
                  <Text style={[styles.moodLabel, isDarkTheme && styles.darkMoodLabel]}>{mood.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text
  style={[
    styles.sectionTitle,
    isDarkTheme && styles.darkText,
  ]}
>
              What is on your mind?
            </Text>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Write about your day..."
              placeholderTextColor="#898394"
              multiline
              textAlignVertical="top"
              style={[styles.input, isDarkTheme && styles.darkInput]}
            />

            <Pressable
              disabled={isLoading || isSaving}
              onPress={saveReflection}
              style={[
                styles.saveButton,
                (isLoading || isSaving) && styles.disabledButton,
              ]}
            >
              <Text style={styles.saveButtonText}>
                {isLoading
                  ? 'Loading...'
                  : isSaving
                    ? 'Saving...'
                    : editingId === null
                      ? 'Save my reflection'
                      : 'Update reflection'}
              </Text>
            </Pressable>

            {editingId !== null && (
              <Pressable
                onPress={() => {
                  resetForm();
                  setMessage('Editing cancelled.');
                }}
                style={styles.cancelButton}
              >
                <Text style={[styles.cancelText, isDarkTheme && styles.darkCancelText]}>Cancel editing</Text>
              </Pressable>
            )}

            {!!message && (
              <Text style={[styles.message, isDarkTheme && styles.darkMutedText]}>{message}</Text>
            )}
          </View>

          <Text style={[styles.recentTitle, isDarkTheme && styles.darkText]}>Your reflections</Text>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={isDarkTheme ? '#B7A7DE' : '#67539B'} />
              <Text style={[styles.emptyText, isDarkTheme && styles.darkMutedText]}>Loading entries...</Text>
            </View>
          ) : entries.length === 0 ? (
            <View style={[styles.emptyCard, isDarkTheme && styles.darkCard]}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={[styles.emptyTitle, isDarkTheme && styles.darkText]}>
                Your story starts here
              </Text>
              <Text style={[styles.emptyText, isDarkTheme && styles.darkMutedText]}>
                Save your first reflection to see it here.
              </Text>
            </View>
          ) : (
            <>
              <View style={[styles.journalTools, isDarkTheme && styles.darkCard]}>
                <View style={[styles.searchFieldWrap, isDarkTheme && styles.darkSearchFieldWrap]}>
                  <Text style={styles.searchIcon}>⌕</Text>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search your reflections"
                    placeholderTextColor="#888196"
                    accessibilityLabel="Search reflection notes"
                    returnKeyType="search"
                    style={[styles.searchInput, isDarkTheme && styles.darkInput]}
                  />
                </View>
                <Text style={[styles.filterLabel, isDarkTheme && styles.darkMutedText]}>
                  FILTER BY MOOD
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterList}
                  accessibilityLabel="Filter reflections by mood"
                >
                  {[
                    { label: 'All moods', value: 'all' as const },
                    ...moods.map((mood) => ({
                      label: `${mood.emoji} ${mood.label}`,
                      value: mood.label,
                    })),
                  ].map((filter) => (
                    <Pressable
                      key={filter.value}
                      onPress={() => setMoodFilter(filter.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: moodFilter === filter.value }}
                      style={[
                        styles.filterChip,
                        isDarkTheme && styles.darkFilterChip,
                        moodFilter === filter.value &&
                          (isDarkTheme ? styles.darkFilterChipActive : styles.filterChipActive),
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          isDarkTheme && styles.darkMutedText,
                          moodFilter === filter.value &&
                            (isDarkTheme
                              ? styles.darkFilterChipTextActive
                              : styles.filterChipTextActive),
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={[styles.sortRow, isDarkTheme && styles.darkSortRow]}>
                  <Text style={[styles.filterLabel, isDarkTheme && styles.darkMutedText]}>
                    SORT BY
                  </Text>
                  <View style={styles.sortOptions}>
                    {([
                      { value: 'newest', label: 'Newest' },
                      { value: 'oldest', label: 'Oldest' },
                    ] as const).map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() => setEntrySortOrder(option.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: entrySortOrder === option.value }}
                        style={[
                          styles.sortButton,
                          entrySortOrder === option.value && styles.sortButtonActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sortButtonText,
                            entrySortOrder === option.value && styles.sortButtonTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {visibleEntries.length === 0 ? (
                <View style={[styles.emptyCard, isDarkTheme && styles.darkCard]}>
                  <Text style={styles.emptyEmoji}>🔎</Text>
                  <Text style={[styles.emptyTitle, isDarkTheme && styles.darkText]}>
                    No matching reflections
                  </Text>
                  <Text style={[styles.emptyText, isDarkTheme && styles.darkMutedText]}>
                    Try another search or mood filter.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setSearchQuery('');
                      setMoodFilter('all');
                    }}
                    style={styles.clearFiltersButton}
                  >
                    <Text style={styles.clearFiltersText}>Clear filters</Text>
                  </Pressable>
                </View>
              ) : visibleEntries.map((entry, index) => (
              <Animated.View
                key={entry.id}
                entering={
                  reduceMotion || index >= 8
                    ? undefined
                    : ENTRY_ENTERING.delay(index * 24)
                }
                style={[styles.entryCard, isDarkTheme && styles.darkCard]}
              >
                <Text style={[styles.entryMood, isDarkTheme && styles.darkText]}>
                  {entry.emoji} {entry.mood}
                </Text>
                <Text style={[styles.entryDate, isDarkTheme && styles.darkMutedText]}>{entry.date}</Text>
                <Text style={[styles.entryNote, isDarkTheme && styles.darkText]}>{entry.note}</Text>

                <View style={styles.entryActions}>
                  <Pressable
                    onPress={() => startEditing(entry)}
                    style={[styles.editButton, isDarkTheme && styles.darkEditButton]}
                  >
                    <Text style={[styles.editText, isDarkTheme && styles.darkEditText]}>Edit</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => deleteReflection(entry.id)}
                    style={[styles.deleteButton, isDarkTheme && styles.darkDeleteButton]}
                  >
                    <Text style={[styles.deleteText, isDarkTheme && styles.darkDeleteText]}>Delete</Text>
                  </Pressable>
                </View>
              </Animated.View>
              ))}
            </>
          )}
        </>
            ) : activeTab === 'insights' ? (
        <>
                <View style={[styles.periodSelector, isDarkTheme && styles.darkPeriodSelector]}>
                  <Pressable
                    onPress={() => setChartPeriod('weekly')}
                    style={[
                      styles.periodButton,
                      chartPeriod === 'weekly'
                        ? [styles.periodButtonActive, isDarkTheme && styles.darkPeriodButtonActive]
                        : isDarkTheme && styles.darkPeriodButton,
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodButtonText,
                        chartPeriod === 'weekly'
                          ? [
                              styles.periodButtonTextActive,
                              isDarkTheme && styles.darkPeriodButtonTextActive,
                            ]
                          : isDarkTheme && styles.darkPeriodButtonText,
                      ]}
                    >
                      Weekly
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setChartPeriod('monthly')}
                    style={[
                      styles.periodButton,
                      chartPeriod === 'monthly'
                        ? [styles.periodButtonActive, isDarkTheme && styles.darkPeriodButtonActive]
                        : isDarkTheme && styles.darkPeriodButton,
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodButtonText,
                        chartPeriod === 'monthly'
                          ? [
                              styles.periodButtonTextActive,
                              isDarkTheme && styles.darkPeriodButtonTextActive,
                            ]
                          : isDarkTheme && styles.darkPeriodButtonText,
                      ]}
                    >
                      Monthly
                    </Text>
                  </Pressable>
                </View>

                <Animated.View
                  key={chartPeriod}
                  style={styles.tabContent}
                  entering={reduceMotion ? undefined : FadeIn.duration(180)}
                >
                <View style={[styles.statCard, isDarkTheme && styles.darkStatCard]}>
                  <Text style={styles.statLabel}>ALL-TIME REFLECTIONS</Text>
                  <Text style={styles.statNumber}>{totalEntries}</Text>
                  <Text style={styles.statDescription}>
                    {totalEntries === 1 ? 'One moment recorded' : 'Moments recorded in your journal'}
                  </Text>
                </View>

          <Text style={[styles.recentTitle, isDarkTheme && styles.darkText]}>Your mood overview</Text>

          <View style={[styles.card, isDarkTheme && styles.darkCard]}>
            {periodTotalEntries === 0 ? (
              <View style={styles.insightEmptyState}>
                <Text style={styles.emptyEmoji}>🌱</Text>
                <Text style={[styles.emptyTitle, isDarkTheme && styles.darkText]}>
                  Your mood patterns will grow here
                </Text>
                <Text style={[styles.emptyText, isDarkTheme && styles.darkMutedText]}>
                  No reflections for {chartPeriod === 'weekly' ? 'this week' : 'this month'} yet.
                </Text>
              </View>
            ) : periodMoodCounts.map((item) => {
              const percentage =
                periodTotalEntries === 0
                  ? 0
                  : (item.count / periodTotalEntries) * 100;

              return (
                <View key={item.label} style={styles.moodStat}>
                  <View style={styles.moodStatHeader}>
                    <Text style={[styles.moodStatName, isDarkTheme && styles.darkText]}>
                      {item.emoji} {item.label}
                    </Text>
                    <Text style={[styles.moodStatCount, isDarkTheme && styles.darkMutedText]}>
                      {item.count} ({Math.round(percentage)}%)
                    </Text>
                  </View>

                  <View style={[styles.progressTrack, isDarkTheme && styles.darkProgressTrack]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${percentage}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>

<View style={[styles.card, isDarkTheme && styles.darkCard]}>
  <Text style={[styles.recentTitle, isDarkTheme && styles.darkText]}>
    Your mood activity
  </Text>
  <Text style={[styles.emptyText, isDarkTheme && styles.darkMutedText]}>
    Daily reflections from {periodLabel}
  </Text>

<View
  style={{
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  }}
>
  <View
    style={[styles.statCard, styles.compactStatCard, isDarkTheme && styles.darkStatCard]}
  >
    <Text style={[styles.statLabel, styles.compactStatLabel]}>
      PERIOD REFLECTIONS
    </Text>

    <Text style={[styles.statNumber, styles.compactStatNumber]}>
      {periodTotalEntries}
    </Text>
  </View>

  <View
    style={[styles.statCard, styles.compactStatCard, isDarkTheme && styles.darkStatCard]}
  >
    <Text style={[styles.statLabel, styles.compactStatLabel]}>
      DAILY AVERAGE
    </Text>

    <Text style={[styles.statNumber, styles.compactStatNumber]}>
      {averageChartEntries}
    </Text>
  </View>
</View>
{periodTotalEntries === 0 ? (
  <View style={[styles.chartEmptyState, isDarkTheme && styles.darkChartEmptyState]}>
    <Text style={styles.emptyEmoji}>📈</Text>
    <Text style={[styles.emptyText, isDarkTheme && styles.darkMutedText]}>
      Add a reflection to see your daily activity.
    </Text>
  </View>
) : (
<ScrollView horizontal showsHorizontalScrollIndicator={true}>
<BarChart
  data={chartValues.map((value, index) => ({
    day: chartLabels[index],
    reflections: value,
  }))}
  xKey="day"
  yKey="reflections"
  width={chartWidth}
  height={250}
  theme={{
    background: isDarkTheme ? '#1E1A27' : '#FFFFFF',
    plotBackground: isDarkTheme ? '#1E1A27' : '#FFFFFF',
    grid: isDarkTheme ? '#473E52' : '#E2DDEC',
    axis: isDarkTheme ? '#51465F' : '#E2DDEC',
    text: isDarkTheme ? '#F5F1FC' : '#302B3D',
    mutedText: isDarkTheme ? '#B9B0C7' : '#777186',
    series: ['#67539B'],
    typography: { axisLabelSize: 10 },
  }}
  barRadius={5}
  barWidthRatio={0.58}
  showHorizontalGridLines
/>
</ScrollView>
)}
  <Text style={[styles.emptyText, isDarkTheme && styles.darkMutedText]}>
    Each bar represents one day
  </Text>
</View>
          <View style={[styles.insightCard, isDarkTheme && styles.darkCard]}>
            <Text
  style={[
    styles.sectionTitle,
    isDarkTheme && styles.darkText,
  ]}
>
              Most recorded mood
            </Text>

            {periodMostCommon ? (
              <>
                <Text style={styles.insightEmoji}>
                  {periodMostCommon.map((item) => item.emoji).join(' ')}
                </Text>
                <Text style={[styles.insightTitle, isDarkTheme && styles.darkInsightTitle]}>
                  {periodMostCommon.map((item) => item.label).join(' & ')}
                </Text>
                <Text style={[styles.emptyText, isDarkTheme && styles.darkMutedText]}>
                  {periodHighestMoodCount} {periodHighestMoodCount === 1 ? 'entry' : 'entries'}{' '}
                  {periodMostCommon.length > 1
                    ? 'for each of your most-recorded moods'
                    : 'recorded with this mood'}
                </Text>
              </>
            ) : (
              <Text style={[styles.emptyText, isDarkTheme && styles.darkMutedText]}>
                Add a reflection to start seeing your mood overview.
              </Text>
            )}
          </View>

          <Text style={[styles.disclaimer, isDarkTheme && styles.darkMutedText]}>
            These summaries describe your recorded entries. They are
            not a diagnosis or a measure of your mental health.
          </Text>
                </Animated.View>

        </>
      ) : activeTab === 'calendar' ? (
        <>
          <View style={[styles.card, isDarkTheme && styles.darkCard]}>
            <View style={styles.calendarHeader}>
              <Pressable
                onPress={() => navigateCalendarMonth(-1)}
                accessibilityRole="button"
                accessibilityLabel="Go to previous month"
                style={[styles.monthButton, isDarkTheme && styles.darkMonthButton]}
              >
                <Text style={[styles.monthButtonText, isDarkTheme && styles.darkMonthButtonText]}>‹</Text>
              </Pressable>

              <Text style={[styles.monthTitle, isDarkTheme && styles.darkText]}>{monthName}</Text>

              <Pressable
                onPress={() => navigateCalendarMonth(1)}
                accessibilityRole="button"
                accessibilityLabel="Go to next month"
                style={[styles.monthButton, isDarkTheme && styles.darkMonthButton]}
              >
                <Text style={[styles.monthButtonText, isDarkTheme && styles.darkMonthButtonText]}>›</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={navigateCalendarToToday}
              accessibilityRole="button"
              accessibilityLabel="Go to today"
              style={[styles.calendarTodayButton, isDarkTheme && styles.darkCalendarTodayButton]}
            >
              <Text style={[styles.calendarTodayButtonText, isDarkTheme && styles.darkCalendarTodayButtonText]}>
                Today
              </Text>
            </Pressable>

            <View style={styles.calendarGrid}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                (day) => (
                  <View key={day} style={styles.calendarCell}>
                    <Text style={[styles.weekdayText, isDarkTheme && styles.darkMutedText]}>{day}</Text>
                  </View>
                )
              )}

              {calendarCells.map((day, index) => {
                if (day === null) {
                  return (
                    <View
                      key={`blank-${index}`}
                      style={styles.calendarCell}
                    />
                  );
                }

                const date = new Date(
                  calendarYear,
                  calendarMonth,
                  day
                );

                const dateKey = getLocalDateKey(date);

                const dayEntries = entriesByDate.get(dateKey) ?? [];

                const isSelected =
                  selectedDateKey === dateKey;
                const isToday = getLocalDateKey(new Date()) === dateKey;

                return (
                  <Pressable
                    key={day}
                    onPress={() => selectCalendarDate(date)}
                    accessibilityRole="button"
                    accessibilityLabel={`${date.toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}${dayEntries.length > 0 ? `, ${dayEntries.length} reflections` : ''}`}
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.calendarCell,
                      styles.dayCell,
                      isToday && styles.calendarToday,
                      isSelected && styles.selectedDay,
                      isDarkTheme && !isSelected && styles.darkDayCell,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isDarkTheme && styles.darkText,
                        isSelected && styles.selectedDayText,
                      ]}
                    >
                      {day}
                    </Text>

                    {dayEntries.length > 0 && (
                      <Text style={styles.dayEmoji}>
                        {dayEntries[0].emoji}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text
  style={[
    styles.recentTitle,
    isDarkTheme && styles.darkText,
  ]}
>
            Reflections for {selectedDateLabel}
          </Text>

          {selectedDateEntries.length === 0 ? (
            <View style={[styles.emptyCard, isDarkTheme && styles.darkCard]}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={[styles.emptyTitle, isDarkTheme && styles.darkText]}>
                No reflections on this date
              </Text>
              <Text style={[styles.emptyText, isDarkTheme && styles.darkMutedText]}>
                Select another date to explore your journal.
              </Text>
            </View>
          ) : (
            selectedDateEntries.map((entry) => (
              <Animated.View
                key={entry.id}
                entering={reduceMotion ? undefined : ENTRY_ENTERING}
                style={[styles.entryCard, isDarkTheme && styles.darkCard]}
              >
                <Text style={[styles.entryMood, isDarkTheme && styles.darkText]}>
                  {entry.emoji} {entry.mood}
                </Text>

                <Text style={[styles.entryNote, isDarkTheme && styles.darkText]}>{entry.note}</Text>

                <View style={styles.entryActions}>
                  <Pressable
                    onPress={() => startEditing(entry)}
                    style={[styles.editButton, isDarkTheme && styles.darkEditButton]}
                  >
                    <Text style={[styles.editText, isDarkTheme && styles.darkEditText]}>Edit</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => deleteReflection(entry.id)}
                    style={[styles.deleteButton, isDarkTheme && styles.darkDeleteButton]}
                  >
                    <Text style={[styles.deleteText, isDarkTheme && styles.darkDeleteText]}>Delete</Text>
                  </Pressable>
                </View>
              </Animated.View>
            ))
          )}
        </>
      ) : (
        <>
        <View style={[styles.settingsCard, isDarkTheme && styles.darkCard]}>
  <Text style={styles.settingsIcon}>🔐</Text>

  <Text
    style={[
      styles.settingsSectionTitle,
      isDarkTheme && styles.darkText,
    ]}
  >
    Change Password
  </Text>

  <Text
    style={[
      styles.settingsDescription,
      isDarkTheme && styles.darkMutedText,
    ]}
  >
    Keep your account secure by updating your password regularly.
  </Text>

  <TextInput
    value={newPassword}
    onChangeText={(value) => {
      setNewPassword(value);
      setPasswordMessage('');
    }}
    placeholder="Enter new password"
    placeholderTextColor="#898394"
    secureTextEntry
    style={[styles.profileInput, isDarkTheme && styles.darkInput]}
  />

  <TextInput
    value={confirmPassword}
    onChangeText={(value) => {
      setConfirmPassword(value);
      setPasswordMessage('');
    }}
    placeholder="Confirm new password"
    placeholderTextColor="#898394"
    secureTextEntry
    style={[styles.profileInput, isDarkTheme && styles.darkInput]}
  />

  <Pressable
    onPress={changePassword}
    style={styles.settingsSaveButton}
  >
    <Text style={styles.settingsSaveButtonText}>
      Update Password
    </Text>
  </Pressable>

  {!!passwordMessage && (
    <Text style={[styles.settingsMessage, isDarkTheme && styles.darkMutedText]}>
      {passwordMessage}
    </Text>
  )}
</View>
          <View style={[styles.settingsCard, isDarkTheme && styles.darkCard]}>
            <Text style={styles.settingsIcon}>👋</Text>
            <Text style={[styles.settingsTitle, isDarkTheme && styles.darkText]}>Your profile</Text>
            <Text style={[styles.settingsDescription, isDarkTheme && styles.darkMutedText]}>
              Add a name to make your personal journal feel like yours.
            </Text>
            <TextInput
              value={profileInput}
              onChangeText={(value) => {
                setProfileInput(value);
                setSettingsMessage('');
              }}
              placeholder="Enter your display name"
              placeholderTextColor="#898394"
              maxLength={40}
              style={[styles.profileInput, isDarkTheme && styles.darkInput]}
            />
            <Pressable onPress={saveProfile} style={styles.settingsSaveButton}>
              <Text style={styles.settingsSaveButtonText}>Save profile</Text>
            </Pressable>
            {!!settingsMessage && (
              <Text style={[styles.settingsMessage, isDarkTheme && styles.darkMutedText]}>{settingsMessage}</Text>
            )}
            {!!profileName && (
              <Text style={[styles.profileGreeting, isDarkTheme && styles.darkMutedText]}>Your journal belongs to {profileName}.</Text>
            )}
          </View>
          <View style={[styles.settingsCard, isDarkTheme && styles.darkCard]}>
            <Text style={styles.settingsIcon}>🔔</Text>
            <Text style={[styles.settingsSectionTitle, isDarkTheme && styles.darkText]}>
              Daily reminder
            </Text>
            <Text style={[styles.settingsDescription, isDarkTheme && styles.darkMutedText]}>
              Choose a gentle local reminder time. Notifications are scheduled on this device and
              do not include your journal entries.
            </Text>
            <TextInput
              value={reminderTime}
              onChangeText={(value) => {
                setReminderTime(value);
                setReminderMessage('');
              }}
              placeholder="20:00"
              placeholderTextColor="#898394"
              maxLength={5}
              editable={Platform.OS !== 'web' && !isUpdatingReminder}
              accessibilityLabel="Daily reminder time in 24-hour format"
              keyboardType="numbers-and-punctuation"
              style={[styles.profileInput, isDarkTheme && styles.darkInput]}
            />
            <Text style={[styles.reminderHint, isDarkTheme && styles.darkMutedText]}>
              Enter your local time in 24-hour format, such as 20:00.
            </Text>
            {Platform.OS === 'web' ? (
              <Text style={[styles.reminderHint, isDarkTheme && styles.darkMutedText]}>
                Daily notifications are supported on iOS and Android, not in the web version.
              </Text>
            ) : (
              <>
                <Pressable
                  onPress={() => updateDailyReminder(true)}
                  disabled={isUpdatingReminder}
                  accessibilityRole="button"
                  style={[
                    styles.settingsSaveButton,
                    styles.reminderEnableButton,
                    isUpdatingReminder && styles.disabledButton,
                  ]}
                >
                  <Text style={styles.settingsSaveButtonText}>
                    {isUpdatingReminder
                      ? 'Saving reminder...'
                      : reminderEnabled
                        ? 'Update reminder time'
                        : 'Enable daily reminder'}
                  </Text>
                </Pressable>
                {reminderEnabled && (
                  <Pressable
                    onPress={() => updateDailyReminder(false)}
                    disabled={isUpdatingReminder}
                    accessibilityRole="button"
                    style={[
                      styles.reminderDisableButton,
                      isDarkTheme && styles.darkReminderDisableButton,
                      isUpdatingReminder && styles.disabledButton,
                    ]}
                  >
                    <Text
                      style={[
                        styles.reminderDisableButtonText,
                        isDarkTheme && styles.darkReminderDisableButtonText,
                      ]}
                    >
                      Turn reminder off
                    </Text>
                  </Pressable>
                )}
              </>
            )}
            {!!reminderMessage && (
              <Text style={[styles.settingsMessage, isDarkTheme && styles.darkMutedText]}>
                {reminderMessage}
              </Text>
            )}
          </View>
          <View style={[styles.settingsCard, isDarkTheme && styles.darkCard]}>
            <Text style={styles.settingsIcon}>📔</Text>
            <Text style={[styles.settingsSectionTitle, isDarkTheme && styles.darkText]}>Your journal data</Text>
            <View style={styles.settingsRow}>
              <Text style={[styles.settingsLabel, isDarkTheme && styles.darkMutedText]}>Saved reflections</Text>
              <Text style={[styles.settingsValue, isDarkTheme && styles.darkBrand]}>{totalEntries}</Text>
            </View>
            <View style={[styles.settingsDivider, isDarkTheme && styles.darkSettingsDivider]} />
            <Text style={[styles.settingsDescription, isDarkTheme && styles.darkMutedText]}>
              Your reflections are saved securely to your MoodCanvas account in Supabase.
              Sign in to access your journal on another device. Keep your account
              password private and sign out when using a shared device.
            </Text>
          </View>
          <View style={[styles.settingsCard, isDarkTheme && styles.darkCard]}>
  <Text style={styles.settingsIcon}>🔄</Text>

  <Text
    style={[
      styles.settingsSectionTitle,
      isDarkTheme && styles.darkText,
    ]}
  >
    Cloud Sync
  </Text>

  <Text
    style={[
      styles.settingsDescription,
      isDarkTheme && styles.darkMutedText,
    ]}
  >
    Manually refresh your journal to get the latest reflections
    saved to your account.
  </Text>

  <Pressable
    onPress={refreshJournal}
    disabled={isRefreshing}
    style={[
      styles.settingsSaveButton,
      isRefreshing && { opacity: 0.6 },
    ]}
  >
    <Text style={styles.settingsSaveButtonText}>
      {isRefreshing ? 'Syncing...' : 'Refresh Journal'}
    </Text>
  </Pressable>

  {!!syncMessage && (
    <Text style={[styles.settingsMessage, isDarkTheme && styles.darkMutedText]}>
      {syncMessage}
    </Text>
  )}
</View>

          <View style={[styles.settingsCard, isDarkTheme && styles.darkCard]}>
            <Text style={styles.settingsIcon}>📥</Text>
            <Text style={[styles.settingsSectionTitle, isDarkTheme && styles.darkText]}>Back up your reflections</Text>
            <Text style={[styles.settingsDescription, isDarkTheme && styles.darkMutedText]}>
              Download a JSON backup containing your saved moods, dates, and reflection notes.
              Keep the file somewhere safe. It can be used as a personal copy of your journal.
            </Text>
            <Pressable onPress={exportReflections} style={styles.settingsSaveButton}>
              <Text style={styles.settingsSaveButtonText}>Download journal backup</Text>
            </Pressable>
            {!!exportMessage && (
              <Text style={[styles.settingsMessage, isDarkTheme && styles.darkMutedText]}>{exportMessage}</Text>
            )}
          </View>

          <View style={[styles.settingsCard, isDarkTheme && styles.darkCard]}>
            <Text style={styles.settingsIcon}>🎨</Text>
            <Text style={[styles.settingsSectionTitle, isDarkTheme && styles.darkText]}>Appearance</Text>
            <Text style={[styles.settingsDescription, isDarkTheme && styles.darkMutedText]}>
              Choose how MoodCanvas looks on this device. Your preference is saved automatically.
            </Text>
            <View style={styles.themeOptions}>
              {([
                { key: 'light', label: '☀️  Light' },
                { key: 'dark', label: '🌙  Dark' },
                { key: 'system', label: '🖥️  System' },
              ] as { key: ThemeMode; label: string }[]).map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => changeTheme(option.key)}
                  style={[
                    styles.themeOption,
                    isDarkTheme && styles.darkThemeOption,
                    themeMode === option.key &&
                      (isDarkTheme ? styles.darkThemeOptionSelected : styles.themeOptionSelected),
                  ]}
                >
                  <Text style={[styles.themeOptionText, isDarkTheme && styles.darkText]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            {!!themeMessage && <Text style={[styles.settingsMessage, isDarkTheme && styles.darkMutedText]}>{themeMessage}</Text>}
          </View>

<View style={[styles.settingsCard, isDarkTheme && styles.darkCard]}>
  <Text style={styles.settingsIcon}>🔒</Text>
  <Text style={[styles.settingsSectionTitle, isDarkTheme && styles.darkText]}>
    Privacy
  </Text>
  <Text style={[styles.settingsDescription, isDarkTheme && styles.darkMutedText]}>
    Your journal is connected to your account and stored in Supabase with
    account-level access policies. Only your account should access your
    reflections. Avoid entering passwords, financial details, or other
    highly sensitive information.
  </Text>
</View>

<View style={[styles.settingsCard, isDarkTheme && styles.darkCard]}>
  <Text style={styles.settingsIcon}>👤</Text>
  <Text style={[styles.settingsSectionTitle, isDarkTheme && styles.darkText]}>
    Your account
  </Text>
  <Text style={[styles.settingsDescription, isDarkTheme && styles.darkMutedText]}>
    Your account details and security settings.
  </Text>
  <Text
  style={[
    styles.settingsDescription,
    isDarkTheme && styles.darkMutedText,
    { marginTop: 8, fontWeight: '600' },
  ]}
>
  Email: {userEmail ?? 'Not available'}
</Text>

  <Pressable
    onPress={async () => {
      const { error } = await supabase.auth.signOut();

      if (error) {
        Alert.alert('Sign out failed', error.message);
      }
    }}
    style={[styles.signOutButton, isDarkTheme && styles.darkSignOutButton]}
  >
    <Text style={[styles.signOutButtonText, isDarkTheme && styles.darkSignOutButtonText]}>
      Sign Out
    </Text>
  </Pressable>
</View>


          <View style={[styles.settingsCard, isDarkTheme && styles.darkCard]}>
            <Text style={styles.settingsIcon}>🌿</Text>
            <Text style={[styles.settingsSectionTitle, isDarkTheme && styles.darkText]}>A gentle reminder</Text>
            <Text style={[styles.settingsDescription, isDarkTheme && styles.darkMutedText]}>
              Your mood entries are personal reflections, not a diagnosis.
              Take your time and use this space in the way that feels right
              for you.
            </Text>
          </View>

          <Text style={[styles.settingsVersion, isDarkTheme && styles.darkMutedText]}>MoodCanvas · Version 2.2</Text>
        </>
      )}
      </Animated.View>

          {isDesktop && (
            <Text style={styles.footer}>Your day matters. So do you.</Text>
          )}
        </ScrollView>
      </View>

      {!isDesktop && (
        <View
          style={[
            styles.bottomNav,
            isDarkTheme && styles.darkSurface,
            { paddingBottom: Math.max(10, insets.bottom) },
          ]}
        >
          {navigationItems.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => navigateToTab(item.key)}
              accessibilityRole="tab"
              accessibilityLabel={`${item.label} section`}
              accessibilityState={{ selected: activeTab === item.key }}
              hitSlop={6}
              style={styles.bottomNavItem}
            >
              <View
                style={[
                  styles.bottomNavIconWrap,
                  activeTab === item.key && styles.bottomNavIconWrapActive,
                  isDarkTheme && activeTab === item.key && styles.darkBottomNavIconWrapActive,
                ]}
              >
                <Text style={styles.bottomNavIcon}>{item.icon}</Text>
              </View>
              <Text
                style={[
                  styles.bottomNavText,
                  isDarkTheme && styles.darkMutedText,
                  activeTab === item.key &&
                    (isDarkTheme ? styles.darkBottomNavTextActive : styles.bottomNavTextActive),
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error('Checking login session failed:', error);
      }

      setSession(data?.session ?? null);
      setCheckingAuth(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setCheckingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (checkingAuth) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#F8F6FC',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="small" color="#67539B" />
        <Text style={{ color: '#67539B', fontSize: 16 }}>
          Loading MoodCanvas...
        </Text>
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <JournalApp key={session.user.id} />;
}

const styles = StyleSheet.create({
  darkAppShell: { backgroundColor: '#15121C' },
  darkScreen: { backgroundColor: '#15121C' },
  darkSurface: { backgroundColor: '#1E1A27', borderColor: '#3D3749' },
  darkCard: {
    backgroundColor: '#231F2E',
    borderColor: '#443D52',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
  },
  darkStatCard: { backgroundColor: '#51416F' },
  darkInput: {
    backgroundColor: '#1A1721',
    borderColor: '#51465F',
    color: '#F5F1FC',
  },
  darkMoodOption: { backgroundColor: '#2B2638', borderColor: '#51465F' },
  darkSelectedMood: { backgroundColor: '#51416F', borderColor: '#B7A7DE', borderWidth: 1.5 },
  darkMoodLabel: { color: '#F5F1FC' },
  darkEditButton: { backgroundColor: '#342B45', borderWidth: 1, borderColor: '#786996' },
  darkEditText: { color: '#E3DCF2' },
  darkDeleteButton: { backgroundColor: '#492B3A', borderWidth: 1, borderColor: '#754256' },
  darkDeleteText: { color: '#FFD3DF' },
  darkText: { color: '#F5F1FC' },
  darkMutedText: { color: '#B9B0C7' },
  darkBrand: { color: '#B7A7DE' },
  darkThemeOption: { backgroundColor: '#2B2638', borderColor: '#51465F' },
  darkThemeOptionSelected: { backgroundColor: '#51416F', borderColor: '#B7A7DE' },
  darkSidebarItemActive: { backgroundColor: '#2B2638', borderColor: '#51465F' },
  darkSidebarItemTextActive: { color: '#D3C7EA' },
  darkBottomNavIconWrapActive: { backgroundColor: '#342B45' },
  darkBottomNavTextActive: { color: '#D3C7EA' },
  darkPeriodButton: { backgroundColor: '#2B2638' },
  darkPeriodButtonText: { color: '#D3C7EA' },
  darkPeriodSelector: { backgroundColor: '#231F2E' },
  darkPeriodButtonActive: { backgroundColor: '#51416F' },
  darkPeriodButtonTextActive: { color: '#F5F1FC' },
  darkInsightTitle: { color: '#D3C7EA' },
  darkDayCell: { backgroundColor: '#2B2638' },
  darkCalendarTodayButton: { backgroundColor: '#2B2638' },
  darkCalendarTodayButtonText: { color: '#D3C7EA' },
  darkChartEmptyState: { backgroundColor: '#2B2638' },
  darkMonthButton: { backgroundColor: '#342B45' },
  darkMonthButtonText: { color: '#D3C7EA' },
  darkProgressTrack: { backgroundColor: '#30283D' },
  darkSettingsDivider: { backgroundColor: '#443D52' },
  darkCancelText: { color: '#D3C7EA' },
  darkSignOutButton: { backgroundColor: '#492B3A' },
  darkSignOutButtonText: { color: '#FFD3DF' },
  darkAvatar: { backgroundColor: '#342B45' },
  darkFilterChip: { backgroundColor: '#251F31', borderColor: '#51465F' },
  darkFilterChipActive: { backgroundColor: '#51416F', borderColor: '#B7A7DE' },
  darkFilterChipTextActive: { color: '#F5F1FC' },
  darkSearchFieldWrap: { backgroundColor: '#1A1721', borderColor: '#51465F' },
  darkSortRow: { borderTopColor: '#443D52' },
  darkReminderDisableButton: { backgroundColor: '#2B2638', borderColor: '#51465F' },
  darkReminderDisableButtonText: { color: '#D3C7EA' },
  themeOptions: { flexDirection: 'row', gap: 9, marginTop: 16, flexWrap: 'wrap' },
  themeOption: { flex: 1, minWidth: 105, minHeight: 48, paddingVertical: 13, paddingHorizontal: 10, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F6FC', borderWidth: 1, borderColor: '#EAE6F2' },
  themeOptionSelected: { backgroundColor: '#EEE9F8', borderColor: '#8975BC', borderWidth: 2 },
  themeOptionText: { color: '#3D384A', fontSize: 13, fontWeight: '600' },
  signOutButton: {
    backgroundColor: '#FCE8E8',
    padding: 14,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  signOutButtonText: { color: '#B42318', fontWeight: '700' },
  periodSelector: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#EEE9F8',
    marginBottom: 20,
    gap: 6,
  },
  periodButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 13,
    backgroundColor: 'transparent',
  },
  periodButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#302B3D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 1,
  },
  periodButtonText: { color: '#67539B', fontWeight: '600' },
  periodButtonTextActive: { color: '#51416F' },
  compactStatCard: { flex: 1, minWidth: 0, padding: 16, marginBottom: 20 },
  compactStatLabel: { fontSize: 10, letterSpacing: 0.6 },
  compactStatNumber: { fontSize: 34 },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  brandCaption: {
    color: '#888196',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAE6F2',
    borderWidth: 1,
    borderColor: '#E2DDEC',
  },
  avatarText: { color: '#67539B', fontSize: 15, fontWeight: '700' },
  sidebarComposeButton: {
    marginTop: 32,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#67539B',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sidebarComposeIcon: { color: '#FFFFFF', fontSize: 22, lineHeight: 24 },
  sidebarComposeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  quickComposeButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: -12,
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#67539B',
    borderRadius: 15,
  },
  quickComposeIcon: { color: '#FFFFFF', fontSize: 19, lineHeight: 20 },
  quickComposeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  journalTools: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE6F2',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  searchFieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 13,
    marginBottom: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E2DDEC',
    backgroundColor: '#F8F6FC',
  },
  searchIcon: { fontSize: 24, color: '#777186', marginRight: 9 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    color: '#302B3D',
    fontSize: 14,
  },
  filterLabel: {
    color: '#888196',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  filterList: { gap: 8, paddingBottom: 16 },
  filterChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: '#F8F6FC',
    borderWidth: 1,
    borderColor: '#EAE6F2',
  },
  filterChipActive: { backgroundColor: '#EEE9F8', borderColor: '#B3A4D8' },
  filterChipText: { color: '#736D81', fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#67539B' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EAE6F2',
  },
  sortOptions: { flexDirection: 'row', gap: 6 },
  sortButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F8F6FC',
  },
  sortButtonActive: { backgroundColor: '#67539B' },
  sortButtonText: { color: '#736D81', fontSize: 12, fontWeight: '600' },
  sortButtonTextActive: { color: '#FFFFFF' },
  clearFiltersButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#EEE9F8',
  },
  clearFiltersText: { color: '#67539B', fontWeight: '700', fontSize: 13 },
  appShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8F6FC',
  },
  mobileAppShell: {
    flexDirection: 'column',
  },
  mainArea: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  tabContent: {
    width: '100%',
  },
  desktopContent: {
    maxWidth: 1080,
    paddingTop: 46,
    paddingHorizontal: 48,
  },
  sidebar: {
    width: 264,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#EAE6F2',
    paddingHorizontal: 22,
    paddingTop: 40,
    paddingBottom: 24,
  },
  sidebarBrand: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#67539B',
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  sidebarCaption: {
    color: '#898394',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.2,
    paddingHorizontal: 10,
    marginBottom: 34,
  },
  sidebarNav: {
    gap: 10,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    minHeight: 50,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 16,
  },
  sidebarItemActive: {
    backgroundColor: '#EEE9F8',
    borderWidth: 1,
    borderColor: '#EAE6F2',
    shadowColor: '#67539B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  sidebarItemText: {
    color: '#736D81',
    fontSize: 15,
    fontWeight: '600',
  },
  sidebarItemTextActive: {
    color: '#67539B',
  },
  navIcon: {
    fontSize: 18,
  },
  sidebarFooter: {
    marginTop: 'auto',
    paddingHorizontal: 10,
    color: '#898394',
    fontSize: 12,
    lineHeight: 19,
  },
  mobileNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 5,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EAE6F2',
  },
  mobileNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  mobileNavItemActive: {
    backgroundColor: '#EAE6F2',
  },
  mobileNavIcon: {
    fontSize: 17,
    marginBottom: 4,
  },
  mobileNavText: {
    fontSize: 11,
    color: '#777186',
    fontWeight: '600',
  },
  mobileNavTextActive: {
    color: '#67539B',
  },
  bottomNav: {
    width: '100%',
    flexShrink: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EAE6F2',
    paddingTop: 9,
    paddingBottom: 10,
    paddingHorizontal: 8,
    shadowColor: '#211D2A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.045,
    shadowRadius: 10,
    elevation: 8,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 54,
  },
  bottomNavIconWrap: {
    minWidth: 56,
    minHeight: 38,
    alignItems: 'center',
    borderRadius: 15,
    paddingVertical: 5,
  },
  bottomNavIconWrapActive: {
    backgroundColor: '#EAE6F2',
  },
  bottomNavIcon: {
    fontSize: 19,
  },
  bottomNavText: {
    fontSize: 11,
    color: '#777186',
    fontWeight: '600',
  },
  bottomNavTextActive: {
    color: '#67539B',
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 25,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EAE6F2',
    shadowColor: '#2C253A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 14,
    elevation: 1,
  },
  settingsIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  profileInput: {
    borderWidth: 1,
    borderColor: '#E2DDEC',
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 18,
    marginBottom: 12,
    color: '#302B3D',
    backgroundColor: '#FFFFFF',
    fontSize: 15,
  },
  settingsSaveButton: {
    backgroundColor: '#67539B',
    minHeight: 50,
    borderRadius: 15,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  settingsMessage: {
    color: '#67539B',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  reminderHint: {
    color: '#777186',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 12,
  },
  reminderEnableButton: {
    marginTop: 8,
  },
  reminderDisableButton: {
    minHeight: 46,
    marginTop: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EAE6F2',
    backgroundColor: '#F8F6FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderDisableButtonText: {
    color: '#67539B',
    fontSize: 14,
    fontWeight: '700',
  },
  profileGreeting: {
    color: '#6E687C',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#302B3D',
    marginBottom: 10,
  },
  settingsSectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#302B3D',
    marginBottom: 16,
  },
  settingsDescription: {
    color: '#6E687C',
    fontSize: 14,
    lineHeight: 22,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  settingsLabel: {
    color: '#534D5E',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsValue: {
    color: '#67539B',
    fontSize: 17,
    fontWeight: 'bold',
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#EAE6F2',
    marginBottom: 14,
  },
  settingsVersion: {
    textAlign: 'center',
    color: '#898394',
    fontSize: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  screen: {
    flex: 1,
    backgroundColor: '#F8F6FC',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 56,
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
  },
  brand: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#67539B',
    marginBottom: 6,
  },
  greeting: {
    fontSize: 34,
    fontWeight: '800',
    color: '#302B3D',
    letterSpacing: -0.7,
    lineHeight: 42,
    marginBottom: 9,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: '#777186',
    marginBottom: 32,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#EAE6F2',
    padding: 5,
    borderRadius: 14,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#67539B',
  },
  tabText: {
    color: '#736D81',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 26,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EAE6F2',
    shadowColor: '#2C253A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#302B3D',
    marginBottom: 16,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  moodOption: {
    width: '30%',
    minHeight: 88,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 17,
    borderRadius: 20,
    backgroundColor: '#F8F6FC',
    borderWidth: 1,
    borderColor: '#EAE6F2',
  },
  selectedMood: {
    backgroundColor: '#EEE9F8',
    borderColor: '#8975BC',
    borderWidth: 1.5,
  },
  emoji: {
    fontSize: 27,
    marginBottom: 6,
  },
  moodLabel: {
    fontSize: 13,
    color: '#4C4658',
  },
  input: {
    minHeight: 132,
    borderWidth: 1,
    borderColor: '#E2DDEC',
    borderRadius: 18,
    padding: 16,
    fontSize: 15,
    lineHeight: 23,
    color: '#302B3D',
    backgroundColor: '#FFFFFF',
    marginBottom: 18,
  },
  saveButton: {
    backgroundColor: '#67539B',
    paddingVertical: 17,
    paddingHorizontal: 18,
    minHeight: 52,
    borderRadius: 17,
    alignItems: 'center',
    shadowColor: '#67539B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  cancelButton: {
    alignItems: 'center',
    padding: 13,
    marginTop: 5,
  },
  cancelText: {
    color: '#67539B',
    fontWeight: '600',
  },
  message: {
    marginTop: 14,
    color: '#67539B',
    fontSize: 14,
    textAlign: 'center',
  },
  recentTitle: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#302B3D',
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAE6F2',
  },
  emptyEmoji: {
    fontSize: 34,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#3D384A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#777186',
    textAlign: 'center',
    lineHeight: 21,
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 23,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EAE6F2',
    shadowColor: '#2C253A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.035,
    shadowRadius: 14,
    elevation: 1,
  },
  calendarToday: {
    borderWidth: 1,
    borderColor: '#B3A4D8',
  },
  entryMood: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3D384A',
    marginBottom: 5,
  },
  entryDate: {
    fontSize: 12,
    color: '#888196',
    marginBottom: 12,
  },
  entryNote: {
    fontSize: 15,
    lineHeight: 24,
    color: '#534D5E',
  },
  entryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  editButton: {
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: '#EEE9F8',
  },
  editText: {
    color: '#67539B',
    fontWeight: '600',
  },
  deleteButton: {
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: '#F8EAF0',
  },
  deleteText: {
    color: '#A33D60',
    fontWeight: '600',
  },
  statCard: {
    backgroundColor: '#67539B',
    borderRadius: 24,
    padding: 25,
    marginBottom: 28,
  },
  statLabel: {
    color: '#EEE9F8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  statNumber: {
    fontSize: 44,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginVertical: 8,
  },
  statDescription: {
    fontSize: 14,
    color: '#E5DCF5',
  },
  moodStat: {
    marginBottom: 22,
  },
  moodStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 9,
  },
  moodStatName: {
    color: '#3D384A',
    fontSize: 14,
    fontWeight: '600',
  },
  moodStatCount: {
    color: '#777186',
    fontSize: 13,
  },
  progressTrack: {
    height: 9,
    backgroundColor: '#EAE6F2',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8975BC',
    borderRadius: 10,
  },
  insightEmptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  chartEmptyState: {
    minHeight: 188,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 10,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#F0ECF7',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    padding: 26,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAE6F2',
    marginBottom: 20,
  },
  insightEmoji: {
    fontSize: 34,
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#67539B',
    marginBottom: 10,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    color: '#777186',
    textAlign: 'center',
    marginBottom: 16,
  },

  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarTodayButton: {
    alignSelf: 'flex-end',
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 13,
    marginTop: -12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#F0ECF7',
  },
  calendarTodayButtonText: {
    color: '#67539B',
    fontSize: 13,
    fontWeight: '700',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#302B3D',
  },
  monthButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EEE9F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthButtonText: {
    fontSize: 26,
    color: '#67539B',
    fontWeight: 'bold',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.2857%',
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#777186',
  },
  dayCell: {
    borderRadius: 16,
    marginVertical: 3,
  },
  dayText: {
    fontSize: 14,
    color: '#3D384A',
  },
  selectedDay: {
    backgroundColor: '#67539B',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  dayEmoji: {
    fontSize: 10,
    marginTop: 2,
  },

  footer: {
    textAlign: 'center',
    color: '#888196',
    marginTop: 30,
    fontSize: 13,
  },
});
