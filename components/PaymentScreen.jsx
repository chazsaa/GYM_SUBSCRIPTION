import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Screen from './Screen';
import BackButton from './BackButton';
import PrimaryButton from './PrimaryButton';
import { formatPeso } from '../data/subscriptionPlans';
import { useSubscription, PAYMENT_METHODS, formatDate } from '../context/SubscriptionContext';
import { COLORS, SHADES } from '../theme/colors';

const METHOD_ICONS = { gcash: 'cellphone', maya: 'wallet-outline', card: 'credit-card-outline', gym: 'store-outline' };
const METHOD_NOTES = {
  gcash: 'Pay now. Membership starts right away.',
  maya: 'Pay now. Membership starts right away.',
  card: 'Pay now. Membership starts right away.',
  gym: 'Reserve now, pay at the front desk. Membership starts after payment.',
};
const ONLINE_METHODS = ['gcash', 'maya', 'card'];

// mode: 'new' (subscribe), 'renew' (extend / restart), 'change' (upgrade or downgrade)
const PaymentScreen = ({ plan, id, mode: modeParam }) => {
  const mode = modeParam === 'renew' || modeParam === 'change' ? modeParam : 'new';
  const router = useRouter();
  const {
    status,
    subscription,
    subscribe,
    completePayment,
    renewSubscription,
    changePlan,
    quoteChange,
  } = useSubscription();
  const [method, setMethod] = useState('gcash');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [quoteState, setQuoteState] = useState({ planId: null, quote: null, error: '' });

  // For a plan change, ask the database what it would cost before paying.
  const planId = plan?.id;
  const wantsQuote = mode === 'change' && status === 'active' && planId != null;
  useEffect(() => {
    if (!wantsQuote) return undefined;
    let cancelled = false;
    quoteChange(planId).then((res) => {
      if (!cancelled) {
        setQuoteState({ planId, quote: res.ok ? res.quote : null, error: res.ok ? '' : res.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [wantsQuote, planId, quoteChange]);

  const notFound = (
    <Screen>
      <BackButton />
      <Text style={styles.title}>Subscription Not Found</Text>
      <Text style={styles.muted}>{id ? `No plan has the ID "${id}".` : 'No plan ID was given.'}</Text>
      <PrimaryButton label="BACK TO HOME" onPress={() => router.replace('/')} />
    </Screen>
  );
  if (!plan) return notFound;

  const blockedScreen = (heading, text, label = 'VIEW CURRENT MEMBERSHIP') => (
    <Screen>
      <BackButton />
      <Text style={styles.title}>{heading}</Text>
      <Text style={styles.muted}>{text}</Text>
      <PrimaryButton label={label} onPress={() => router.navigate('/current')} />
    </Screen>
  );

  // Finishing a pending payment is allowed only for the same plan.
  const completing = mode === 'new' && status === 'pending' && subscription?.planId === plan.id;
  if (mode === 'new' && (status === 'pending' || status === 'active') && !completing) {
    return blockedScreen(
      'Membership already in progress',
      'You already have a pending or active membership. See it in the Current tab.'
    );
  }
  if (mode === 'renew' && status !== 'active' && status !== 'expired') {
    return blockedScreen('Nothing to renew', 'You have no membership to renew. Choose a plan on the Home tab.', 'BROWSE PLANS');
  }
  if (mode === 'change' && status !== 'active') {
    return blockedScreen('Plan change not available', 'You need an active membership to change plans.');
  }

  // ----- plan change: wait for the quote
  const quoteReady = quoteState.planId === plan.id;
  const quote = mode === 'change' && quoteReady ? quoteState.quote : null;
  const quoteError = mode === 'change' && quoteReady ? quoteState.error : '';
  if (mode === 'change' && !quote) {
    return (
      <Screen>
        <BackButton />
        <Text style={styles.title}>Change Plan</Text>
        <Text style={styles.muted}>{quoteError || 'Checking your plan change...'}</Text>
        {!!quoteError && <PrimaryButton label="VIEW CURRENT MEMBERSHIP" onPress={() => router.navigate('/current')} />}
      </Screen>
    );
  }

  if (quote?.kind === 'clear') {
    return blockedScreen(
      'This is your current plan',
      'To cancel a scheduled plan change, use "Keep ... (cancel plan change)" in the Current tab.'
    );
  }

  const isUpgrade = quote?.kind === 'upgrade';
  const isDowngrade = quote?.kind === 'downgrade';
  const total = isUpgrade ? quote.charge : plan.amount;
  const methods = isDowngrade
    ? []
    : completing || mode !== 'new'
      ? ONLINE_METHODS
      : Object.keys(PAYMENT_METHODS);
  const payNow = isDowngrade ? false : method !== 'gym' || mode !== 'new';

  const handlePay = async () => {
    if (processing) return;
    setProcessing(true);
    setErrorMessage('');
    // Payments are still simulated (real payments come in Phase 3),
    // so a short delay stands in for the payment provider.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    let res;
    if (mode === 'renew') res = await renewSubscription(method);
    else if (mode === 'change') res = await changePlan(plan.id, isDowngrade ? null : method);
    else if (completing) res = await completePayment(method);
    else res = await subscribe(plan, method);
    setProcessing(false);
    if (!res.ok) {
      setErrorMessage(res.message || 'Something went wrong. Please try again.');
      return;
    }
    if (mode === 'renew') {
      setResult({
        title: 'Membership renewed',
        text:
          res.data?.result === 'restarted'
            ? `${plan.name} has started again and runs until ${formatDate(res.data?.ends)}.`
            : `${plan.name} now runs until ${formatDate(res.data?.ends)}.`,
      });
    } else if (mode === 'change') {
      setResult(
        isDowngrade
          ? {
              title: 'Plan change scheduled',
              text: `You will move to ${plan.name} on ${formatDate(quote.effective)}. Nothing was charged.`,
            }
          : {
              title: 'Plan upgraded',
              text: `${plan.name} is now active and runs until ${formatDate(res.data?.ends)}.`,
            }
      );
    } else if (res.pending) {
      setResult({
        title: 'Membership reserved',
        text: `${plan.name} is waiting for payment. Pay ${formatPeso(plan.amount)} at the gym front desk to activate it.`,
      });
    } else {
      setResult({
        title: 'Payment received',
        text: `${plan.name} is now active. Enjoy your workouts!`,
      });
    }
  };

  const goToCurrent = () => {
    setResult(null);
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/current');
  };

  const title =
    mode === 'renew'
      ? 'Renew Membership'
      : mode === 'change'
        ? isDowngrade
          ? 'Downgrade Plan'
          : 'Upgrade Plan'
        : completing
          ? 'Complete Payment'
          : 'Payment';

  let buttonLabel = `PAY ${formatPeso(total)}`;
  if (isDowngrade) buttonLabel = 'SCHEDULE PLAN CHANGE';
  else if (!payNow) buttonLabel = 'RESERVE - PAY AT THE GYM';

  return (
    <Screen>
      <BackButton />
      <Text style={styles.title}>{title}</Text>

      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.muted2}>{plan.duration} • Plan ID {plan.id}</Text>
        </View>
        <Text style={styles.amount}>{plan.price}</Text>
      </View>

      {isUpgrade && (
        <View style={styles.breakdown}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{plan.name}</Text>
            <Text style={styles.breakdownValue}>{formatPeso(quote.new_amount)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Credit for the unused days of your current plan</Text>
            <Text style={styles.breakdownValue}>-{formatPeso(quote.credit)}</Text>
          </View>
          <Text style={styles.infoText}>
            The new plan starts now and runs until {formatDate(quote.ends)}.
          </Text>
        </View>
      )}
      {isDowngrade && (
        <View style={styles.breakdown}>
          <Text style={styles.infoText}>
            Your current plan keeps running until {formatDate(quote.effective)}. After that, your next
            renewal will be {plan.name} at {plan.price}. Nothing is charged now.
          </Text>
        </View>
      )}
      {mode === 'renew' && (
        <View style={styles.breakdown}>
          <Text style={styles.infoText}>
            {status === 'active'
              ? `Renewing adds ${plan.duration} to the end of your current membership.`
              : 'Your membership has expired. Renewing starts it again from today.'}
          </Text>
        </View>
      )}

      {methods.length > 0 && <Text style={styles.sectionTitle}>Payment method</Text>}
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
        <Text style={styles.totalLabel}>{isDowngrade ? 'Due today' : 'Total'}</Text>
        <Text style={styles.totalValue}>{isDowngrade ? formatPeso(0) : formatPeso(total)}</Text>
      </View>
      <View style={{ height: 16 }} />

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
      <PrimaryButton
        label={processing ? 'PROCESSING...' : buttonLabel}
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
  error: { color: COLORS.error ?? '#FF6B6B', fontSize: 14, marginBottom: 10 },
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
  breakdown: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  breakdownLabel: { color: COLORS.textMuted, fontSize: 14, flex: 1, paddingRight: 12 },
  breakdownValue: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  infoText: { color: COLORS.textMuted, fontSize: 14, lineHeight: 21 },
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
