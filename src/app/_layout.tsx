
import {
  DarkTheme,
  DefaultTheme, Stack, ThemeProvider
} from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider
      value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <SafeAreaProvider>
        <Head>
          <title>MoodCanvas — Your Personal Reflection Journal</title>
          <meta
            name="description"
            content="A private, thoughtful space to check in, record your moods, and reflect on your day."
          />
          <meta name="theme-color" content="#F8F6FC" />
        </Head>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
