
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Detect server-side rendering on web.
const isServer =
  Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_KEY,
  {
    auth: {
      // Do not save sessions between fresh application launches.
      persistSession: false,

      // Keep token refresh enabled while the app is running.
      autoRefreshToken: true,

      detectSessionInUrl: false,
    },
  }
);
