import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { usePlans } from './PlansContext';

export const PAYMENT_METHODS = {
  gcash: 'GCash',
  maya: 'Maya',
  card: 'Credit / Debit Card',
  gym: 'Pay at the Gym',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const formatDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

export const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - new Date()) / 86400000));

// none | pending | active | expired
export const getStatus = (subscription) => {
  if (!subscription) return 'none';
  if (subscription.status === 'pending') return 'pending';
  return new Date() >= new Date(subscription.endDate) ? 'expired' : 'active';
};

// ---------------------------------------------------------------------------
// The rules live in the database (see phase2.sql). The app only asks:
// subscribe, pay, renew, change plan, cancel. The database checks the rules,
// works out the dates and prices, and refuses duplicates.
// ---------------------------------------------------------------------------
const RULE_MESSAGES = {
  not_logged_in: 'Please log in first.',
  invalid_method: 'Choose a payment method.',
  plan_not_available: 'That plan is no longer available.',
  already_has_membership: 'You already have a membership in progress.',
  no_pending_membership: 'There is no membership waiting for payment.',
  no_membership_to_cancel: 'You have no membership to cancel.',
  online_payment_required: 'Renewals and upgrades are paid online. Choose GCash, Maya or Card.',
  nothing_to_renew: 'You have no membership to renew. Choose a plan to subscribe.',
  payment_pending: 'Finish paying your reserved membership first.',
  no_active_membership: 'You need an active membership to change plans.',
  same_plan: 'That is already your current plan.',
};

const ruleMessage = (error) => {
  const text = error?.message || '';
  const key = Object.keys(RULE_MESSAGES).find((k) => text.includes(k));
  return key ? RULE_MESSAGES[key] : 'Something went wrong. Check your internet and try again.';
};

const fetchAll = async () => {
  // Memberships that ran out are marked as expired first.
  try {
    await supabase.rpc('expire_my_memberships');
  } catch {
    // Not important enough to stop the screen from loading.
  }
  const [subs, pays] = await Promise.all([
    supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
    supabase.from('payments').select('*').order('paid_at', { ascending: false }),
  ]);
  if (subs.error) throw subs.error;
  if (pays.error) throw pays.error;
  return { rows: subs.data, payments: pays.data };
};

const PAYMENT_STATUS = { paid: 'Paid', pending: 'Pending', cancelled: 'Cancelled' };

const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }) => {
  const { user } = useAuth();
  const { getPlanById } = usePlans();
  const userId = user?.id ?? null;
  // Stored together with the member they belong to, so another member never
  // sees them after a log out and log in.
  const [store, setStore] = useState({ userId: null, rows: [], payments: [] });
  const [, setTimeCheck] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeCheck((previous) => previous + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    fetchAll()
      .then((data) => {
        if (!cancelled) setStore({ userId, ...data });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refresh = async () => {
    const data = await fetchAll();
    setStore({ userId, ...data });
  };

  const mine = store.userId === userId;
  const rows = mine ? store.rows : [];
  // The newest membership decides what the member sees. A cancelled one means
  // "no membership".
  const latest = rows[0] && rows[0].status !== 'cancelled' ? rows[0] : null;
  const subscription = latest
    ? {
        id: latest.id,
        planId: latest.plan_id,
        nextPlanId: latest.next_plan_id,
        method: latest.method,
        status: latest.status,
        startDate: latest.start_date,
        endDate: latest.end_date,
      }
    : null;
  const status = getStatus(subscription);

  const payments = (mine ? store.payments : []).map((row) => ({
    id: row.id,
    planId: row.plan_id,
    planName: getPlanById(row.plan_id)?.name ?? 'Membership',
    amount: row.amount,
    method: row.method,
    kind: row.kind,
    date: row.paid_at,
    status: PAYMENT_STATUS[row.status] ?? 'Paid',
  }));

  // Runs one database rule, then reloads. Returns { ok, data } or { ok: false, message }.
  const run = async (name, args) => {
    if (!userId) return { ok: false, message: 'Please log in first.' };
    const { data, error } = await supabase.rpc(name, args);
    try {
      await refresh();
    } catch {
      // The result below is still right; the screen catches up on the next load.
    }
    if (error) return { ok: false, message: ruleMessage(error) };
    return { ok: true, data };
  };

  const subscribe = async (plan, method) => {
    const res = await run('subscribe_to_plan', { p_plan_id: plan.id, p_method: method });
    return res.ok ? { ...res, pending: res.data?.result === 'pending' } : res;
  };
  const completePayment = (method) => run('complete_pending_payment', { p_method: method });
  const cancelSubscription = () => run('cancel_my_subscription');
  const renewSubscription = (method) => run('renew_my_subscription', { p_method: method });
  const changePlan = (planId, method) =>
    run('change_my_plan', { p_plan_id: planId, p_method: method ?? null });

  // What would changing to this plan cost? (shown before the member pays)
  const quoteChange = useCallback(async (planId) => {
    const { data, error } = await supabase.rpc('quote_plan_change', { p_plan_id: planId });
    if (error) return { ok: false, message: ruleMessage(error) };
    return { ok: true, quote: data };
  }, []);

  const value = {
    subscription,
    payments,
    status,
    subscribe,
    completePayment,
    cancelSubscription,
    renewSubscription,
    changePlan,
    quoteChange,
  };
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>.');
  return ctx;
};
