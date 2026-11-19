import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TabScreen from '../../components/TabScreen';
import InfoScreen from '../../components/InfoScreen';
import PrimaryButton from '../../components/PrimaryButton';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  useSubscription,
  formatDate,
  daysLeft,
  PAYMENT_METHODS,
} from '../../context/SubscriptionContext';
import { usePlans } from '../../context/PlansContext';
import { getPlanImage, formatPeso } from '../../data/subscriptionPlans';
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
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [actionError, setActionError] = useState('');
  const { subscription, status, pendingPayment, cancelSubscription, scheduleChange } = useSubscription();
  const { getPlanById } = usePlans();
  const plan = subscription ? getPlanById(subscription.planId) : null;
  const nextPlan = subscription?.nextPlanId ? getPlanById(subscription.nextPlanId) : null;

  // No membership: invite the user to pick a plan.
  if (!plan || status === 'none') {
    return (
      <InfoScreen
        title="Current Subscription"
        icon="card-account-details-outline"
        heading="No active membership yet"
        text="Choose a plan on the Home tab, then pay to activate it. Your membership will show up here."
        buttonLabel="BROWSE PLANS"
        onPress={() => router.navigate('/')}
      />
    );
  }

  const pending = status === 'pending';
  const expired = status === 'expired';
  const active = status === 'active';
  // A renewal uses the scheduled plan if there is one.
  const renewPlan = nextPlan ?? plan;

  const run = async (action) => {
    setActionError('');
    const res = await action();
    if (!res.ok) setActionError(res.message || 'Something went wrong. Please try again.');
  };

  let badgeText = 'ACTIVE';
  if (pending) badgeText = 'PENDING PAYMENT';
  if (expired) badgeText = 'EXPIRED';

  return (
    <TabScreen title="Current Subscription">
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Image source={getPlanImage(plan.id)} style={styles.photo} contentFit="cover" transition={150} />
          <View style={{ flex: 1 }}>
            <View
              style={[
                styles.badge,
                pending ? styles.badgePending : expired ? styles.badgeExpired : styles.badgeActive,
              ]}
            >
              <Text style={styles.badgeText}>{badgeText}</Text>
            </View>
            <Text style={styles.name}>{plan.name}</Text>
            <Text style={styles.price}>
              {plan.price} <Text style={styles.muted}>/ {plan.duration}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.facts}>
          <Fact icon="calendar-start" label="Start date" value={pending ? 'After payment' : formatDate(subscription.startDate)} />
          <Fact
            icon="calendar-end"
            label={expired ? 'Expired' : 'Expires'}
            value={pending ? '-' : formatDate(subscription.endDate)}
          />
          <Fact icon="cash" label="Payment" value={pending ? 'Unpaid' : PAYMENT_METHODS[subscription.method]} />
        </View>

        {pending && (
          <Text style={styles.notice}>
            Your spot is reserved, but the membership is not active until {formatPeso(plan.amount)} is paid.
          </Text>
        )}
        {pending && pendingPayment && pendingPayment.method === 'gym' && (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Pay {formatPeso(pendingPayment.amount)} cash at the front desk</Text>
            <Text selectable style={styles.code}>{pendingPayment.reference}</Text>
            <Text style={styles.codeHint}>
              Show this code to the gym admin. They will confirm your payment and your membership starts right
              after.
            </Text>
          </View>
        )}
        {pending && pendingPayment && pendingPayment.method !== 'gym' && (
          <Text style={styles.notice}>
            Your online payment was not completed. You can try again below.
          </Text>
        )}
        {active && (
          <Text style={styles.notice}>
            {daysLeft(subscription.endDate)} day{daysLeft(subscription.endDate) === 1 ? '' : 's'} left.
            {nextPlan
              ? ` Your plan changes to ${nextPlan.name} when this membership ends. Renewing will charge ${nextPlan.price}.`
              : ''}
          </Text>
        )}
        {expired && (
          <Text style={styles.notice}>
            Your membership has ended. Renew to start again, or choose a different plan.
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
        <PrimaryButton
          label={
            pendingPayment?.method === 'gym'
              ? `PAY ${plan.price} ONLINE INSTEAD`
              : `PAY ${plan.price} ONLINE`
          }
          onPress={() => router.push(`/payment/${plan.id}`)}
        />
      )}
      {(active || expired) && (
        <PrimaryButton
          label={expired ? `RENEW - PAY ${renewPlan.price}` : 'RENEW MEMBERSHIP'}
          onPress={() => router.push(`/payment/${renewPlan.id}?mode=renew`)}
        />
      )}
      {(active || expired) && (
        <TouchableOpacity style={styles.outline} onPress={() => router.navigate('/')}>
          <Text style={styles.outlineText}>{expired ? 'Choose a different plan' : 'Change plan'}</Text>
        </TouchableOpacity>
      )}
      {active && nextPlan && (
        <TouchableOpacity style={styles.outline} onPress={() => run(() => scheduleChange(plan.id))}>
          <Text style={styles.outlineText}>Keep {plan.name} (cancel plan change)</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.outline} onPress={() => router.navigate('/history')}>
        <Text style={styles.outlineText}>View Payment History</Text>
      </TouchableOpacity>
      {!!actionError && <Text style={styles.error}>{actionError}</Text>}
      {!expired && (
        <TouchableOpacity
          style={styles.cancel}
          onPress={() => setConfirmEnd(true)}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>{pending ? 'Cancel reservation' : 'End membership'}</Text>
        </TouchableOpacity>
      )}

      <ConfirmDialog
        visible={confirmEnd}
        title={pending ? 'Cancel your reservation?' : 'End your membership?'}
        message={
          pending
            ? 'Your reserved spot will be released. You have not been charged.'
            : 'Your membership will end now and no refund will be given. This cannot be undone.'
        }
        confirmLabel={pending ? 'Cancel reservation' : 'End membership'}
        cancelLabel="Keep it"
        destructive
        onConfirm={() => {
          setConfirmEnd(false);
          run(() => cancelSubscription());
        }}
        onCancel={() => setConfirmEnd(false)}
      />
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
  codeBox: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  codeLabel: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
  code: { color: COLORS.text, fontSize: 28, fontWeight: '800', letterSpacing: 2, marginVertical: 6 },
  codeHint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  badgeExpired: { backgroundColor: '#6B2A2A' },
  error: { color: COLORS.error ?? '#FF6B6B', fontSize: 14, marginTop: 10, textAlign: 'center' },
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
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingVertical: 12 },
  cancelText: { color: COLORS.textMuted, fontSize: 13, textDecorationLine: 'underline' },
});
