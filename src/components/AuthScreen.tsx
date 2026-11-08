import * as ExpoLinking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';

import { AnimatedPressable as Pressable } from '@/components/AnimatedPressable';
import { ThemePreferenceKey } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type ThemeMode = 'light' | 'dark' | 'system';

export default function AuthScreen() {
  const passwordInputRef = useRef<TextInput>(null);
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isConfirmationPending, setIsConfirmationPending] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const systemColorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDarkTheme =
    themeMode === 'dark' ||
    (themeMode === 'system' && systemColorScheme === 'dark');

  useEffect(() => {
    let active = true;

    async function loadThemePreference() {
      try {
        const savedTheme = await AsyncStorage.getItem(ThemePreferenceKey);
        if (
          active &&
          (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')
        ) {
          setThemeMode(savedTheme);
        }
      } catch (error) {
        console.error('Loading authentication appearance preference failed:', error);
      }
    }

    loadThemePreference();
    return () => {
      active = false;
    };
  }, []);

  async function handleAuthentication() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessage('Please enter your email and password.');
      return;
    }

    if (password.length < 8) {
      setMessage('Your password must contain at least 8 characters.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      if (isSignup) {
        const emailRedirectTo =
          Platform.OS === 'web'
            ? window.location.origin
            : ExpoLinking.createURL('/')
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo,
          },
        });

        if (error) throw error;

        if (data.session) {
          setMessage('Account created successfully!');
        } else {
          setIsConfirmationPending(true);
          setMessage(
            'Account created! Please check your email and click the confirmation link before logging in.'
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        setMessage('Login successful!');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.';

      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, isDarkTheme && styles.darkScreen]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.authContent,
          {
            paddingTop: Math.max(36, insets.top + 20),
            paddingBottom: Math.max(36, insets.bottom + 20),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.brandLockup}>
            <View style={[styles.brandMark, isDarkTheme && styles.darkBrandMark]}>
              <Text style={styles.brandMarkText}>m</Text>
            </View>
            <View>
              <Text style={[styles.logo, isDarkTheme && styles.darkAccentText]}>moodcanvas</Text>
              <Text style={[styles.tagline, isDarkTheme && styles.darkMutedText]}>
                A little space, just for you.
              </Text>
            </View>
          </View>

          <View style={[styles.card, isDarkTheme && styles.darkCard]}>
          <View style={styles.eyebrow}>
            <View style={styles.eyebrowDot} />
            <Text style={[styles.eyebrowText, isDarkTheme && styles.darkMutedText]}>
              YOUR PRIVATE REFLECTION SPACE
            </Text>
          </View>
          <Text style={[styles.title, isDarkTheme && styles.darkText]}>
            {isSignup ? 'Create your account' : 'Welcome back'}
          </Text>

          <Text style={[styles.description, isDarkTheme && styles.darkMutedText]}>
            {isSignup
              ? 'Start your personal reflection journey.'
              : 'Sign in to continue your reflection journey.'}
          </Text>

          <Text style={[styles.label, isDarkTheme && styles.darkText]}>Email address</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#898394"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            accessibilityLabel="Email address"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            editable={!loading}
            style={[styles.input, isDarkTheme && styles.darkInput]}
          />

          <Text style={[styles.label, isDarkTheme && styles.darkText]}>Password</Text>
          <TextInput
            ref={passwordInputRef}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor="#898394"
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            textContentType={isSignup ? 'newPassword' : 'password'}
            returnKeyType="go"
            accessibilityLabel="Password"
            onSubmitEditing={handleAuthentication}
            editable={!loading}
            style={[styles.input, isDarkTheme && styles.darkInput]}
          />

          <Pressable
            disabled={loading}
            onPress={handleAuthentication}
            accessibilityRole="button"
            accessibilityLabel={isSignup ? 'Create account' : 'Log in'}
            style={[styles.primaryButton, loading && styles.disabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isSignup ? 'Create account' : 'Log in'}
              </Text>
            )}
          </Pressable>

          {!!message && (
            <Text style={[styles.message, isDarkTheme && styles.darkAccentText]}>{message}</Text>
          )}

          {isConfirmationPending && (
            <Text style={[styles.helper, isDarkTheme && styles.darkMutedText]}>
              Once you confirm your email, return here and log in.
            </Text>
          )}

          <Pressable
            disabled={loading}
            accessibilityRole="button"
            onPress={() => {
              setIsSignup(!isSignup);
              setIsConfirmationPending(false);
              setMessage('');
            }}
            style={styles.switchButton}
          >
            <Text style={[styles.switchText, isDarkTheme && styles.darkAccentText]}>
              {isSignup
                ? 'Already have an account? Log in'
                : "Don't have an account? Sign up"}
            </Text>
          </Pressable>
          </View>

          <Text style={[styles.footer, isDarkTheme && styles.darkMutedText]}>
            Your feelings matter. Take a moment for yourself.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  darkScreen: {
    backgroundColor: '#15121C',
  },
  darkBrandMark: { backgroundColor: '#51416F' },
  darkCard: {
    backgroundColor: '#231F2E',
    borderColor: '#443D52',
  },
  darkText: {
    color: '#F5F1FC',
  },
  darkMutedText: {
    color: '#B9B0C7',
  },
  darkAccentText: {
    color: '#D3C7EA',
  },
  darkInput: {
    backgroundColor: '#1A1721',
    borderColor: '#51465F',
    color: '#F5F1FC',
  },
  screen: {
    flex: 1,
    backgroundColor: '#F8F6FC',
  },
  authContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  container: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  brandLockup: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 13,
    marginBottom: 30,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEE9F8',
  },
  brandMarkText: { color: '#67539B', fontSize: 27, fontWeight: '800' },
  logo: {
    color: '#67539B',
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  tagline: {
    color: '#777186',
    fontSize: 13,
    marginTop: 2,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  eyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#8975BC',
  },
  eyebrowText: {
    color: '#888196',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#EAE6F2',
    shadowColor: '#2C253A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.045,
    shadowRadius: 20,
    elevation: 2,
  },
  title: {
    fontSize: 29,
    fontWeight: '800',
    color: '#302B3D',
    marginBottom: 9,
    lineHeight: 36,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: '#777186',
    marginBottom: 25,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3D384A',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2DDEC',
    backgroundColor: '#FFFFFF',
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#302B3D',
    fontSize: 15,
    marginBottom: 19,
  },
  primaryButton: {
    backgroundColor: '#67539B',
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  message: {
    color: '#67539B',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 16,
  },
  helper: {
    color: '#777186',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  switchButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingTop: 16,
  },
  switchText: {
    color: '#67539B',
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    color: '#888196',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
