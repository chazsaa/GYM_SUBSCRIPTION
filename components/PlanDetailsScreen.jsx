import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Screen from './Screen';
import BackButton from './BackButton';
import PrimaryButton from './PrimaryButton';
import { COLORS, SHADES } from '../theme/colors';

const Stat = ({ icon, label, value }) => (
  <View style={styles.stat}>
    <MaterialCommunityIcons name={icon} size={22} color={COLORS.accent} />
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue} numberOfLines={2}>{value}</Text>
  </View>
);

// "plan" is the plan found by the route file (or undefined if the id is wrong).
// "id" is the id from the URL. We show it in the "not found" message.
const PlanDetailsScreen = ({ plan, id }) => {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  // If the id does not match any plan, show a friendly message instead of crashing
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

      <PrimaryButton label="SUBSCRIBE NOW" onPress={() => setShowConfirm(true)} />
      <TouchableOpacity
        style={styles.outlineButton}
        activeOpacity={0.8}
        onPress={() => router.replace('/')}
      >
        <Text style={styles.outlineText}>Back to Plans</Text>
      </TouchableOpacity>

      {/* Confirmation message (demo only, no real payment) */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Plan selected</Text>
            <Text style={styles.modalText}>
              You selected {plan.name} for {plan.price}.{'\n\n'}
              This is a demo only. No payment was made and no membership was
              created.
            </Text>
            <PrimaryButton label="GOT IT" onPress={() => setShowConfirm(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
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
