import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Screen from './Screen';
import BackButton from './BackButton';
import PrimaryButton from './PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { useSubscription, formatDateTime, PAYMENT_METHODS } from '../context/SubscriptionContext';
import { formatPeso } from '../data/subscriptionPlans';
import { shareReceipt } from '../lib/receipt';
import { BRAND } from '../constants/brand';
import { COLORS, SHADES } from '../theme/colors';

const KIND_LABELS = { new: 'New membership', renewal: 'Renewal', upgrade: 'Plan upgrade' };
const STATUS_COLORS = {
  Paid: '#1F6B3A',
  Pending: '#8A5A00',
  Rejected: '#6B2A2A',
  Failed: '#6B2A2A',
  Cancelled: '#555555',
};

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value} selectable>{value}</Text>
  </View>
);

// A receipt for a paid payment, or a details page for any other payment.
const ReceiptScreen = ({ id }) => {
  const router = useRouter();
  const { user } = useAuth();
  const { payments } = useSubscription();
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  const payment = payments.find((p) => p.id === id);

  if (!payment) {
    return (
      <Screen>
        <BackButton />
        <Text style={styles.title}>Payment not found</Text>
        <Text style={styles.muted}>We could not find this payment. Open it from the History tab.</Text>
        <PrimaryButton label="GO TO HISTORY" onPress={() => router.replace('/history')} />
      </Screen>
    );
  }

  const paid = payment.status === 'Paid';
  const receipt = {
    business: BRAND.name,
    receiptNumber: payment.receiptNumber,
    reference: payment.reference,
    date: formatDateTime(payment.paidAt),
    member: user?.name || 'Member',
    email: user?.email || '',
    plan: payment.planName,
    type: KIND_LABELS[payment.kind] ?? 'Membership',
    method: PAYMENT_METHODS[payment.method] ?? payment.method,
    amount: formatPeso(payment.amount),
    verifiedByAdmin: payment.verifiedByAdmin,
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    setShareError('');
    const res = await shareReceipt(receipt);
    setSharing(false);
    if (!res.ok) setShareError('Could not share the receipt. Please try again.');
  };

  return (
    <Screen>
      <BackButton />
      <Text style={styles.title}>{paid ? 'Receipt' : 'Payment Details'}</Text>

      <View style={styles.card}>
        <View style={styles.header}>
          <MaterialCommunityIcons
            name={paid ? 'check-decagram' : 'receipt-text-outline'}
            size={34}
            color={COLORS.accent}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.business}>{BRAND.name}</Text>
            <Text style={styles.muted2}>{paid ? 'Official receipt' : 'Payment record'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[payment.status] }]}>
            <Text style={styles.badgeText}>{payment.status}</Text>
          </View>
        </View>

        <Text style={styles.amount}>{formatPeso(payment.amount)}</Text>

        {paid && <Row label="Receipt no." value={payment.receiptNumber} />}
        <Row label="Code" value={payment.reference} />
        <Row label={paid ? 'Paid on' : 'Created'} value={formatDateTime(paid ? payment.paidAt : payment.createdAt)} />
        <Row label="Member" value={user?.name || 'Member'} />
        <Row label="Plan" value={payment.planName} />
        <Row label="Type" value={KIND_LABELS[payment.kind] ?? 'Membership'} />
        <Row label="Payment method" value={PAYMENT_METHODS[payment.method] ?? payment.method} />
        {payment.verifiedByAdmin && <Row label="Verified" value="By gym admin" />}
        {payment.status === 'Rejected' && !!payment.reason && <Row label="Reason" value={payment.reason} />}
      </View>

      {payment.status === 'Pending' && payment.method === 'gym' && (
        <Text style={styles.muted}>
          Show the code above at the front desk and pay in cash. The gym admin will confirm your payment, then
          your receipt appears here.
        </Text>
      )}
      {payment.status === 'Pending' && payment.method !== 'gym' && (
        <Text style={styles.muted}>This online payment was not completed yet.</Text>
      )}
      {payment.status === 'Rejected' && (
        <Text style={styles.muted}>
          The gym admin did not accept this payment. Your reservation was released. You can subscribe again from
          the Home tab.
        </Text>
      )}

      {paid && (
        <>
          {!!shareError && <Text style={styles.error}>{shareError}</Text>}
          <PrimaryButton
            label={sharing ? 'PREPARING...' : 'SHARE RECEIPT (PDF)'}
            onPress={handleShare}
            disabled={sharing}
          />
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: { color: COLORS.text, fontSize: 26, fontWeight: '800', marginBottom: 16 },
  muted: { color: COLORS.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 20 },
  muted2: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  error: { color: COLORS.error ?? '#FF6B6B', fontSize: 14, marginBottom: 10 },
  card: {
    backgroundColor: SHADES.maroonDeep,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  business: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  amount: { color: COLORS.text, fontSize: 34, fontWeight: '800', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  label: { color: COLORS.textMuted, fontSize: 13, flex: 1, paddingRight: 10 },
  value: { color: COLORS.text, fontSize: 14, fontWeight: '700', flex: 1.4, textAlign: 'right' },
});

export default ReceiptScreen;
