import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';

// ---------------------------------------------------------------------------
// Subscriptions and payments.
// Kept in memory while the app is open, separately for each account.
// ---------------------------------------------------------------------------
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

// 'none' | 'pending' | 'active' | 'expired'
export const getStatus = (subscription) => {
  if (!subscription) return 'none';
  if (subscription.status === 'pending') return 'pending';
  return new Date() > new Date(subscription.endDate) ? 'expired' : 'active';
};

const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }) => {
  const { user } = useAuth();
  const [byUser, setByUser] = useState({});
  const key = user?.email || '';
  const data = byUser[key] || { subscription: null, payments: [] };
  const status = getStatus(data.subscription);

  const update = (fn) =>
    setByUser((prev) => ({ ...prev, [key]: fn(prev[key] || { subscription: null, payments: [] }) }));

  const activate = (sub, now) => {
    const end = new Date(now);
    end.setDate(end.getDate() + sub.days);
    return { ...sub, status: 'active', startDate: now.toISOString(), endDate: end.toISOString() };
  };

  // Start a membership. Online methods are paid right away;
  // "Pay at the Gym" reserves it as Pending until it is paid.
  const subscribe = (plan, method) => {
    if (status === 'active' || status === 'pending') {
      return { ok: false, message: 'You already have a membership in progress.' };
    }
    const now = new Date();
    const base = { planId: plan.id, days: plan.days, method };
    const payment = {
      id: `P${now.getTime()}`,
      planId: plan.id,
      planName: plan.name,
      amount: plan.amount,
      method,
      date: now.toISOString(),
      status: method === 'gym' ? 'Pending' : 'Paid',
    };
    update((d) => ({
      subscription:
        method === 'gym'
          ? { ...base, status: 'pending', startDate: null, endDate: null }
          : activate(base, now),
      payments: [payment, ...d.payments],
    }));
    return { ok: true, pending: method === 'gym' };
  };

  // Pay a pending membership (online, or confirmed at the front desk).
  const completePayment = (method) => {
    if (status !== 'pending') return { ok: false };
    const now = new Date();
    update((d) => ({
      subscription: activate({ ...d.subscription, method }, now),
      payments: d.payments.map((p, i) =>
        i === 0 && p.status === 'Pending' ? { ...p, method, date: now.toISOString(), status: 'Paid' } : p
      ),
    }));
    return { ok: true };
  };

  // Cancel: a pending payment becomes Cancelled.
  const cancelSubscription = () => {
    update((d) => ({
      subscription: null,
      payments: d.payments.map((p, i) => (i === 0 && p.status === 'Pending' ? { ...p, status: 'Cancelled' } : p)),
    }));
  };

  const value = {
    subscription: data.subscription,
    payments: data.payments,
    status,
    subscribe,
    completePayment,
    cancelSubscription,
  };
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>.');
  return ctx;
};
