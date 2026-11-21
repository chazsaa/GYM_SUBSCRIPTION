import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    Banner,
    Btn,
    DataTable,
    Dialog,
    Page,
    Pager,
    SearchInput,
    useDebounced,
} from '../../components/admin/ui';
import { rpc } from '../../lib/admin';
import { ADMIN } from '../../theme/adminTheme';

const PAGE_SIZE = 25;

function formatTime(value) {
  if (!value) return '-';

  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function StaffAttendance() {
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const [state, setState] = useState({
    rows: [],
    total: 0,
    error: '',
    loading: true,
  });

  const [dialog, setDialog] = useState({
    visible: false,
    type: '',
    row: null,
    busy: false,
    error: '',
  });

  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);

  const [memberState, setMemberState] = useState({
    rows: [],
    loading: false,
    error: '',
  });

  const debounced = useDebounced(search);
  const debouncedMemberSearch = useDebounced(memberSearch);

  const latest = useRef(0);
  const memberLatest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;

    setState((s) => ({
      ...s,
      loading: true,
      error: '',
    }));

    const res = await rpc('staff_attendance_list', {
      p_search: debounced || null,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });

    if (id !== latest.current) return;

    if (!res.ok) {
      setState({
        rows: [],
        total: 0,
        error: res.message || 'Unable to load attendance records.',
        loading: false,
      });
      return;
    }

    const rows = res.data ?? [];

    setState({
      rows,
      total: Number(rows[0]?.total_count ?? 0),
      error: '',
      loading: false,
    });
  }, [debounced, offset]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadEligibleMembers = useCallback(async () => {
    const id = ++memberLatest.current;

    setMemberState((s) => ({
      ...s,
      loading: true,
      error: '',
    }));

    const res = await rpc('staff_members', {
      p_search: debouncedMemberSearch || null,
      p_status: 'active',
      p_limit: 100,
      p_offset: 0,
    });

    if (id !== memberLatest.current) return;

    if (!res.ok) {
      setMemberState({
        rows: [],
        loading: false,
        error: res.message || 'Unable to load active members.',
      });
      return;
    }

    setMemberState({
      rows: res.data ?? [],
      loading: false,
      error: '',
    });
  }, [debouncedMemberSearch]);

  useEffect(() => {
    if (dialog.visible && dialog.type === 'checkin') {
      loadEligibleMembers();
    }
  }, [dialog.visible, dialog.type, loadEligibleMembers]);

  const openCheckIn = () => {
    setMemberSearch('');
    setSelectedMember(null);

    setMemberState({
      rows: [],
      loading: true,
      error: '',
    });

    setDialog({
      visible: true,
      type: 'checkin',
      row: null,
      busy: false,
      error: '',
    });
  };

  const openCheckOut = (row) => {
    setDialog({
      visible: true,
      type: 'checkout',
      row,
      busy: false,
      error: '',
    });
  };

  const closeDialog = () => {
    setDialog({
      visible: false,
      type: '',
      row: null,
      busy: false,
      error: '',
    });

    setSelectedMember(null);
    setMemberSearch('');
  };

  const submitAction = async () => {
    if (dialog.busy) return;

    if (dialog.type === 'checkin' && !selectedMember) {
      setDialog((s) => ({
        ...s,
        error: 'Please select a member first.',
      }));
      return;
    }

    setDialog((s) => ({
      ...s,
      busy: true,
      error: '',
    }));

    let res;

    if (dialog.type === 'checkin') {
      res = await rpc('staff_attendance_check_in', {
        p_user_id: selectedMember.user_id,
      });
    } else {
      res = await rpc('staff_attendance_check_out', {
        p_attendance_id: dialog.row.id,
      });
    }

    if (!res.ok) {
      setDialog((s) => ({
        ...s,
        busy: false,
        error: res.message || 'Unable to complete attendance action.',
      }));
      return;
    }

    closeDialog();
    load();
  };

  const columns = [
    {
      key: 'member',
      title: 'Member',
      flex: 2,
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
      key: 'checkin',
      title: 'Check-in',
      flex: 1.6,
      render: (r) => formatTime(r.checked_in_at),
    },
    {
      key: 'checkout',
      title: 'Check-out',
      flex: 1.6,
      render: (r) => formatTime(r.checked_out_at),
    },
    {
      key: 'action',
      title: 'Action',
      flex: 1,
      actions: true,
      render: (r) =>
        r.checked_out_at ? (
          <Text style={styles.completed}>Completed</Text>
        ) : (
          <Btn
            label="Check out"
            kind="secondary"
            onPress={() => openCheckOut(r)}
          />
        ),
    },
  ];

  return (
    <Page
      title="Attendance Monitoring"
      subtitle="View member attendance and manage gym check-ins and check-outs."
      actions={
        <>
          <Btn
            label="Back"
            kind="secondary"
            onPress={() => router.back()}
          />
          <Btn
            label="Refresh"
            kind="secondary"
            icon="refresh"
            onPress={load}
            disabled={state.loading}
          />
        </>
      }
    >
      <Banner tone="danger" text={state.error} />

      <View style={styles.toolbar}>
        <SearchInput
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            setOffset(0);
          }}
          placeholder="Search attendance by member name or email"
        />

        <Btn label="Check in member" onPress={openCheckIn} />
      </View>

      <DataTable
        columns={columns}
        rows={state.rows}
        loading={state.loading}
        keyOf={(r) => r.id}
        emptyTitle="No attendance records"
        emptyText="Attendance records will appear here after members check in."
      />

      <Pager
        total={state.total}
        offset={offset}
        limit={PAGE_SIZE}
        onChange={setOffset}
      />

      <Dialog
        visible={dialog.visible}
        title={
          dialog.type === 'checkin'
            ? 'Member Check-in'
            : 'Confirm Check-out'
        }
        onClose={closeDialog}
      >
        {dialog.type === 'checkin' ? (
          <View>
            <Text style={styles.dialogText}>
              Search and select a member with an active membership.
            </Text>

            <SearchInput
              value={memberSearch}
              onChangeText={setMemberSearch}
              placeholder="Search member name or email"
            />

            <Banner tone="danger" text={memberState.error} />

            {memberState.loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={ADMIN.primary} />
                <Text style={styles.muted}>Loading active members...</Text>
              </View>
            ) : memberState.rows.length === 0 ? (
              <Text style={styles.empty}>
                No active members found.
              </Text>
            ) : (
              <ScrollView
                style={styles.memberList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {memberState.rows.map((member) => {
                  const isSelected =
                    selectedMember?.user_id === member.user_id;

                  return (
                    <TouchableOpacity
                      key={member.user_id}
                      activeOpacity={0.75}
                      style={[
                        styles.memberOption,
                        isSelected && styles.memberSelected,
                      ]}
                      onPress={() => {
                        setSelectedMember(member);
                        setDialog((s) => ({
                          ...s,
                          error: '',
                        }));
                      }}
                    >
                      <View style={styles.memberInfo}>
                        <Text style={styles.name}>
                          {member.full_name || 'Unnamed member'}
                        </Text>
                        <Text style={styles.email}>
                          {member.email}
                        </Text>
                        <Text style={styles.plan}>
                          {member.plan_name || 'Active membership'}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.selectLabel,
                          isSelected && styles.selectedLabel,
                        ]}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {selectedMember && (
              <View style={styles.selectedBox}>
                <Text style={styles.selectedHeading}>
                  Selected member
                </Text>
                <Text style={styles.name}>
                  {selectedMember.full_name}
                </Text>
                <Text style={styles.email}>
                  {selectedMember.email}
                </Text>
              </View>
            )}

            <Banner tone="danger" text={dialog.error} />

            <Btn
              label="Confirm check-in"
              onPress={submitAction}
              loading={dialog.busy}
              disabled={!selectedMember || dialog.busy}
            />
          </View>
        ) : (
          <View>
            <Text style={styles.dialogText}>
              Check out {dialog.row?.full_name || 'this member'}?
            </Text>

            <Text style={styles.dialogEmail}>
              {dialog.row?.email}
            </Text>

            <Banner tone="danger" text={dialog.error} />

            <Btn
              label="Confirm check-out"
              onPress={submitAction}
              loading={dialog.busy}
            />
          </View>
        )}
      </Dialog>
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
    marginTop: 2,
  },
  completed: {
    color: ADMIN.success,
    fontWeight: '700',
    fontSize: 12,
  },
  dialogText: {
    color: ADMIN.text,
    fontSize: 14,
    marginBottom: 12,
  },
  dialogEmail: {
    color: ADMIN.textMuted,
    fontSize: 12,
    marginBottom: 14,
  },
  memberList: {
    maxHeight: 280,
    marginTop: 12,
    marginBottom: 12,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: ADMIN.border,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
  },
  memberSelected: {
    borderColor: ADMIN.primary,
    backgroundColor: ADMIN.surface,
  },
  memberInfo: {
    flex: 1,
  },
  plan: {
    color: ADMIN.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  selectLabel: {
    color: ADMIN.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  selectedLabel: {
    color: ADMIN.primary,
  },
  selectedBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: ADMIN.surface,
    marginBottom: 12,
  },
  selectedHeading: {
    color: ADMIN.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  loading: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  muted: {
    color: ADMIN.textMuted,
    fontSize: 12,
  },
  empty: {
    color: ADMIN.textMuted,
    fontSize: 13,
    padding: 20,
    textAlign: 'center',
  },
});
