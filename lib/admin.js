import { supabase } from './supabase';
import { ruleMessage } from '../context/SubscriptionContext';

// ---------------------------------------------------------------------------
// Helpers shared by every Admin screen.
// All admin data comes from database functions (supabase/phase4.sql). Each one
// checks again that the caller is an admin, so these screens are a convenience,
// not the security.
// ---------------------------------------------------------------------------

const ADMIN_ERRORS = {
  not_admin: 'Only gym admins can do this.',
  member_not_found: 'That member was not found.',
  subscription_not_found: 'That membership was not found.',
  subscription_not_active: 'That membership is no longer running, so it cannot be changed.',
  invalid_days: 'Enter a number of days from 1 to 365.',
  plan_not_found: 'That plan was not found.',
  invalid_plan_name: 'The plan name must be 2 to 60 characters.',
  invalid_amount: 'Enter a price from ₱1 to ₱1,000,000.',
  text_too_long: 'That text is too long. Please shorten it.',
  last_active_plan: 'At least one plan must stay on sale.',
  invalid_setting: 'That setting could not be saved.',
  gym_name_required: 'The gym name cannot be empty.',
  invalid_capacity: 'Capacity must be a whole number.',
  invalid_range: 'That date range is not valid.',
  active_membership_required: 'Only members with an active membership can check in.',
  member_already_checked_in: 'That member is already checked in.',
  attendance_not_found_or_already_checked_out: 'That check-in was not found or is already checked out.',
};

// Turns a database error into a sentence an admin can read.
export const adminError = (error) => {
  const text = error?.message || '';
  // The functions from phase4.sql are missing: the SQL was not run yet.
  if (error?.code === 'PGRST202' || text.includes('Could not find the function')) {
    return 'The admin database update is missing. Run supabase/phase4.sql in the Supabase SQL Editor, then reload.';
  }
  const key = Object.keys(ADMIN_ERRORS).find((k) => text.includes(k));
  return key ? ADMIN_ERRORS[key] : ruleMessage(error);
};

// Calls one database function. Always resolves to { ok, data, message }.
export async function rpc(name, args) {
  try {
    const { data, error } = await supabase.rpc(name, args);
    if (error) return { ok: false, data: null, message: adminError(error) };
    return { ok: true, data, message: '' };
  } catch {
    return { ok: false, data: null, message: 'Could not connect. Check your internet and try again.' };
  }
}

// ---- labels and colors ----------------------------------------------------
export const MEMBER_STATUS = {
  active: { label: 'Active', tone: 'success' },
  pending: { label: 'Pending payment', tone: 'warning' },
  expired: { label: 'Expired', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  none: { label: 'No membership', tone: 'neutral' },
};

export const PAYMENT_STATUS = {
  paid: { label: 'Paid', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'danger' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export const KIND_LABELS = { new: 'New membership', renewal: 'Renewal', upgrade: 'Upgrade' };

export const METHOD_LABELS = { gym: 'Cash at the gym', gcash: 'GCash', maya: 'Maya', card: 'Card' };

export const ENDED_REASONS = {
  user_cancelled: 'Cancelled by the member',
  admin_cancelled: 'Cancelled by an admin',
  payment_rejected: 'Cash payment rejected',
  expired: 'Ran out',
  upgraded: 'Upgraded',
};

export const EXPIRING_DAYS = 7;

// How many whole days are left until a date (0 when it has passed).
export const daysUntil = (iso) =>
  iso ? Math.max(0, Math.ceil((new Date(iso) - new Date()) / 86400000)) : 0;

// "Active" or "Expiring soon" for a running membership.
export const activeLabel = (endDate) =>
  daysUntil(endDate) <= EXPIRING_DAYS
    ? { label: 'Expiring soon', tone: 'warning' }
    : MEMBER_STATUS.active;

// ---- dates for the reports ------------------------------------------------
// The database works in the gym's time zone (Asia/Manila, UTC+8, set in
// phase4.sql by gym_tz()). The report range is built in the same zone.
const GYM_UTC_OFFSET_MS = 8 * 3600000;
export const gymDateRange = (days) => {
  const end = Date.now() + GYM_UTC_OFFSET_MS;
  return {
    from: new Date(end - (days - 1) * 86400000).toISOString().slice(0, 10),
    to: new Date(end).toISOString().slice(0, 10),
  };
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "2026-11-18" -> "Nov 18" (or "Nov" for a monthly bar)
export const shortDay = (iso, unit = 'day') => {
  const [, month, day] = String(iso).split('-').map(Number);
  if (!month) return String(iso);
  return unit === 'month' ? MONTHS[month - 1] : `${MONTHS[month - 1]} ${day}`;
};
