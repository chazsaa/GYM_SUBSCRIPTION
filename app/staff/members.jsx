
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MembershipPill } from '../../components/admin/StatusPills';
import {
    Banner,
    Btn,
    Chips,
    DataTable,
    Page,
    Pager,
    SearchInput,
    useDebounced,
} from '../../components/admin/ui';
import { formatDate } from '../../context/SubscriptionContext';
import { rpc } from '../../lib/admin';
import { ADMIN } from '../../theme/adminTheme';

const PAGE_SIZE = 25;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring soon' },
  { key: 'pending', label: 'Pending payment' },
  { key: 'expired', label: 'Expired' },
  { key: 'none', label: 'No membership' },
];

export default function StaffMembers() {
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [offset, setOffset] = useState(0);

  const [state, setState] = useState({
    rows: [],
    total: 0,
    error: '',
    loading: true,
  });

  const debounced = useDebounced(search);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;

    setState((s) => ({ ...s, loading: true, error: '' }));

    const res = await rpc('staff_members', {
      p_search: debounced || null,
      p_status: status,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });

    if (id !== latest.current) return;

    if (!res.ok) {
      setState({
        rows: [],
        total: 0,
        error: res.message || 'Unable to load members.',
        loading: false,
      });
      return;
    }

    const rows = res.data ?? [];

    setState({
      rows,
      total: rows[0]?.total_count ?? 0,
      error: '',
      loading: false,
    });
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
    {
      key: 'status',
      title: 'Status',
      flex: 1.4,
      badge: true,
      render: (r) => (
        <MembershipPill
          status={r.status}
          endDate={r.end_date}
        />
      ),
    },
    {
      key: 'plan',
      title: 'Plan',
      flex: 1.6,
      render: (r) => r.plan_name || '-',
    },
    {
      key: 'expires',
      title: 'Expires',
      flex: 1.2,
      render: (r) =>
        r.status === 'active' || r.status === 'expired'
          ? formatDate(r.end_date)
          : '-',
    },
    {
      key: 'joined',
      title: 'Joined',
      flex: 1.1,
      render: (r) => formatDate(r.joined_at),
    },
  ];

  return (
    <Page
      title="Member Management"
      subtitle="View registered GymFit members and their membership status."
      actions={
        <>
          <Btn
            label="Back"
            kind="secondary"
            onPress={() => router.back()}
          />
          <Btn
            label="Refresh"
            icon="refresh"
            kind="secondary"
            onPress={load}
            disabled={state.loading}
          />
        </>
      }
    >
      <Banner
        tone="danger"
        text={state.error}
      />

      <View style={styles.toolbar}>
        <SearchInput
          value={search}
          onChangeText={(value) => {
            setSearch(value);
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
        emptyTitle="No members found"
        emptyText={
          search || status !== 'all'
            ? 'Try a different search or filter.'
            : 'Members appear here after they register.'
        }
      />

      <Pager
        total={state.total}
        offset={offset}
        limit={PAGE_SIZE}
        onChange={setOffset}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    gap: 12,
    marginBottom: 16,
  },
  name: {
    color: ADMIN.text,
    fontSize: 14,
    fontWeight: '700',
  },
  email: {
    color: ADMIN.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
});
