import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Page,
  Card,
  Btn,
  Banner,
  Loading,
  EmptyState,
  DetailRow,
  Grid,
  StatCard,
  DataTable,
} from '../../../components/admin/ui';
import { MembershipPill, PaymentPill } from '../../../components/admin/StatusPills';
import { useMembershipActions } from '../../../components/admin/MembershipActions';
import { formatDate, formatDateTime } from '../../../context/SubscriptionContext';
import { formatPeso } from '../../../data/subscriptionPlans';
import { rpc, METHOD_LABELS, KIND_LABELS, ENDED_REASONS, daysUntil } from '../../../lib/admin';
import { ADMIN } from '../../../theme/adminTheme';

export default function MemberDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const memberId = Array.isArray(id) ? id[0] : id;
  const [member, setMember] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await rpc('admin_member_detail', { p_user_id: memberId });
    if (res.ok) setMember(res.data);
    setError(res.message);
    setLoading(false);
  }, [memberId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const { requestExtend, requestCancel, dialogs } = useMembershipActions((result) => {
    setNotice(result.text);
    load();
  });

  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin/members'));
  const backButton = <Btn label="All members" icon="chevron-left" kind="secondary" onPress={back} />;

  if (!member) {
    return (
      <Page title="Member" actions={backButton}>
        <Banner tone="danger" text={error} />
        {loading ? <Loading label="Loading the member…" /> : <EmptyState icon="account-question-outline" title="Member not found" />}
      </Page>
    );
  }

  // The membership the admin can act on right now.
  const target = {
    subscription_id: member.current_subscription_id,
    member_name: member.full_name || member.email,
    plan_name: member.subscriptions[0]?.plan_name ?? 'membership',
    status: member.status,
    end_date: member.current_end,
  };
  const canAct = member.status === 'active' || member.status === 'pending';

  const subColumns = [
    { key: 'plan', title: 'Plan', flex: 2, primary: true, render: (s) => s.plan_name },
    { key: 'status', title: 'Status', flex: 1.4, badge: true, render: (s) => <MembershipPill status={s.status} endDate={s.end_date} /> },
    { key: 'start', title: 'Started', flex: 1.3, render: (s) => formatDate(s.start_date) },
    { key: 'end', title: 'Ends', flex: 1.3, render: (s) => formatDate(s.end_date) },
    { key: 'why', title: 'Ended because', flex: 2, render: (s) => ENDED_REASONS[s.ended_reason] ?? '-' },
  ];

  const payColumns = [
    { key: 'ref', title: 'Reference', flex: 1.6, primary: true, render: (p) => <Text selectable style={styles.mono}>{p.status === 'paid' ? p.receipt_number : p.reference}</Text> },
    { key: 'status', title: 'Status', flex: 1.2, badge: true, render: (p) => <PaymentPill status={p.status} /> },
    { key: 'plan', title: 'Plan', flex: 1.8, render: (p) => `${p.plan_name} · ${KIND_LABELS[p.kind] ?? p.kind}` },
    { key: 'method', title: 'Method', flex: 1.4, render: (p) => METHOD_LABELS[p.method] ?? p.method },
    { key: 'date', title: 'Date', flex: 1.6, render: (p) => formatDateTime(p.paid_at || p.created_at) },
    { key: 'amount', title: 'Amount', flex: 1, align: 'right', render: (p) => formatPeso(p.amount) },
  ];

  return (
    <Page
      title={member.full_name || 'Member'}
      subtitle={member.email}
      actions={backButton}
    >
      <Banner tone="success" text={notice} onClose={() => setNotice('')} />
      <Banner tone="danger" text={error} />

      <Grid min={200}>
        <StatCard label="Total paid" value={formatPeso(member.total_paid)} icon="cash-multiple" tone="success" />
        <StatCard label="Member since" value={formatDate(member.joined_at)} icon="calendar-account-outline" tone="info" />
      </Grid>

      <Card
        title="Current membership"
        right={<MembershipPill status={member.status} endDate={member.current_end} />}
      >
        {member.status === 'none' ? (
          <Text style={styles.muted}>This member has no membership right now.</Text>
        ) : (
          <>
            <DetailRow label="Plan">{target.plan_name}</DetailRow>
            <DetailRow label="Started">{formatDate(member.current_start)}</DetailRow>
            <DetailRow label={member.status === 'expired' ? 'Ended' : 'Ends'}>{formatDate(member.current_end)}</DetailRow>
            {member.status === 'active' && (
              <DetailRow label="Days left">{String(daysUntil(member.current_end))}</DetailRow>
            )}
            {member.status === 'pending' && (
              <DetailRow label="Waiting for">The first payment</DetailRow>
            )}
          </>
        )}
        {canAct && (
          <View style={styles.actions}>
            {member.status === 'active' && (
              <Btn label="Extend" icon="calendar-plus" kind="secondary" onPress={() => requestExtend(target)} />
            )}
            <Btn
              label={member.status === 'pending' ? 'Release reservation' : 'End membership'}
              icon="close-circle-outline"
              kind="danger"
              onPress={() => requestCancel(target)}
            />
          </View>
        )}
      </Card>

      <Text style={styles.heading}>Membership history</Text>
      <DataTable
        columns={subColumns}
        rows={member.subscriptions}
        keyOf={(s) => s.subscription_id}
        emptyTitle="No memberships yet"
      />

      <Text style={styles.heading}>Payments</Text>
      <DataTable
        columns={payColumns}
        rows={member.payments}
        keyOf={(p) => p.payment_id}
        emptyTitle="No payments yet"
      />
      {dialogs}
    </Page>
  );
}

const styles = StyleSheet.create({
  muted: { color: ADMIN.textMuted, fontSize: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  heading: { color: ADMIN.text, fontSize: 16, fontWeight: '800', marginTop: 8, marginBottom: 10 },
  mono: { color: ADMIN.text, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
});
