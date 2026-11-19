import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { openCheckout } from '../lib/gateway';
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
export const formatDateTime = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(iso)}, ${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
};

export const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - new Date()) / 86400000));

// none | pending | active | expired
export const getStatus = (subscription) => {
  if (!subscription) return 'none';
  if (subscription.status === 'pending') return 'pending';
  return new Date() >= new Date(subscription.endDate) ? 'expired' : 'active';
};

// ---------------------------------------------------------------------------
// The rules live in the database (phase2.sql and phase3.sql). The app only
// asks: reserve, pay, schedule a change, cancel. A payment is first recorded
// as "pending". The membership changes only when the payment is confirmed:
// by the gym admin for cash, or by the payment gateway for online payments.
// ---------------------------------------------------------------------------
const RULE_MESSAGES = {
  not_logged_in: 'Please log in first.',
  invalid_method: 'Choose a payment method.',
  invalid_kind: 'Something went wrong. Please try again.',
  plan_not_available: 'That plan is no longer available.',
  already_has_membership: 'You already have a membership in progress.',
  no_membership_to_cancel: 'You have no membership to cancel.',
  online_payment_required: 'Choose GCash, Maya or Card for this payment.',
  nothing_to_renew: 'You have no membership to renew. Choose a plan to subscribe.',
  payment_pending: 'Finish paying your reserved membership first.',
  no_active_membership: 'You need an active membership to change plans.',
  same_plan: 'That is already your current plan.',
  not_an_upgrade: 'That plan is not an upgrade.',
  upgrade_requires_payment: 'Upgrading needs a payment.',
  simulation_disabled: 'Test payments are turned off.',
  admin_confirmation_required: 'Cash payments are confirmed by the gym admin.',
  payment_not_found: 'That payment was not found.',
  payment_not_pending: 'That payment was already handled.',
  not_admin: 'Only the gym admin can do this.',
  not_cash_payment: 'Only cash payments can be reviewed here.',
  cannot_review_own_payment: 'You cannot review your own payment.',
};

export const ruleMessage = (error) => {
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
  const [subs, pays, admin, mode] = await Promise.all([
    supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
    supabase.from('payments').select('*').order('created_at', { ascending: false }),
    supabase.from('admins').select('user_id').maybeSingle(),
    supabase.from('app_settings').select('value').eq('key', 'payments_mode').maybeSingle(),
  ]);
  if (subs.error) throw subs.error;
  if (pays.error) throw pays.error;
  return {
    rows: subs.data,
    payments: pays.data,
    isAdmin: !!admin.data,
    mode: mode.data?.value ?? 'simulated',
  };
};

const PAYMENT_STATUS = {
  paid: 'Paid',
  pending: 'Pending',
  rejected: 'Rejected',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }) => {
  const { user } = useAuth();
  const { getPlanById } = usePlans();
  const userId = user?.id ?? null;
  // Stored together with the member they belong to, so another member never
  // sees them after a log out and log in.
  const [store, setStore] = useState({
    userId: null,
    rows: [],
    payments: [],
    isAdmin: false,
    mode: 'simulated',
  });
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

  // Coming back to the app (for example after paying in the browser, or after
  // the admin confirmed a cash payment) shows the newest information.
  useEffect(() => {
    if (!userId) return undefined;
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchAll()
          .then((data) => setStore({ userId, ...data }))
          .catch(() => {});
      }
    });
    return () => listener.remove();
  }, [userId]);

  const refresh = async () => {
    const data = await fetchAll();
    setStore({ userId, ...data });
  };

  const mine = store.userId === userId;
  const rows = mine ? store.rows : [];
  const isAdmin = mine && store.isAdmin;
  const paymentsMode = mine ? store.mode : 'simulated';
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
    reference: row.reference,
    receiptNumber: row.receipt_number,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    date: row.paid_at || row.created_at,
    reason: row.rejection_reason,
    verifiedByAdmin: !!row.reviewed_by && row.status === 'paid',
    status: PAYMENT_STATUS[row.status] ?? 'Paid',
  }));
  const pendingPayment = payments.find((p) => p.status === 'Pending') ?? null;

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

  // PAY AT THE GYM: the membership is reserved and a pending cash payment is
  // recorded. The gym admin confirms it when the cash is paid.
  const reserveMembership = (planId) => run('reserve_membership', { p_plan_id: planId });

  // PAY ONLINE: kind is 'new', 'renewal' or 'upgrade'. The payment is recorded
  // first; the membership changes only once the payment is confirmed.
  const startPayment = async (kind, planId, method) => {
    const started = await run('start_payment', { p_kind: kind, p_plan_id: planId, p_method: method });
    if (!started.ok) return started;
    const payment = started.data;
    if (payment.status === 'paid') return { ok: true, data: payment, paid: true };

    if ((payment.mode ?? paymentsMode) === 'simulated') {
      // Test mode: pretend the gateway confirmed the payment.
      const confirmed = await run('confirm_simulated_payment', { p_payment_id: payment.payment_id });
      if (!confirmed.ok) return confirmed;
      return {
        ok: true,
        data: { ...payment, ...confirmed.data },
        paid: confirmed.data?.result === 'paid',
      };
    }

    // Real gateway: open its checkout page. The webhook confirms the payment.
    const opened = await openCheckout(payment.payment_id);
    try {
      await refresh();
    } catch {
      // Fine: the app refreshes again when it comes back to the foreground.
    }
    if (!opened.ok) return opened;
    return { ok: true, data: payment, paid: false, redirected: true };
  };

  // Downgrade (or undo a scheduled downgrade): no payment involved.
  const scheduleChange = (planId) => run('schedule_plan_change', { p_plan_id: planId });
  const cancelSubscription = () => run('cancel_my_subscription');

  // What would changing to this plan cost? (shown before the member pays)
  const quoteChange = useCallback(async (planId) => {
    const { data, error } = await supabase.rpc('quote_plan_change', { p_plan_id: planId });
    if (error) return { ok: false, message: ruleMessage(error) };
    return { ok: true, quote: data };
  }, []);

  const value = {
    subscription,
    payments,
    pendingPayment,
    status,
    isAdmin,
    paymentsMode,
    reserveMembership,
    startPayment,
    scheduleChange,
    cancelSubscription,
    quoteChange,
    refresh,
  };
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>.');
  return ctx;
};
