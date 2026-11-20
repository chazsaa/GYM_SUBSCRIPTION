import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Page,
  Card,
  Grid,
  SearchInput,
  Chips,
  DataTable,
  Pager,
  Btn,
  Banner,
  Dialog,
  ConfirmModal,
  DetailRow,
  EmptyState,
  useDebounced,
} from '../../components/admin/ui';
import { PaymentPill } from '../../components/admin/StatusPills';
import { formatDateTime } from '../../context/SubscriptionContext';
import { formatPeso } from '../../data/subscriptionPlans';
import { rpc, METHOD_LABELS, KIND_LABELS } from '../../lib/admin';
import { ADMIN } from '../../theme/adminTheme';

const PAGE_SIZE = 25;
const REASONS = ['Payment not received', 'Wrong amount', 'Member did not show up'];
const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'pending', label: 'Pending' },
  { key: 'unsuccessful', label: 'Unsuccessful' },
];
const METHOD_FILTERS = [
  { key: 'all', label: 'Any method' },
  { key: 'gym', label: 'Cash' },
  { key: 'gcash', label: 'GCash' },
  { key: 'maya', label: 'Maya' },
  { key: 'card', label: 'Card' },
];

export default function Payments() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [method, setMethod] = useState('all');
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState([]);
  const [state, setState] = useState({ rows: [], total: 0, error: '', loading: true });
  const [notice, setNotice] = useState('');
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const debounced = useDebounced(search);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true }));
    const [waiting, list] = await Promise.all([
      rpc('admin_pending_payments'),
      rpc('admin_payments', {
        p_status: status,
        p_method: method,
        p_search: debounced || null,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      }),
    ]);
    if (id !== latest.current) return;
    setPending(waiting.data ?? []);
    const rows = list.data ?? [];
    setState({
      rows,
      total: rows[0]?.total_count ?? 0,
      error: waiting.message || list.message,
      loading: false,
    });
  }, [status, method, debounced, offset]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const review = async (payment, approve, reason) => {
    if (busy) return;
    setBusy(true);
    setNotice('');
    const res = await rpc('admin_review_payment', {
      p_payment_id: payment.payment_id,
      p_approve: approve,
      p_reason: reason ?? null,
    });
    setBusy(false);
    setApproving(null);
    setRejecting(null);
    const who = payment.member_name || payment.member_email;
    if (res.ok) {
      setNotice(
        approve
          ? `Confirmed ${formatPeso(payment.amount)} from ${who}. Their membership has started.`
          : `Rejected the payment from ${who}. The reservation was released.`
      );
    }
    await load();
    if (!res.ok) setState((s) => ({ ...s, error: res.message }));
  };

  // Read nullable values here, not inside button handlers: the React Compiler
  // evaluates what a handler uses every time the screen draws.
  const selectedMemberId = selected?.member_id;

  const needle = search.trim().toLowerCase();
  const waiting = pending.filter(
    (p) =>
      !needle || [p.reference, p.member_name, p.member_email].some((v) => (v || '').toLowerCase().includes(needle))
  );

  const columns = [
    {
      key: 'member',
      title: 'Member',
      flex: 2.2,
      primary: true,
      render: (p) => (
        <View>
          <Text style={styles.name} numberOfLines={1}>
            {p.member_name || p.member_email}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {p.status === 'paid' ? p.receipt_number : p.reference}
          </Text>
        </View>
      ),
    },
    { key: 'plan', title: 'Plan', flex: 1.8, render: (p) => `${p.plan_name} · ${KIND_LABELS[p.kind] ?? p.kind}` },
    { key: 'method', title: 'Method', flex: 1.3, render: (p) => METHOD_LABELS[p.method] ?? p.method },
    { key: 'status', title: 'Status', flex: 1.1, badge: true, render: (p) => <PaymentPill status={p.status} /> },
    { key: 'date', title: 'Date', flex: 1.6, render: (p) => formatDateTime(p.paid_at || p.created_at) },
    { key: 'amount', title: 'Amount', flex: 1, align: 'right', render: (p) => formatPeso(p.amount) },
  ];

  return (
    <Page
      title="Payments"
      subtitle="Approve cash payments and keep track of every transaction."
      actions={<Btn label="Refresh" icon="refresh" kind="secondary" onPress={load} />}
    >
      <Banner tone="success" text={notice} onClose={() => setNotice('')} />
      <Banner tone="danger" text={state.error} />

      <View style={styles.toolbar}>
        <SearchInput
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            setOffset(0);
          }}
          placeholder="Search by payment code, receipt number or member"
        />
      </View>

      <Text style={styles.heading}>Waiting for cash payment ({waiting.length})</Text>
      {waiting.length === 0 ? (
        <Card>
          <EmptyState
            icon="check-circle-outline"
            title="No cash payments are waiting"
            text="When a member chooses Pay at the Gym, the reservation shows here until you confirm the cash."
          />
        </Card>
      ) : (
        <Grid min={300}>
          {waiting.map((p) => (
            <Card key={p.payment_id}>
              <View style={styles.pendingTop}>
                <Text style={styles.pendingName} numberOfLines={1}>
                  {p.member_name || p.member_email}
                </Text>
                <Text style={styles.pendingAmount}>{formatPeso(p.amount)}</Text>
              </View>
              {!!p.member_name && <Text style={styles.sub}>{p.member_email}</Text>}
              <Text style={styles.sub}>
                {p.plan_name} · {formatDateTime(p.created_at)}
              </Text>
              <Text selectable style={styles.code}>
                {p.reference}
              </Text>
              <View style={styles.rowActions}>
                <Btn label="Approve" icon="check" onPress={() => setApproving(p)} disabled={busy} style={styles.flex1} />
                <Btn label="Reject" kind="danger" onPress={() => setRejecting(p)} disabled={busy} style={styles.flex1} />
              </View>
            </Card>
          ))}
        </Grid>
      )}

      <Text style={styles.heading}>All transactions</Text>
      <View style={styles.toolbar}>
        <Chips
          options={STATUS_FILTERS}
          value={status}
          onChange={(k) => {
            setStatus(k);
            setOffset(0);
          }}
        />
        <Chips
          options={METHOD_FILTERS}
          value={method}
          onChange={(k) => {
            setMethod(k);
            setOffset(0);
          }}
        />
      </View>
      <DataTable
        columns={columns}
        rows={state.rows}
        loading={state.loading}
        keyOf={(p) => p.payment_id}
        onRowPress={setSelected}
        emptyTitle="No transactions found"
        emptyText="Try a different filter or search."
      />
      <Pager total={state.total} offset={offset} limit={PAGE_SIZE} onChange={setOffset} />

      <ConfirmModal
        visible={!!approving}
        title="Confirm cash received?"
        busy={busy}
        confirmLabel="Yes, approve"
        cancelLabel="Not yet"
        message={
          approving
            ? `Confirm that you received ${formatPeso(approving.amount)} in cash from ${
                approving.member_name || approving.member_email
              } (${approving.reference}). Their membership will start now.`
            : ''
        }
        onConfirm={() => review(approving, true)}
        onCancel={() => setApproving(null)}
      />

      <Dialog
        visible={!!rejecting}
        title="Reject this payment?"
        onClose={() => setRejecting(null)}
        footer={<Btn label="Cancel" kind="secondary" onPress={() => setRejecting(null)} />}
      >
        <Text style={styles.dialogText}>
          Choose a reason. The reservation is released and the member can see the reason.
        </Text>
        {REASONS.map((reason) => (
          <Pressable
            key={reason}
            onPress={() => review(rejecting, false, reason)}
            accessibilityRole="button"
            style={({ hovered }) => [styles.reason, hovered && styles.reasonHover]}
          >
            <Text style={styles.reasonText}>{reason}</Text>
          </Pressable>
        ))}
      </Dialog>

      <Dialog
        visible={!!selected}
        title="Payment details"
        onClose={() => setSelected(null)}
        footer={
          <>
            <Btn
              label="View member"
              kind="secondary"
              onPress={() => {
                setSelected(null);
                router.push(`/admin/members/${selectedMemberId}`);
              }}
            />
            <Btn label="Close" onPress={() => setSelected(null)} />
          </>
        }
      >
        {!!selected && (
          <>
            <DetailRow label="Member">{selected.member_name || selected.member_email}</DetailRow>
            <DetailRow label="Email">{selected.member_email}</DetailRow>
            <DetailRow label="Plan">{`${selected.plan_name} · ${KIND_LABELS[selected.kind] ?? selected.kind}`}</DetailRow>
            <DetailRow label="Amount">{formatPeso(selected.amount)}</DetailRow>
            <DetailRow label="Method">{METHOD_LABELS[selected.method] ?? selected.method}</DetailRow>
            <DetailRow label="Status">
              <PaymentPill status={selected.status} />
            </DetailRow>
            <DetailRow label="Payment code">{selected.reference}</DetailRow>
            <DetailRow label="Receipt number">{selected.receipt_number || '-'}</DetailRow>
            <DetailRow label="Created">{formatDateTime(selected.created_at)}</DetailRow>
            <DetailRow label="Paid">{formatDateTime(selected.paid_at)}</DetailRow>
            {!!selected.reviewed_by_name && (
              <DetailRow label="Reviewed by">{`${selected.reviewed_by_name}, ${formatDateTime(selected.reviewed_at)}`}</DetailRow>
            )}
            {!!selected.rejection_reason && <DetailRow label="Reason">{selected.rejection_reason}</DetailRow>}
          </>
        )}
      </Dialog>
    </Page>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  toolbar: { gap: 12, marginBottom: 16 },
  heading: { color: ADMIN.text, fontSize: 16, fontWeight: '800', marginBottom: 12, marginTop: 4 },
  name: { color: ADMIN.text, fontSize: 14, fontWeight: '700' },
  sub: { color: ADMIN.textMuted, fontSize: 12, marginTop: 1 },
  pendingTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
  pendingName: { flex: 1, color: ADMIN.text, fontSize: 16, fontWeight: '800' },
  pendingAmount: { color: ADMIN.text, fontSize: 16, fontWeight: '800' },
  code: { color: ADMIN.brand, fontSize: 22, fontWeight: '800', letterSpacing: 2, marginVertical: 10 },
  rowActions: { flexDirection: 'row', gap: 10 },
  dialogText: { color: ADMIN.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  reason: {
    borderWidth: 1,
    borderColor: ADMIN.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: 8,
  },
  reasonHover: { backgroundColor: ADMIN.surfaceAlt },
  reasonText: { color: ADMIN.text, fontSize: 15, fontWeight: '600' },
});
