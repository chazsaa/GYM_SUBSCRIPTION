import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { Dialog, ConfirmModal, Btn, Field, Chips, Banner } from './ui';
import { formatDate } from '../../context/SubscriptionContext';
import { rpc } from '../../lib/admin';
import { ADMIN } from '../../theme/adminTheme';

const QUICK_DAYS = [
  { key: '7', label: '7 days' },
  { key: '14', label: '14 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
];

// These take the whole membership object as a parameter, so the screen's
// buttons never reach into a value that may still be empty.
async function extendMembership(subscription, count) {
  const res = await rpc('admin_extend_subscription', {
    p_subscription_id: subscription.subscription_id,
    p_days: count,
  });
  if (!res.ok) return { ok: false, message: res.message };
  const who = subscription.member_name || 'the member';
  return {
    ok: true,
    text: `Added ${count} day${count === 1 ? '' : 's'} to ${who}’s membership. It now ends on ${formatDate(res.data.ends)}.`,
  };
}

async function cancelMembership(subscription, reason) {
  const res = await rpc('admin_cancel_subscription', {
    p_subscription_id: subscription.subscription_id,
    p_reason: reason.trim() || null,
  });
  if (!res.ok) return { ok: false, message: res.message };
  const who = subscription.member_name || 'the member';
  return {
    ok: true,
    text:
      subscription.status === 'pending'
        ? `Released ${who}’s reservation.`
        : `Ended ${who}’s membership. No refund was issued automatically.`,
  };
}

// Extend / cancel a membership. Used by the Subscriptions screen and the member page.
//   subscription: { subscription_id, member_name, plan_name, status, end_date }
//   onResult({ ok, text }) is called after a change went through, so the screen can
//   show a message and reload its list.
// Returns { requestExtend, requestCancel, dialogs }: call the first two from buttons
// and render {dialogs} once anywhere in the screen.
export function useMembershipActions(onResult) {
  const [extending, setExtending] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [days, setDays] = useState('30');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const requestExtend = (subscription) => {
    setDays('30');
    setError('');
    setExtending(subscription);
  };
  const requestCancel = (subscription) => {
    setReason('');
    setError('');
    setCancelling(subscription);
  };

  const submitExtend = async () => {
    const count = Number(days);
    if (!Number.isInteger(count) || count < 1 || count > 365) {
      setError('Enter a number of days from 1 to 365.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await extendMembership(extending, count);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setExtending(null);
    onResult({ ok: true, text: result.text });
  };

  const submitCancel = async () => {
    setBusy(true);
    setError('');
    const result = await cancelMembership(cancelling, reason);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCancelling(null);
    onResult({ ok: true, text: result.text });
  };

  const extendCount = Number(days);
  const newEnd =
    extending && Number.isInteger(extendCount) && extendCount >= 1 && extendCount <= 365
      ? new Date(new Date(extending.end_date).getTime() + extendCount * 86400000).toISOString()
      : null;

  const dialogs = (
    <>
      <Dialog
        visible={!!extending}
        title="Extend membership"
        onClose={() => setExtending(null)}
        footer={
          <>
            <Btn label="Cancel" kind="secondary" onPress={() => setExtending(null)} disabled={busy} />
            <Btn label="Extend" onPress={submitExtend} loading={busy} />
          </>
        }
      >
        {!!extending && (
          <>
            <Text style={styles.text}>
              {extending.member_name || 'Member'} · {extending.plan_name}
            </Text>
            <Text style={styles.muted}>Currently ends on {formatDate(extending.end_date)}.</Text>
            <Banner tone="danger" text={error} />
            <Text style={styles.label}>Add how many days?</Text>
            <Chips options={QUICK_DAYS} value={days} onChange={setDays} />
            <Field
              label="Days to add"
              value={days}
              onChangeText={(t) => setDays(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.field}
              hint={newEnd ? `New end date: ${formatDate(newEnd)}` : 'From 1 to 365 days.'}
            />
          </>
        )}
      </Dialog>

      <ConfirmModal
        visible={!!cancelling}
        title={cancelling?.status === 'pending' ? 'Release this reservation?' : 'End this membership?'}
        danger
        busy={busy}
        confirmLabel={cancelling?.status === 'pending' ? 'Release' : 'End membership'}
        cancelLabel="Keep it"
        onConfirm={submitCancel}
        onCancel={() => setCancelling(null)}
        message={
          cancelling
            ? cancelling.status === 'pending'
              ? `${cancelling.member_name || 'The member'}’s reserved ${cancelling.plan_name} is released and the cash payment is cancelled. They can reserve again.`
              : `${cancelling.member_name || 'The member'}’s ${cancelling.plan_name} stops now and they lose gym access. No refund is issued automatically.`
            : ''
        }
      >
        <Banner tone="danger" text={error} />
        <Field
          label="Reason (optional, kept in the admin log)"
          value={reason}
          onChangeText={setReason}
          maxLength={200}
          style={styles.field}
        />
      </ConfirmModal>
    </>
  );

  return { requestExtend, requestCancel, dialogs };
}

const styles = StyleSheet.create({
  text: { color: ADMIN.text, fontSize: 15, fontWeight: '700' },
  muted: { color: ADMIN.textMuted, fontSize: 13, marginTop: 2, marginBottom: 14 },
  label: { color: ADMIN.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  field: { marginTop: 12, marginBottom: 0 },
});
