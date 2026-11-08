
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabase environment variables are missing. Check your root .env file.'
  );
}

// Use browser storage on Web and AsyncStorage on native.
const authStorage =
  Platform.OS === 'web'
    ? {
        getItem: async (key: string) => {
          if (typeof window === 'undefined') return null;
          return window.localStorage.getItem(key);
        },

        setItem: async (key: string, value: string) => {
          if (typeof window === 'undefined') return;
          window.localStorage.setItem(key, value);
        },

        removeItem: async (key: string) => {
          if (typeof window === 'undefined') return;
          window.localStorage.removeItem(key);
        },
      }
    : AsyncStorage;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
);
