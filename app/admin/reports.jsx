import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Page,
  Card,
  Grid,
  StatCard,
  Chips,
  Btn,
  Banner,
  Loading,
  BarChart,
  BarRow,
  EmptyState,
  useIsWide,
} from '../../components/admin/ui';
import { formatPeso } from '../../data/subscriptionPlans';
import { formatDate } from '../../context/SubscriptionContext';
import { rpc, gymDateRange, shortDay, METHOD_LABELS, KIND_LABELS } from '../../lib/admin';
import { ADMIN } from '../../theme/adminTheme';

const RANGES = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: '365', label: 'Last 12 months' },
];
const UNIT_LABELS = { day: 'day', week: 'week', month: 'month' };
const OUTCOMES = [
  ['paid', 'Paid', 'success'],
  ['pending', 'Pending', 'warning'],
  ['rejected', 'Rejected', 'danger'],
  ['failed', 'Failed', 'danger'],
  ['cancelled', 'Cancelled', 'neutral'],
];

// Breakdown card: one horizontal bar per item.
function Breakdown({ title, subtitle, items, labelOf, tone }) {
  const max = Math.max(0, ...items.map((i) => i.amount));
  return (
    <Card title={title} subtitle={subtitle}>
      {items.length === 0 ? (
        <Text style={styles.muted}>No payments in this period.</Text>
      ) : (
        items.map((item) => (
          <BarRow
            key={item.key}
            label={labelOf(item.key)}
            value={item.amount}
            max={max}
            tone={tone}
            valueLabel={`${formatPeso(item.amount)} · ${item.count} payment${item.count === 1 ? '' : 's'}`}
          />
        ))
      )}
    </Card>
  );
}

export default function Reports() {
  const wide = useIsWide();
  const [range, setRange] = useState('30');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    const { from, to } = gymDateRange(Number(range));
    const res = await rpc('admin_report', { p_from: from, p_to: to });
    if (id !== latest.current) return;
    if (res.ok) setReport(res.data);
    setError(res.message);
    setLoading(false);
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const r = report;
  const outcomeMax = r ? Math.max(1, ...OUTCOMES.map(([k]) => r.outcomes[k])) : 1;
  const nowMax = r ? Math.max(1, r.membership_now.active, r.membership_now.expiring_soon, r.membership_now.expired) : 1;

  return (
    <Page
      title="Reports"
      subtitle={r ? `${formatDate(r.from)} to ${formatDate(r.to)}` : 'Memberships, payments and revenue.'}
      actions={<Btn label="Refresh" icon="refresh" kind="secondary" onPress={load} />}
    >
      <View style={styles.toolbar}>
        <Chips options={RANGES} value={range} onChange={setRange} />
      </View>
      <Banner tone="danger" text={error} />

      {!r ? (
        loading ? <Loading label="Building the report…" /> : null
      ) : (
        <View style={loading ? styles.dim : null}>
          <Grid min={190}>
            <StatCard label="Revenue" value={formatPeso(r.revenue_total)} icon="cash-multiple" tone="success" />
            <StatCard label="Payments received" value={r.paid_count} hint={`Average ${formatPeso(r.average_payment)}`} icon="receipt-text-outline" tone="brand" />
            <StatCard label="New members" value={r.new_members} icon="account-plus-outline" tone="info" />
            <StatCard label="Memberships ended early" value={r.cancellations} hint={`Paid memberships ended · ${r.released_reservations ?? 0} unpaid reservations released`} icon="account-cancel-outline" tone="danger" />
          </Grid>

          <Card
            title={`Revenue per ${UNIT_LABELS[r.unit]}`}
            subtitle={r.unit === 'week' ? 'Each bar starts on the Monday shown' : r.unit === 'month' ? 'Each bar is one month' : 'Tap a bar to see the exact amount'}
          >
            <BarChart
              data={r.series.map((s) => ({ label: s.label, value: s.amount }))}
              formatValue={formatPeso}
              formatLabel={(label) => shortDay(label, r.unit)}
            />
          </Card>

          <View style={[styles.columns, wide && styles.columnsWide]}>
            <View style={styles.col}>
              <Breakdown title="Revenue by plan" items={r.by_plan} labelOf={(k) => k} tone="brand" />
              <Breakdown title="Revenue by payment method" items={r.by_method} labelOf={(k) => METHOD_LABELS[k] ?? k} tone="info" />
              <Breakdown title="New, renewal and upgrade" items={r.by_kind} labelOf={(k) => KIND_LABELS[k] ?? k} tone="success" />
            </View>
            <View style={styles.col}>
              <Card title="Payment outcomes" subtitle="Payments started in this period">
                {OUTCOMES.map(([key, label, tone]) => (
                  <BarRow key={key} label={label} value={r.outcomes[key]} max={outcomeMax} tone={tone} valueLabel={String(r.outcomes[key])} />
                ))}
              </Card>
              <Card title="Memberships right now" subtitle="Not affected by the period above">
                <BarRow label="Active" value={r.membership_now.active} max={nowMax} tone="success" valueLabel={String(r.membership_now.active)} />
                <BarRow label="Expiring within 7 days" value={r.membership_now.expiring_soon} max={nowMax} tone="warning" valueLabel={String(r.membership_now.expiring_soon)} />
                <BarRow label="Expired" value={r.membership_now.expired} max={nowMax} tone="danger" valueLabel={String(r.membership_now.expired)} />
              </Card>
              {r.paid_count === 0 && r.new_members === 0 && (
                <Card>
                  <EmptyState icon="chart-line-variant" title="Quiet period" text="Nothing happened in this period yet. Try a longer range." />
                </Card>
              )}
            </View>
          </View>
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  toolbar: { marginBottom: 16 },
  dim: { opacity: 0.55 },
  columns: { gap: 0 },
  columnsWide: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  col: { flex: 1, minWidth: 0 },
  muted: { color: ADMIN.textMuted, fontSize: 14 },
});
