import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import TabScreen from '../../components/TabScreen';
import InfoScreen from '../../components/InfoScreen';
import { useSubscription, formatDate, PAYMENT_METHODS } from '../../context/SubscriptionContext';
import { formatPeso } from '../../data/subscriptionPlans';
import { COLORS } from '../../theme/colors';

const STATUS_COLORS = { Paid: '#1F6B3A', Pending: '#8A5A00', Cancelled: '#6B2A2A' };

export default function History() {
  const router = useRouter();
  const { payments } = useSubscription();

  if (payments.length === 0) {
    return (
      <InfoScreen
        title="Payment History"
        icon="receipt-text-outline"
        heading="No payments yet"
        text="When you subscribe to a plan, your payment will be listed here."
        buttonLabel="BROWSE PLANS"
        onPress={() => router.navigate('/')}
      />
    );
  }

  return (
    <TabScreen title="Payment History">
      {payments.map((p) => (
        <View key={p.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.plan}>{p.planName}</Text>
            <Text style={styles.amount}>{formatPeso(p.amount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.meta}>
              {formatDate(p.date)} • {PAYMENT_METHODS[p.method]}
            </Text>
            <View style={[styles.badge, { backgroundColor: STATUS_COLORS[p.status] }]}>
              <Text style={styles.badgeText}>{p.status}</Text>
            </View>
          </View>
        </View>
      ))}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  plan: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: '700' },
  amount: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  meta: { flex: 1, color: COLORS.textMuted, fontSize: 13 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
