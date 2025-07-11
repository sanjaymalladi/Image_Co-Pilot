// @ts-nocheck
import { useSupabase } from '../services/supabaseClient';
import React from 'react';

export function useHistory() {
  const supabase = useSupabase();

  const addHistory = React.useCallback(async (event: 'image_generated', payload: any) => {
    await supabase.from('history').insert({ event, payload });
  }, [supabase]);

  const fetchHistory = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }, [supabase]);

  return { addHistory, fetchHistory };
} 