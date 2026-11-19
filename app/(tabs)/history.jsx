import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import TabScreen from '../../components/TabScreen';
import InfoScreen from '../../components/InfoScreen';
import { useSubscription, formatDate, PAYMENT_METHODS } from '../../context/SubscriptionContext';
import { formatPeso } from '../../data/subscriptionPlans';
import { COLORS } from '../../theme/colors';

const KIND_LABELS = { new: 'New', renewal: 'Renewal', upgrade: 'Upgrade' };
const STATUS_COLORS = {
  Paid: '#1F6B3A',
  Pending: '#8A5A00',
  Rejected: '#6B2A2A',
  Failed: '#6B2A2A',
  Cancelled: '#555555',
};
const FILTERS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'paid', label: 'Paid', match: (p) => p.status === 'Paid' },
  { key: 'pending', label: 'Pending', match: (p) => p.status === 'Pending' },
  { key: 'other', label: 'Unsuccessful', match: (p) => !['Paid', 'Pending'].includes(p.status) },
];

export default function History() {
  const router = useRouter();
  const { payments } = useSubscription();
  const [filter, setFilter] = useState('all');

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

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = payments.filter(active.match);

  return (
    <TabScreen title="Payment History">
      <View style={styles.chips}>
        {FILTERS.map((f) => {
          const selected = f.key === filter;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {shown.length === 0 && <Text style={styles.empty}>Nothing here yet.</Text>}
      {shown.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => router.push(`/receipt/${p.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${p.planName}, ${p.status}. Open details`}
        >
          <View style={styles.row}>
            <Text style={styles.plan}>{p.planName}</Text>
            <Text style={styles.amount}>{formatPeso(p.amount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.meta}>
              {KIND_LABELS[p.kind] ?? 'New'} • {formatDate(p.date)} • {PAYMENT_METHODS[p.method]}
            </Text>
            <View style={[styles.badge, { backgroundColor: STATUS_COLORS[p.status] }]}>
              <Text style={styles.badgeText}>{p.status}</Text>
            </View>
          </View>
          <Text style={styles.ref}>
            {p.status === 'Paid' ? `Receipt ${p.receiptNumber ?? ''}` : `Code ${p.reference ?? ''}`}
            {p.status === 'Rejected' && p.reason ? ` • ${p.reason}` : ''}
          </Text>
        </TouchableOpacity>
      ))}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipSelected: { borderColor: COLORS.accent, backgroundColor: '#2A1010' },
  chipText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: COLORS.accent },
  empty: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginTop: 20 },
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
  ref: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
