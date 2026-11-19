import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Page,
  SearchInput,
  Chips,
  DataTable,
  Pager,
  Btn,
  Banner,
  useDebounced,
} from '../../../components/admin/ui';
import { formatDate } from '../../../context/SubscriptionContext';
import { formatPeso } from '../../../data/subscriptionPlans';
import { MembershipPill } from '../../../components/admin/StatusPills';
import { rpc } from '../../../lib/admin';
import { ADMIN } from '../../../theme/adminTheme';

const PAGE_SIZE = 25;
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring soon' },
  { key: 'pending', label: 'Pending payment' },
  { key: 'expired', label: 'Expired' },
  { key: 'none', label: 'No membership' },
];

export default function Members() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initial = FILTERS.some((f) => f.key === params.status) ? params.status : 'all';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initial);
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState({ rows: [], total: 0, error: '', loading: true });
  const debounced = useDebounced(search);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true }));
    const res = await rpc('admin_members', {
      p_search: debounced || null,
      p_status: status,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    if (id !== latest.current) return; // a newer search is already running
    const rows = res.data ?? [];
    setState({ rows, total: rows[0]?.total_count ?? 0, error: res.message, loading: false });
  }, [debounced, status, offset]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const columns = [
    {
      key: 'member',
      title: 'Member',
      flex: 2.4,
      primary: true,
      render: (r) => (
        <View>
          <Text style={styles.name} numberOfLines={1}>
            {r.full_name || 'No name'}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {r.email}
          </Text>
        </View>
      ),
    },
    { key: 'status', title: 'Status', flex: 1.4, badge: true, render: (r) => <MembershipPill status={r.status} endDate={r.end_date} /> },
    { key: 'plan', title: 'Plan', flex: 1.6, render: (r) => r.plan_name || '-' },
    {
      key: 'expires',
      title: 'Expires',
      flex: 1.2,
      render: (r) => (r.status === 'active' || r.status === 'expired' ? formatDate(r.end_date) : '-'),
    },
    { key: 'paid', title: 'Total paid', flex: 1.1, align: 'right', render: (r) => formatPeso(r.total_paid) },
    { key: 'joined', title: 'Joined', flex: 1.1, render: (r) => formatDate(r.joined_at) },
  ];

  return (
    <Page
      title="Members"
      subtitle="Everyone who registered in the GymFit app. Open a member to see their membership and payments."
      actions={<Btn label="Refresh" icon="refresh" kind="secondary" onPress={load} />}
    >
      <Banner tone="danger" text={state.error} />
      <View style={styles.toolbar}>
        <SearchInput
          value={search}
          onChangeText={(text) => {
            setSearch(text);
            setOffset(0);
          }}
          placeholder="Search by name or email"
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
        keyOf={(r) => r.user_id}
        onRowPress={(r) => router.push(`/admin/members/${r.user_id}`)}
        emptyTitle="No members found"
        emptyText={search || status !== 'all' ? 'Try a different search or filter.' : 'Members appear here after they register.'}
      />
      <Pager total={state.total} offset={offset} limit={PAGE_SIZE} onChange={setOffset} />
    </Page>
  );
}

const styles = StyleSheet.create({
  toolbar: { gap: 12, marginBottom: 16 },
  name: { color: ADMIN.text, fontSize: 14, fontWeight: '700' },
  email: { color: ADMIN.textMuted, fontSize: 12, marginTop: 1 },
});
