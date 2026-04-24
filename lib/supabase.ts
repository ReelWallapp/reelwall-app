import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL is missing');
}

if (!supabaseAnonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is missing');
}

const storage =
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});