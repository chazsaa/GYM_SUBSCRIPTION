import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { subscriptionPlans, formatPeso } from '../data/subscriptionPlans';

// ---------------------------------------------------------------------------
// The membership plans come from the Supabase "plans" table, so a price or a
// description can be changed in the dashboard without a new app release.
// The photos stay in the app. If the database cannot be reached, the built-in
// list in data/subscriptionPlans.js is shown instead.
// ---------------------------------------------------------------------------
const fallbackPlans = subscriptionPlans.map((plan) => ({ ...plan, active: true }));

const fromRow = (row) => {
  const local = subscriptionPlans.find((plan) => plan.id === row.id);
  const benefits =
    Array.isArray(row.benefits) && row.benefits.length > 0 ? row.benefits : local?.benefits ?? [];
  return {
    id: row.id,
    name: row.name,
    days: row.days,
    amount: row.amount,
    price: formatPeso(row.amount),
    duration: row.duration_label || local?.duration || `${row.days} days`,
    bestFor: row.best_for || local?.bestFor || '',
    description: row.description || local?.description || '',
    benefits,
    access: row.access_note || local?.access || '',
    icon: row.icon || local?.icon || 'dumbbell',
    active: row.is_active,
  };
};

const PlansContext = createContext(null);

export const PlansProvider = ({ children }) => {
  const [allPlans, setAllPlans] = useState(fallbackPlans);
  const mounted = useRef(true);

  // Reloads the plans. Used on start, when the app returns to the foreground, and
  // by screens that must show current prices (Home, Payment).
  const refreshPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('plans').select('*').order('sort_order');
      if (!mounted.current || error || !data || data.length === 0) return;
      setAllPlans(data.map(fromRow));
    } catch {
      // No connection: keep what is already shown.
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refreshPlans();
    // Live updates (needs the realtime publication from supabase/phase4_realtime.sql).
    const channel = supabase
      .channel('member-plans-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans' }, refreshPlans)
      .subscribe();
    // Fallback when realtime is off or the connection dropped while the app slept.
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshPlans();
    });
    return () => {
      mounted.current = false;
      appState.remove();
      supabase.removeChannel(channel);
    };
  }, [refreshPlans]);

  // Home shows only the plans that are on sale. A member can still see the plan
  // they already have, even if it was switched off later.
  const plans = allPlans.filter((plan) => plan.active);
  const getPlanById = (id) => allPlans.find((plan) => String(plan.id) === String(id));

  return (
    <PlansContext.Provider value={{ plans, getPlanById, refreshPlans }}>{children}</PlansContext.Provider>
  );
};

export const usePlans = () => {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error('usePlans must be used inside <PlansProvider>.');
  return ctx;
};
