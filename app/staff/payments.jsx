
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
    Banner,
    Btn,
    Card,
    ConfirmModal,
    Dialog,
    EmptyState,
    Grid,
    Page,
} from '../../components/admin/ui';
import { formatDateTime } from '../../context/SubscriptionContext';
import { formatPeso } from '../../data/subscriptionPlans';
import { rpc } from '../../lib/admin';
import { ADMIN } from '../../theme/adminTheme';

const REASONS = [
  'Payment not received',
  'Wrong amount',
  'Member did not show up',
];

export default function StaffPayments() {
  const router = useRouter();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const res = await rpc('staff_pending_payments');

    if (res.ok) {
      setPayments(res.data ?? []);
    } else {
      setError(res.message || 'Unable to load pending payments.');
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const review = async (payment, approve, reason) => {
    if (!payment || busy) return;

    setBusy(true);
    setNotice('');
    setError('');

    const res = await rpc('staff_review_payment', {
      p_payment_id: payment.payment_id,
      p_approve: approve,
      p_reason: reason ?? null,
    });

    setBusy(false);
    setApproving(null);
    setRejecting(null);

    if (!res.ok) {
      setError(res.message || 'Payment review failed.');
      return;
    }

    const who = payment.member_name || payment.member_email;

    setNotice(
      approve
        ? `Successfully confirmed ${formatPeso(payment.amount)} from ${who}.`
        : `Payment from ${who} was rejected.`
    );

    await load();
  };

  return (
    <Page
      title="Payment Verification"
      subtitle="Review pending cash payments and confirm payments received at the gym."
      actions={
        <>
          <Btn
            label="Back"
            kind="secondary"
            onPress={() => router.back()}
          />
          <Btn
            label="Refresh"
            icon="refresh"
            kind="secondary"
            onPress={load}
            disabled={loading}
          />
        </>
      }
    >
      <Banner
        tone="success"
        text={notice}
        onClose={() => setNotice('')}
      />

      <Banner
        tone="danger"
        text={error}
        onClose={() => setError('')}
      />

      <Text style={styles.heading}>
        Pending cash payments ({payments.length})
      </Text>

      {loading ? (
        <Card>
          <EmptyState
            icon="clock-outline"
            title="Loading payments"
            text="Retrieving pending cash payment submissions."
          />
        </Card>
      ) : payments.length === 0 ? (
        <Card>
          <EmptyState
            icon="check-circle-outline"
            title="No pending payments"
            text="There are currently no cash payments waiting for verification."
          />
        </Card>
      ) : (
        <Grid min={300}>
          {payments.map((payment) => (
            <Card key={payment.payment_id}>
              <View style={styles.pendingTop}>
                <Text
                  style={styles.pendingName}
                  numberOfLines={1}
                >
                  {payment.member_name || payment.member_email}
                </Text>

                <Text style={styles.pendingAmount}>
                  {formatPeso(payment.amount)}
                </Text>
              </View>

              {!!payment.member_name && (
                <Text style={styles.sub}>
                  {payment.member_email}
                </Text>
              )}

              <Text style={styles.sub}>
                {payment.plan_name} · {payment.kind}
              </Text>

              <Text style={styles.sub}>
                Submitted: {formatDateTime(payment.created_at)}
              </Text>

              <Text selectable style={styles.code}>
                {payment.reference}
              </Text>

              <View style={styles.rowActions}>
                <Btn
                  label="Approve"
                  icon="check"
                  onPress={() => setApproving(payment)}
                  disabled={busy}
                  style={styles.flex1}
                />

                <Btn
                  label="Reject"
                  kind="danger"
                  onPress={() => setRejecting(payment)}
                  disabled={busy}
                  style={styles.flex1}
                />
              </View>
            </Card>
          ))}
        </Grid>
      )}

      <ConfirmModal
        visible={!!approving}
        title="Confirm cash received?"
        busy={busy}
        confirmLabel="Yes, approve"
        cancelLabel="Cancel"
        message={
          approving
            ? `Confirm that you received ${formatPeso(
                approving.amount
              )} in cash from ${
                approving.member_name || approving.member_email
              } (${approving.reference}). Their membership will start now.`
            : ''
        }
        onConfirm={() => review(approving, true)}
        onCancel={() => setApproving(null)}
      />

      <Dialog
        visible={!!rejecting}
        title="Reject this payment?"
        onClose={() => {
          if (!busy) setRejecting(null);
        }}
        footer={
          <Btn
            label="Cancel"
            kind="secondary"
            onPress={() => setRejecting(null)}
            disabled={busy}
          />
        }
      >
        <Text style={styles.dialogText}>
          Select a reason for rejecting this payment. The member's
          reservation will be released.
        </Text>

        {REASONS.map((reason) => (
          <Pressable
            key={reason}
            onPress={() => review(rejecting, false, reason)}
            disabled={busy}
            accessibilityRole="button"
            style={({ hovered }) => [
              styles.reason,
              hovered && styles.reasonHover,
            ]}
          >
            <Text style={styles.reasonText}>
              {reason}
            </Text>
          </Pressable>
        ))}
      </Dialog>
    </Page>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  heading: {
    color: ADMIN.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
    marginTop: 8,
  },
  pendingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 5,
  },
  pendingName: {
    flex: 1,
    color: ADMIN.text,
    fontSize: 16,
    fontWeight: '800',
  },
  pendingAmount: {
    color: ADMIN.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sub: {
    color: ADMIN.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  code: {
    color: ADMIN.brand,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
    marginVertical: 12,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogText: {
    color: ADMIN.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  reason: {
    borderWidth: 1,
    borderColor: ADMIN.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: 8,
  },
  reasonHover: {
    backgroundColor: ADMIN.surfaceAlt,
  },
  reasonText: {
    color: ADMIN.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
