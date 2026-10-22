import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TabScreen from '../../components/TabScreen';
import InfoScreen from '../../components/InfoScreen';
import PrimaryButton from '../../components/PrimaryButton';
import { useSubscription, formatDate, PAYMENT_METHODS } from '../../context/SubscriptionContext';
import { getPlanById, planImages, formatPeso } from '../../data/subscriptionPlans';
import { COLORS, SHADES } from '../../theme/colors';

const Fact = ({ icon, label, value }) => (
  <View style={styles.fact}>
    <MaterialCommunityIcons name={icon} size={20} color={COLORS.accent} />
    <Text style={styles.factLabel}>{label}</Text>
    <Text style={styles.factValue}>{value}</Text>
  </View>
);

export default function Current() {
  const router = useRouter();
  const { subscription, status, completePayment, cancelSubscription } = useSubscription();
  const plan = subscription ? getPlanById(subscription.planId) : null;

  // No membership (or it expired): invite the user to pick a plan.
  if (!plan || status === 'none' || status === 'expired') {
    return (
      <InfoScreen
        title="Current Subscription"
        icon="card-account-details-outline"
        heading={status === 'expired' ? 'Your membership has expired' : 'No active membership yet'}
        text="Choose a plan on the Home tab, then pay to activate it. Your membership will show up here."
        buttonLabel="BROWSE PLANS"
        onPress={() => router.navigate('/')}
      />
    );
  }

  const pending = status === 'pending';

  return (
    <TabScreen title="Current Subscription">
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Image source={planImages[plan.id]} style={styles.photo} />
          <View style={{ flex: 1 }}>
            <View style={[styles.badge, pending ? styles.badgePending : styles.badgeActive]}>
              <Text style={styles.badgeText}>{pending ? 'PENDING PAYMENT' : 'ACTIVE'}</Text>
            </View>
            <Text style={styles.name}>{plan.name}</Text>
            <Text style={styles.price}>
              {plan.price} <Text style={styles.muted}>/ {plan.duration}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.facts}>
          <Fact icon="calendar-start" label="Start date" value={pending ? 'After payment' : formatDate(subscription.startDate)} />
          <Fact icon="calendar-end" label="Expires" value={pending ? '-' : formatDate(subscription.endDate)} />
          <Fact icon="cash" label="Payment" value={pending ? 'Unpaid' : PAYMENT_METHODS[subscription.method]} />
        </View>

        {pending && (
          <Text style={styles.notice}>
            Your spot is reserved, but the membership is not active until {formatPeso(plan.amount)} is paid.
          </Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Benefits</Text>
      {plan.benefits.map((b) => (
        <View key={b} style={styles.benefitRow}>
          <MaterialCommunityIcons name="check" size={18} color={COLORS.accent} />
          <Text style={styles.benefitText}>{b}</Text>
        </View>
      ))}

      <View style={{ height: 20 }} />
      {pending && (
        <>
          <PrimaryButton label={`PAY ${plan.price} ONLINE`} onPress={() => router.push(`/payment/${plan.id}`)} />
          <TouchableOpacity style={styles.outline} onPress={() => completePayment('gym')}>
            <Text style={styles.outlineText}>I paid at the front desk</Text>
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity style={styles.outline} onPress={() => router.navigate('/history')}>
        <Text style={styles.outlineText}>View Payment History</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancel} onPress={cancelSubscription}>
        <Text style={styles.cancelText}>{pending ? 'Cancel reservation' : 'End membership'}</Text>
      </TouchableOpacity>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SHADES.maroonDeep,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 20,
    padding: 16,
    marginBottom: 22,
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  photo: { width: 84, height: 84, borderRadius: 16, marginRight: 14, borderWidth: 1.5, borderColor: COLORS.primary },
  badge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6 },
  badgeActive: { backgroundColor: '#1F6B3A' },
  badgePending: { backgroundColor: '#8A5A00' },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  name: { color: COLORS.text, fontSize: 19, fontWeight: '800' },
  price: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  muted: { color: COLORS.textMuted, fontSize: 13, fontWeight: '400' },
  facts: { flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  fact: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  factLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  factValue: { color: COLORS.text, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  notice: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 14 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  benefitText: { flex: 1, color: COLORS.text, fontSize: 14, marginLeft: 8 },
  outline: { borderWidth: 1.5, borderColor: COLORS.accent, borderRadius: 30, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  outlineText: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: 16 },
  cancelText: { color: COLORS.textMuted, fontSize: 13, textDecorationLine: 'underline' },
});
