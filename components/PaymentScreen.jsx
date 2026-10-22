import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Screen from './Screen';
import BackButton from './BackButton';
import PrimaryButton from './PrimaryButton';
import { formatPeso } from '../data/subscriptionPlans';
import { useSubscription, PAYMENT_METHODS } from '../context/SubscriptionContext';
import { COLORS, SHADES } from '../theme/colors';

const METHOD_ICONS = { gcash: 'cellphone', maya: 'wallet-outline', card: 'credit-card-outline', gym: 'store-outline' };
const METHOD_NOTES = {
  gcash: 'Pay now. Membership starts right away.',
  maya: 'Pay now. Membership starts right away.',
  card: 'Pay now. Membership starts right away.',
  gym: 'Reserve now, pay at the front desk. Membership starts after payment.',
};

const PaymentScreen = ({ plan, id }) => {
  const router = useRouter();
  const { status, subscription, subscribe, completePayment } = useSubscription();
  const [method, setMethod] = useState('gcash');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  if (!plan) {
    return (
      <Screen>
        <BackButton />
        <Text style={styles.title}>Subscription Not Found</Text>
        <Text style={styles.muted}>{id ? `No plan has the ID "${id}".` : 'No plan ID was given.'}</Text>
        <PrimaryButton label="BACK TO HOME" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  // Finishing a pending payment is allowed only for the same plan.
  const completing = status === 'pending' && subscription?.planId === plan.id;
  const blocked = (status === 'pending' || status === 'active') && !completing;

  if (blocked) {
    return (
      <Screen>
        <BackButton />
        <Text style={styles.title}>Membership already in progress</Text>
        <Text style={styles.muted}>
          You already have a pending or active membership. See it in the Current tab.
        </Text>
        <PrimaryButton label="VIEW CURRENT MEMBERSHIP" onPress={() => router.navigate('/current')} />
      </Screen>
    );
  }

  const methods = completing ? ['gcash', 'maya', 'card'] : Object.keys(PAYMENT_METHODS);
  const payNow = method !== 'gym';

  const handlePay = () => {
    setProcessing(true);
    // Short processing delay before the payment is recorded.
    setTimeout(() => {
      const res = completing ? completePayment(method) : subscribe(plan, method);
      setProcessing(false);
      if (res.ok) {
        setResult(
          res.pending
            ? {
                title: 'Membership reserved',
                text: `${plan.name} is waiting for payment. Pay ${formatPeso(plan.amount)} at the gym front desk to activate it.`,
              }
            : {
                title: 'Payment received',
                text: `${plan.name} is now active. Enjoy your workouts!`,
              }
        );
      }
    }, 1000);
  };

  const goToCurrent = () => {
    setResult(null);
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/current');
  };

  return (
    <Screen>
      <BackButton />
      <Text style={styles.title}>{completing ? 'Complete Payment' : 'Payment'}</Text>

      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.muted2}>{plan.duration} • Plan ID {plan.id}</Text>
        </View>
        <Text style={styles.amount}>{plan.price}</Text>
      </View>

      <Text style={styles.sectionTitle}>Payment method</Text>
      {methods.map((m) => {
        const selected = method === m;
        return (
          <TouchableOpacity
            key={m}
            style={[styles.method, selected && styles.methodSelected]}
            activeOpacity={0.85}
            onPress={() => setMethod(m)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <MaterialCommunityIcons name={METHOD_ICONS[m]} size={26} color={COLORS.text} />
            <View style={styles.methodText}>
              <Text style={styles.methodName}>{PAYMENT_METHODS[m]}</Text>
              <Text style={styles.methodNote}>{METHOD_NOTES[m]}</Text>
            </View>
            <MaterialCommunityIcons
              name={selected ? 'radiobox-marked' : 'radiobox-blank'}
              size={22}
              color={selected ? COLORS.accent : COLORS.textMuted}
            />
          </TouchableOpacity>
        );
      })}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{plan.price}</Text>
      </View>
      <View style={{ height: 16 }} />

      <PrimaryButton
        label={processing ? 'PROCESSING...' : payNow ? `PAY ${plan.price}` : 'RESERVE - PAY AT THE GYM'}
        onPress={handlePay}
        disabled={processing}
      />

      <Modal visible={!!result} transparent animationType="fade" onRequestClose={goToCurrent}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="check-circle-outline" size={44} color={COLORS.accent} />
            <Text style={styles.modalTitle}>{result?.title}</Text>
            <Text style={styles.modalText}>{result?.text}</Text>
            <View style={{ alignSelf: 'stretch' }}>
              <PrimaryButton label="VIEW MY MEMBERSHIP" onPress={goToCurrent} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: { color: COLORS.text, fontSize: 26, fontWeight: '800', marginBottom: 16 },
  muted: { color: COLORS.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SHADES.maroonDeep,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 16,
    padding: 18,
    marginBottom: 22,
  },
  planName: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  muted2: { color: COLORS.textMuted, fontSize: 13, marginTop: 3 },
  amount: { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  methodSelected: { borderColor: COLORS.accent, backgroundColor: SHADES.maroonSoft },
  methodText: { flex: 1, marginHorizontal: 12 },
  methodName: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  methodNote: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  totalLabel: { color: COLORS.textMuted, fontSize: 15 },
  totalValue: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', paddingHorizontal: 28 },
  modalCard: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 24,
  },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginTop: 10, marginBottom: 8 },
  modalText: { color: COLORS.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 20 },
});

export default PaymentScreen;
