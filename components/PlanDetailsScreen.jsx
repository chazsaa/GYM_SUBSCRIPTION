import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Screen from './Screen';
import BackButton from './BackButton';
import PrimaryButton from './PrimaryButton';
import { useSubscription } from '../context/SubscriptionContext';
import { usePlans } from '../context/PlansContext';
import { COLORS, SHADES } from '../theme/colors';

const Stat = ({ icon, label, value }) => (
  <View style={styles.stat}>
    <MaterialCommunityIcons name={icon} size={22} color={COLORS.accent} />
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue} numberOfLines={2}>{value}</Text>
  </View>
);

const PlanDetailsScreen = ({ plan, id }) => {
  const router = useRouter();
  const { status, subscription } = useSubscription();
  const { getPlanById } = usePlans();

  if (!plan) {
    return (
      <Screen>
        <BackButton />
        <Text style={styles.notFoundTitle}>Subscription Not Found</Text>
        <Text style={styles.notFoundText}>
          {id
            ? `We could not find a subscription with the ID "${id}".`
            : 'No subscription ID was given.'}{' '}
          Go back to the Home screen and choose one of the available plans.
        </Text>
        <PrimaryButton
          label="BACK TO HOME"
          onPress={() => router.replace('/')}
        />
      </Screen>
    );
  }

  // What the main button does depends on the member's membership.
  const currentPlan = subscription ? getPlanById(subscription.planId) : null;
  let notice = '';
  let label = 'SUBSCRIBE NOW';
  let action = () => router.push(`/payment/${plan.id}`);
  if (status === 'pending') {
    notice =
      'You have a membership waiting for payment. Finish or cancel it in the Current tab before choosing another plan.';
    label = 'VIEW CURRENT MEMBERSHIP';
    action = () => router.navigate('/current');
  } else if (status === 'active') {
    if (subscription.planId === plan.id) {
      notice = 'This is your current plan. You can renew it in the Current tab.';
      label = 'VIEW CURRENT MEMBERSHIP';
      action = () => router.navigate('/current');
    } else {
      const upgrade = plan.amount > (currentPlan?.amount ?? 0);
      notice = upgrade
        ? 'Upgrading starts this plan now. The unused days of your current plan are credited, and you pay the difference.'
        : 'Downgrading takes effect when your current membership ends. Nothing is charged now.';
      label = upgrade ? 'UPGRADE TO THIS PLAN' : 'DOWNGRADE TO THIS PLAN';
      action = () => router.push(`/payment/${plan.id}?mode=change`);
    }
  }

  return (
    <Screen>
      <BackButton />

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.idBadge}>
          <Text style={styles.idText}>Subscription ID: {plan.id}</Text>
        </View>
        <MaterialCommunityIcons name={plan.icon} size={40} color={COLORS.accent} />
        <Text style={styles.name}>{plan.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{plan.price}</Text>
          <Text style={styles.duration}>/ {plan.duration}</Text>
        </View>
      </View>

      {/* Quick facts */}
      <View style={styles.stats}>
        <Stat icon="clock-outline" label="Duration" value={plan.duration} />
        <Stat icon="door-open" label="Access" value="All gym areas" />
        <Stat icon="tag-outline" label="Best for" value={plan.bestFor} />
      </View>

      <Text style={styles.sectionTitle}>Description</Text>
      <Text style={styles.description}>{plan.description}</Text>

      {/* Benefits */}
      <View style={styles.benefitsCard}>
        <Text style={styles.sectionTitle}>Membership benefits</Text>
        {plan.benefits.map((benefit) => (
          <View key={benefit} style={styles.benefitRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>

      {/* Membership access information */}
      <View style={styles.benefitsCard}>
        <Text style={styles.sectionTitle}>Membership access</Text>
        <Text style={styles.accessText}>{plan.access}</Text>
      </View>

      {!!notice && <Text style={styles.notice}>{notice}</Text>}
      <PrimaryButton label={label} onPress={action} />
      <TouchableOpacity
        style={styles.outlineButton}
        activeOpacity={0.8}
        onPress={() => router.replace('/')}
      >
        <Text style={styles.outlineText}>Back to Plans</Text>
      </TouchableOpacity>

    </Screen>
  );
};

const styles = StyleSheet.create({
  notice: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  hero: {
    backgroundColor: SHADES.maroonDeep,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 22,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  statLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  statValue: { color: COLORS.text, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  outlineText: { color: COLORS.accent, fontSize: 15, fontWeight: '700' },
  idBadge: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    position: 'absolute',
    top: 14,
    right: 14,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  idText: {
    color: COLORS.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  name: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
  },
  price: {
    color: COLORS.text,
    fontSize: 36,
    fontWeight: '800',
  },
  duration: {
    color: COLORS.textMuted,
    fontSize: 16,
    marginLeft: 10,
  },
  description: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 22,
  },
  benefitsCard: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  check: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 10,
  },
  benefitText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  accessText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  notFoundTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 10,
  },
  notFoundText: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
});

export default PlanDetailsScreen;
