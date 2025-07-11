// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import { useSession } from '@clerk/clerk-react';
import React from 'react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function useSupabase() {
  const { session } = useSession();

  const supabase = React.useMemo(() => {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          'X-Client-Info': 'image-copilot-history'
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        accessToken: () => session?.getToken(),
      },
    });
  }, [session?.id]);

  return supabase;
} 