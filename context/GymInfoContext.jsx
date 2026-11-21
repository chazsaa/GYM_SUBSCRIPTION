import { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const GymInfoContext = createContext({ gymInfo: {}, loading: true });

export function GymInfoProvider({ children }) {
  const [gymInfo, setGymInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setGymInfo({});
      setLoading(false);
      return () => { alive = false; };
    }
    setLoading(true);
    const load = async () => {
      try {
        const { data, error } = await supabase.from('gym_info').select('key, value');
        if (!error && alive) setGymInfo(Object.fromEntries((data || []).map((row) => [row.key, row.value])));
      } catch {
        // Keep the member home usable when gym details are temporarily offline.
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    // Live updates (needs the realtime publication from supabase/phase4_realtime.sql).
    const channel = supabase
      .channel('member-gym-info-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gym_info' }, load)
      .subscribe();
    // Fallback when realtime is off or the connection dropped while the app slept.
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') load();
    });
    return () => {
      alive = false;
      appState.remove();
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return <GymInfoContext.Provider value={{ gymInfo, loading }}>{children}</GymInfoContext.Provider>;
}

export const useGymInfo = () => useContext(GymInfoContext);
