import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Page,
  Card,
  Tabs,
  SearchInput,
  Chips,
  DataTable,
  Pager,
  Pill,
  Btn,
  Banner,
  Loading,
  Dialog,
  ConfirmModal,
  Field,
  Grid,
  useDebounced,
} from '../../components/admin/ui';
import { MembershipPill } from '../../components/admin/StatusPills';
import { useMembershipActions } from '../../components/admin/MembershipActions';
import { formatDate } from '../../context/SubscriptionContext';
import { formatPeso } from '../../data/subscriptionPlans';
import { rpc, METHOD_LABELS, ENDED_REASONS } from '../../lib/admin';
import { ADMIN } from '../../theme/adminTheme';

const PAGE_SIZE = 25;
const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring soon' },
  { key: 'pending', label: 'Pending payment' },
  { key: 'expired', label: 'Expired' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

// ---- Memberships tab ---------------------------------------------------------
function Memberships({ onNotice }) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initial = FILTERS.some((f) => f.key === params.status) ? params.status : 'active';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initial);
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState({ rows: [], total: 0, error: '', loading: true });
  const debounced = useDebounced(search);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true }));
    const res = await rpc('admin_subscriptions', {
      p_status: status,
      p_search: debounced || null,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    if (id !== latest.current) return;
    const rows = res.data ?? [];
    setState({ rows, total: rows[0]?.total_count ?? 0, error: res.message, loading: false });
  }, [status, debounced, offset]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const { requestExtend, requestCancel, dialogs } = useMembershipActions((result) => {
    onNotice(result.text);
    load();
  });

  const actionable = (r) => r.status === 'active' || r.status === 'pending';

  const columns = [
    {
      key: 'member',
      title: 'Member',
      flex: 2.2,
      primary: true,
      render: (r) => (
        <View>
          <Text style={styles.name} numberOfLines={1}>
            {r.member_name || 'No name'}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {r.member_email}
          </Text>
        </View>
      ),
    },
    { key: 'plan', title: 'Plan', flex: 1.6, render: (r) => r.plan_name },
    { key: 'status', title: 'Status', flex: 1.3, badge: true, render: (r) => <MembershipPill status={r.status} endDate={r.end_date} /> },
    { key: 'start', title: 'Started', flex: 1.1, render: (r) => formatDate(r.start_date) },
    {
      key: 'end',
      title: 'Expires',
      flex: 1.5,
      render: (r) =>
        r.status === 'active'
          ? `${formatDate(r.end_date)} · ${r.days_left} day${r.days_left === 1 ? '' : 's'} left`
          : r.status === 'cancelled'
            ? ENDED_REASONS[r.ended_reason] ?? 'Cancelled'
            : formatDate(r.end_date),
    },
    { key: 'method', title: 'Paid by', flex: 1.2, render: (r) => METHOD_LABELS[r.method] ?? '-' },
    {
      key: 'next',
      title: 'Next plan',
      flex: 1.2,
      render: (r) => r.next_plan_name || '-',
    },
    {
      key: 'actions',
      title: 'Actions',
      flex: 1.9,
      actions: true,
      render: (r) =>
        actionable(r) ? (
          <View style={styles.rowActions}>
            {r.status === 'active' && (
              <Btn label="Extend" kind="secondary" small onPress={() => requestExtend(r)} />
            )}
            <Btn
              label={r.status === 'pending' ? 'Release' : 'End'}
              kind="danger"
              small
              onPress={() => requestCancel(r)}
            />
          </View>
        ) : (
          <Text style={styles.sub}>-</Text>
        ),
    },
  ];

  return (
    <>
      <Banner tone="danger" text={state.error} />
      <View style={styles.toolbar}>
        <SearchInput
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            setOffset(0);
          }}
          placeholder="Search by member name or email"
        />
        <Chips
          options={FILTERS}
          value={status}
          onChange={(key) => {
            setStatus(key);
            setOffset(0);
          }}
        />
      </View>
      <DataTable
        columns={columns}
        rows={state.rows}
        loading={state.loading}
        keyOf={(r) => r.subscription_id}
        onRowPress={(r) => router.push(`/admin/members/${r.user_id}`)}
        emptyTitle="No memberships here"
        emptyText="Try a different filter."
      />
      <Pager total={state.total} offset={offset} limit={PAGE_SIZE} onChange={setOffset} />
      {dialogs}
    </>
  );
}

// ---- Plans tab ----------------------------------------------------------------
function Plans({ onNotice }) {
  const [state, setState] = useState({ plans: [], error: '', loading: true });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', amount: '', description: '' });
  const [formError, setFormError] = useState('');
  const [toggling, setToggling] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await rpc('admin_plans');
    setState({ plans: res.data ?? [], error: res.message, loading: false });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openEdit = (plan) => {
    setForm({ name: plan.name, amount: String(plan.amount), description: plan.description });
    setFormError('');
    setEditing(plan);
  };

  const save = async () => {
    const amount = Number(form.amount);
    if (!Number.isInteger(amount) || amount < 1) {
      setFormError('Enter the price as a whole number of pesos, for example 1000.');
      return;
    }
    setBusy(true);
    setFormError('');
    const res = await rpc('admin_update_plan', {
      p_plan_id: editing.plan_id,
      p_name: form.name,
      p_amount: amount,
      p_description: form.description,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setEditing(null);
    onNotice(`Saved ${form.name.trim()}. The new details apply to new purchases.`);
    load();
  };

  const toggle = async () => {
    setBusy(true);
    const res = await rpc('admin_update_plan', {
      p_plan_id: toggling.plan_id,
      p_is_active: !toggling.is_active,
    });
    setBusy(false);
    const name = toggling.name;
    const turningOn = !toggling.is_active;
    setToggling(null);
    if (!res.ok) {
      setState((s) => ({ ...s, error: res.message }));
      return;
    }
    onNotice(turningOn ? `${name} is on sale again.` : `${name} is hidden from new members.`);
    load();
  };

  if (state.loading) return <Loading label="Loading plans…" />;

  return (
    <>
      <Banner tone="danger" text={state.error} />
      <Text style={styles.note}>
        A new price or name applies to future purchases only. Members keep what they already paid for. The length of a plan
        cannot be changed here.
      </Text>
      <Grid min={300}>
        {state.plans.map((plan) => (
          <Card
            key={plan.plan_id}
            title={plan.name}
            subtitle={plan.duration_label}
            right={<Pill label={plan.is_active ? 'On sale' : 'Hidden'} tone={plan.is_active ? 'success' : 'neutral'} />}
          >
            <Text style={styles.price}>{formatPeso(plan.amount)}</Text>
            {!!plan.description && <Text style={styles.desc}>{plan.description}</Text>}
            <View style={styles.planStats}>
              <View>
                <Text style={styles.statNum}>{plan.active_members}</Text>
                <Text style={styles.sub}>active members</Text>
              </View>
              <View>
                <Text style={styles.statNum}>{formatPeso(plan.total_revenue)}</Text>
                <Text style={styles.sub}>all-time revenue</Text>
              </View>
            </View>
            <View style={styles.rowActions}>
              <Btn label="Edit" icon="pencil-outline" kind="secondary" small onPress={() => openEdit(plan)} />
              <Btn
                label={plan.is_active ? 'Hide' : 'Put on sale'}
                kind={plan.is_active ? 'danger' : 'secondary'}
                small
                onPress={() => setToggling(plan)}
              />
            </View>
          </Card>
        ))}
      </Grid>

      <Dialog
        visible={!!editing}
        title="Edit plan"
        onClose={() => setEditing(null)}
        footer={
          <>
            <Btn label="Cancel" kind="secondary" onPress={() => setEditing(null)} disabled={busy} />
            <Btn label="Save" onPress={save} loading={busy} />
          </>
        }
      >
        <Banner tone="danger" text={formError} />
        <Field label="Plan name" value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} maxLength={60} />
        <Field
          label="Price (₱)"
          value={form.amount}
          onChangeText={(t) => setForm((f) => ({ ...f, amount: t.replace(/[^0-9]/g, '') }))}
          keyboardType="number-pad"
          maxLength={7}
        />
        <Field
          label="Description"
          value={form.description}
          onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
          multiline
          maxLength={500}
        />
      </Dialog>

      <ConfirmModal
        visible={!!toggling}
        title={toggling?.is_active ? 'Hide this plan?' : 'Put this plan on sale?'}
        danger={!!toggling?.is_active}
        busy={busy}
        confirmLabel={toggling?.is_active ? 'Hide plan' : 'Put on sale'}
        message={
          toggling?.is_active
            ? `${toggling.name} will no longer be offered to new members. Members who already have it keep it, but cannot renew it while it is hidden.`
            : `${toggling?.name ?? 'This plan'} will show in the member app again.`
        }
        onConfirm={toggle}
        onCancel={() => setToggling(null)}
      />
    </>
  );
}

export default function Subscriptions() {
  const params = useLocalSearchParams();
  const [tab, setTab] = useState(params.tab === 'plans' ? 'plans' : 'memberships');
  const [notice, setNotice] = useState('');

  return (
    <Page
      title="Subscriptions"
      subtitle="Membership status and expiry dates, and the plans members can buy."
    >
      <Tabs
        options={[
          { key: 'memberships', label: 'Memberships' },
          { key: 'plans', label: 'Plans' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Banner tone="success" text={notice} onClose={() => setNotice('')} />
      {tab === 'memberships' ? <Memberships onNotice={setNotice} /> : <Plans onNotice={setNotice} />}
    </Page>
  );
}

const styles = StyleSheet.create({
  toolbar: { gap: 12, marginBottom: 16 },
  name: { color: ADMIN.text, fontSize: 14, fontWeight: '700' },
  sub: { color: ADMIN.textMuted, fontSize: 12 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { color: ADMIN.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  price: { color: ADMIN.text, fontSize: 26, fontWeight: '800' },
  desc: { color: ADMIN.textMuted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  planStats: { flexDirection: 'row', gap: 28, marginVertical: 14 },
  statNum: { color: ADMIN.text, fontSize: 17, fontWeight: '800' },
});
