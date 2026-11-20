import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Page, Card, Field, Btn, Banner, Loading, Pill, DetailRow, useIsWide } from '../../components/admin/ui';
import { supabase } from '../../lib/supabase';
import { rpc } from '../../lib/admin';
import { formatDateTime } from '../../context/SubscriptionContext';
import { ADMIN } from '../../theme/adminTheme';

const KEYS = ['gym_name', 'address', 'phone', 'email', 'hours_weekdays', 'hours_weekends', 'capacity', 'announcement'];

// Compares the form with what is saved. Returns the changed fields, or a message.
const diffGym = (form, saved) => {
  if (!form.gym_name.trim()) return { problem: 'Enter the gym name.' };
  return {
    changes: Object.fromEntries(
      KEYS.filter((k) => form[k].trim() !== saved[k]).map((k) => [k, form[k].trim()])
    ),
  };
};

// Gym details and settings. The details are saved in the database (gym_info table)
// so they can be shown to members later without a new app release.
export default function Gym() {
  const router = useRouter();
  const wide = useIsWide();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [mode, setMode] = useState('simulated');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [info, settings] = await Promise.all([
        supabase.from('gym_info').select('key, value, updated_at'),
        supabase.from('app_settings').select('value').eq('key', 'payments_mode').maybeSingle(),
      ]);
      if (info.error) {
        setError(
          info.error.code === '42P01' || info.error.code === 'PGRST205'
            ? 'The admin database update is missing. Run supabase/phase4.sql in the Supabase SQL Editor, then reload.'
            : 'Could not load the gym details. Check your internet and try again.'
        );
        return;
      }
      const values = Object.fromEntries(KEYS.map((k) => [k, '']));
      let latest = null;
      info.data.forEach((row) => {
        if (KEYS.includes(row.key)) values[row.key] = row.value;
        if (!latest || row.updated_at > latest) latest = row.updated_at;
      });
      setForm(values);
      setSaved(values);
      setUpdatedAt(latest);
      setMode(settings.data?.value ?? 'simulated');
      setError('');
    } catch {
      setError('Could not connect. Check your internet and try again.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const set = (key) => (text) => {
    setForm((f) => ({ ...f, [key]: key === 'capacity' ? text.replace(/[^0-9]/g, '') : text }));
    setNotice('');
  };

  const changed = form && saved && KEYS.some((k) => form[k].trim() !== saved[k]);

  const save = async () => {
    const { problem, changes } = diffGym(form, saved);
    if (problem) {
      setFieldError(problem);
      return;
    }
    setFieldError('');
    setSaving(true);
    const res = await rpc('admin_save_gym_info', { p_values: changes });
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setError('');
    setNotice('Gym details saved.');
    load();
  };

  if (!form) {
    return (
      <Page title="Gym" subtitle="Your gym’s details and settings.">
        <Banner tone="danger" text={error} />
        {!error && <Loading label="Loading the gym details…" />}
      </Page>
    );
  }

  const live = mode === 'gateway';

  return (
    <Page
      title="Gym"
      subtitle="Your gym’s details and settings."
      actions={<Btn label="Save changes" icon="content-save-outline" onPress={save} loading={saving} disabled={!changed} />}
    >
      <Banner tone="success" text={notice} onClose={() => setNotice('')} />
      <Banner tone="danger" text={error} />

      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={styles.colMain}>
          <Card title="Gym information" subtitle="Name, contact details and opening hours">
            <Field label="Gym name" value={form.gym_name} onChangeText={set('gym_name')} maxLength={200} error={fieldError} />
            <Field label="Address" value={form.address} onChangeText={set('address')} maxLength={200} />
            <View style={[styles.pair, wide && styles.pairWide]}>
              <Field label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" maxLength={200} style={styles.half} />
              <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" maxLength={200} style={styles.half} />
            </View>
            <View style={[styles.pair, wide && styles.pairWide]}>
              <Field label="Opening hours, Monday to Friday" value={form.hours_weekdays} onChangeText={set('hours_weekdays')} placeholder="5:00 AM – 10:00 PM" maxLength={200} style={styles.half} />
              <Field label="Opening hours, weekends" value={form.hours_weekends} onChangeText={set('hours_weekends')} placeholder="6:00 AM – 8:00 PM" maxLength={200} style={styles.half} />
            </View>
            <Field label="Capacity (people at the same time)" value={form.capacity} onChangeText={set('capacity')} keyboardType="number-pad" maxLength={6} />
          </Card>

          <Card title="Announcement" subtitle="A short notice for members, such as a holiday closing">
            <Field label="Announcement" value={form.announcement} onChangeText={set('announcement')} multiline maxLength={500} hint={`${form.announcement.length} / 500`} style={styles.noMargin} />
          </Card>
          {!!updatedAt && <Text style={styles.updated}>Last saved {formatDateTime(updatedAt)}</Text>}
        </View>

        <View style={styles.colSide}>
          <Card title="Payment settings" right={<Pill label={live ? 'Live' : 'Test mode'} tone={live ? 'success' : 'warning'} />}>
            <DetailRow label="Cash at the gym">Approved by an admin</DetailRow>
            <DetailRow label="GCash, Maya and Card">{live ? 'Paid through the payment gateway' : 'Simulated, no real money'}</DetailRow>
            <Text style={styles.help}>
              {live
                ? 'Online payments are confirmed by the payment gateway.'
                : 'Online payments are in test mode, so no real money is charged. Switching to live payments needs the payment gateway set up first (see supabase/PAYMENTS_GO_LIVE.md), so it is not a button here.'}
            </Text>
          </Card>

          <Card title="Membership plans" subtitle="Prices, names and what is on sale">
            <Text style={styles.help}>Edit plan names and prices, or hide a plan from new members.</Text>
            <View style={styles.cta}>
              <Btn label="Manage plans" icon="card-account-details-outline" kind="secondary" onPress={() => router.push({ pathname: '/admin/subscriptions', params: { tab: 'plans' } })} />
            </View>
          </Card>
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  columns: { gap: 0 },
  columnsWide: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  colMain: { flex: 3, minWidth: 0 },
  colSide: { flex: 2, minWidth: 0 },
  pair: { gap: 0 },
  pairWide: { flexDirection: 'row', gap: 14 },
  half: { flex: 1 },
  noMargin: { marginBottom: 0 },
  updated: { color: ADMIN.textMuted, fontSize: 12, marginBottom: 16 },
  help: { color: ADMIN.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  cta: { marginTop: 14, alignItems: 'flex-start' },
});
