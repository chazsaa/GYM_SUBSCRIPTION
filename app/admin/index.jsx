import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Page,
  Card,
  Grid,
  StatCard,
  Btn,
  Banner,
  Loading,
  BarChart,
  Pill,
  EmptyState,
  useIsWide,
} from '../../components/admin/ui';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatDateTime } from '../../context/SubscriptionContext';
import { formatPeso } from '../../data/subscriptionPlans';
import { PaymentPill } from '../../components/admin/StatusPills';
import { rpc, METHOD_LABELS, shortDay } from '../../lib/admin';
import { ADMIN } from '../../theme/adminTheme';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
};

// A compact line in a list card: title + detail on the left, something on the right.
function ListRow({ title, detail, right, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ hovered }) => [styles.row, hovered && !!onPress && styles.rowHover]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {right}
    </Pressable>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const wide = useIsWide();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [stats, pending, recent] = await Promise.all([
      rpc('admin_dashboard_stats'),
      rpc('admin_pending_payments'),
      rpc('admin_payments', { p_limit: 6 }),
    ]);
    setError(stats.message || pending.message || recent.message);
    if (stats.ok) {
      setData({ stats: stats.data, pending: pending.data ?? [], recent: recent.data ?? [] });
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const firstName = (user?.name || '').trim().split(' ')[0];
  const stats = data?.stats;
  const open = (pathname, params) => router.push({ pathname, params });

  return (
    <Page
      title="Dashboard"
      subtitle={`${greeting()}${firstName ? `, ${firstName}` : ''}. Here is how GymFit is doing today.`}
      actions={<Btn label="Refresh" icon="refresh" kind="secondary" onPress={load} loading={loading && !!data} />}
    >
      <Banner tone="danger" text={error} />
      {!stats ? (
        loading ? <Loading label="Loading the overview…" /> : null
      ) : (
        <>
          <Grid min={210}>
            <StatCard
              label="Active members"
              value={stats.active_members}
              hint={`${stats.total_members} registered`}
              icon="account-check-outline"
              tone="success"
              onPress={() => open('/admin/members', { status: 'active' })}
            />
            <StatCard
              label="Expiring in 7 days"
              value={stats.expiring_soon}
              hint="Remind them to renew"
              icon="timer-sand"
              tone="warning"
              onPress={() => open('/admin/subscriptions', { status: 'expiring' })}
            />
            <StatCard
              label="Cash waiting for approval"
              value={stats.pending_cash_count}
              hint={stats.pending_cash_count ? formatPeso(stats.pending_cash_amount) : 'Nothing waiting'}
              icon="cash-clock"
              tone={stats.pending_cash_count ? 'danger' : 'neutral'}
              onPress={() => router.push('/admin/payments')}
            />
            <StatCard
              label="Revenue this month"
              value={formatPeso(stats.revenue_month)}
              hint={`Today ${formatPeso(stats.revenue_today)}`}
              icon="cash-multiple"
              tone="brand"
              onPress={() => router.push('/admin/reports')}
            />
          </Grid>
          <Grid min={210}>
            <StatCard
              label="New members (30 days)"
              value={stats.new_members_30d}
              icon="account-plus-outline"
              tone="info"
              onPress={() => open('/admin/members', { status: 'all' })}
            />
            <StatCard
              label="Expired memberships"
              value={stats.expired_members}
              icon="calendar-remove-outline"
              tone="danger"
              onPress={() => open('/admin/subscriptions', { status: 'expired' })}
            />
            <StatCard
              label="Without a membership"
              value={stats.no_membership}
              icon="account-off-outline"
              tone="neutral"
              onPress={() => open('/admin/members', { status: 'none' })}
            />
            <StatCard
              label="All-time revenue"
              value={formatPeso(stats.revenue_total)}
              icon="finance"
              tone="success"
              onPress={() => router.push('/admin/reports')}
            />
          </Grid>

          <View style={[styles.columns, wide && styles.columnsWide]}>
            <View style={styles.colMain}>
              <Card title="Revenue, last 7 days" subtitle="Tap a bar to see the exact amount">
                <BarChart
                  data={stats.daily_revenue.map((d) => ({ label: d.day, value: d.amount }))}
                  formatValue={formatPeso}
                  formatLabel={(label) => shortDay(label)}
                />
              </Card>

              <Card
                title="Recent payments"
                right={<Btn label="See all" kind="ghost" small onPress={() => router.push('/admin/payments')} />}
                flush
              >
                {data.recent.length === 0 ? (
                  <EmptyState icon="cash-remove" title="No payments yet" />
                ) : (
                  data.recent.map((p) => (
                    <ListRow
                      key={p.payment_id}
                      title={p.member_name || p.member_email}
                      detail={`${p.plan_name} · ${METHOD_LABELS[p.method] ?? p.method} · ${formatDateTime(p.paid_at || p.created_at)}`}
                      right={
                        <View style={styles.rowRight}>
                          <Text style={styles.rowAmount}>{formatPeso(p.amount)}</Text>
                          <PaymentPill status={p.status} />
                        </View>
                      }
                      onPress={() => router.push(`/admin/members/${p.member_id}`)}
                    />
                  ))
                )}
              </Card>
            </View>

            <View style={styles.colSide}>
              <Card
                title="Cash payments to approve"
                subtitle="Members who chose Pay at the Gym"
                right={<Btn label="Review" kind="ghost" small onPress={() => router.push('/admin/payments')} />}
                flush
              >
                {data.pending.length === 0 ? (
                  <EmptyState icon="check-circle-outline" title="All caught up" text="No cash payments are waiting." />
                ) : (
                  data.pending.slice(0, 5).map((p) => (
                    <ListRow
                      key={p.payment_id}
                      title={p.member_name || p.member_email}
                      detail={`${p.reference} · ${p.plan_name}`}
                      right={<Text style={styles.rowAmount}>{formatPeso(p.amount)}</Text>}
                      onPress={() => router.push('/admin/payments')}
                    />
                  ))
                )}
              </Card>

              <Card
                title="Expiring soon"
                subtitle="Memberships ending within 7 days"
                right={
                  <Btn
                    label="See all"
                    kind="ghost"
                    small
                    onPress={() => open('/admin/subscriptions', { status: 'expiring' })}
                  />
                }
                flush
              >
                {stats.expiring_list.length === 0 ? (
                  <EmptyState icon="calendar-check-outline" title="Nothing expiring soon" />
                ) : (
                  stats.expiring_list.map((m) => (
                    <ListRow
                      key={m.user_id}
                      title={m.member_name || m.member_email}
                      detail={`${m.plan_name} · ends ${formatDate(m.end_date)}`}
                      right={
                        <Pill
                          label={m.days_left === 0 ? 'Today' : `${m.days_left} day${m.days_left === 1 ? '' : 's'}`}
                          tone="warning"
                        />
                      }
                      onPress={() => router.push(`/admin/members/${m.user_id}`)}
                    />
                  ))
                )}
              </Card>
            </View>
          </View>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  columns: { gap: 0 },
  columnsWide: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  colMain: { flex: 3, minWidth: 0 },
  colSide: { flex: 2, minWidth: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: ADMIN.border,
    minHeight: 56,
  },
  rowHover: { backgroundColor: ADMIN.surfaceAlt },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: ADMIN.text, fontSize: 14, fontWeight: '700' },
  rowDetail: { color: ADMIN.textMuted, fontSize: 12, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowAmount: { color: ADMIN.text, fontSize: 14, fontWeight: '800' },
});
