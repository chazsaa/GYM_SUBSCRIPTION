import React, { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Page, Card, Field, Btn, Banner, Loading, Pill, DetailRow, useIsWide } from '../../components/admin/ui';
import { supabase } from '../../lib/supabase';
import { rpc } from '../../lib/admin';
import { formatDateTime } from '../../context/SubscriptionContext';
import { ADMIN } from '../../theme/adminTheme';

const KEYS = ['gym_name', 'address', 'phone', 'email', 'hours_weekdays', 'hours_weekends', 'capacity', 'announcement'];
const MEDIA_BUCKET = 'gym-media';

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
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerBusy, setBannerBusy] = useState(false);

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
      setBannerUrl(info.data.find((row) => row.key === 'banner_url')?.value || '');
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

  const chooseBanner = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow GymFit to access your photos to choose a banner.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setBannerBusy(true);
    setError('');
    try {
      const asset = result.assets[0];
      const previousUrl = bannerUrl;
      const response = await fetch(asset.uri);
      const imageData = await response.arrayBuffer();
      const extension = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `banners/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, imageData, {
        contentType: asset.mimeType || 'image/jpeg', upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      const resultSave = await supabase.rpc('admin_set_banner_url', { p_url: data.publicUrl });
      if (resultSave.error) {
        await supabase.storage.from(MEDIA_BUCKET).remove([path]);
        throw resultSave.error;
      }
      setBannerUrl(data.publicUrl);
      if (previousUrl) {
        const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
        const oldIndex = previousUrl.indexOf(marker);
        if (oldIndex >= 0) {
          const oldPath = decodeURIComponent(previousUrl.slice(oldIndex + marker.length).split('?')[0]);
          if (oldPath !== path) await supabase.storage.from(MEDIA_BUCKET).remove([oldPath]);
        }
      }
      setNotice('Banner uploaded and published to the member Home screen.');
    } catch (e) {
      setError(e?.message || 'Could not upload the banner.');
    } finally { setBannerBusy(false); }
  };

  const removeBanner = async () => {
    if (!bannerUrl || bannerBusy) return;
    setBannerBusy(true);
    setError('');
    try {
      const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
      const index = bannerUrl.indexOf(marker);
      const path = index >= 0 ? decodeURIComponent(bannerUrl.slice(index + marker.length).split('?')[0]) : null;
      const { error: saveError } = await supabase.rpc('admin_set_banner_url', { p_url: '' });
      if (saveError) throw saveError;
      setBannerUrl('');
      if (path) {
        const { error: removeError } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
        if (removeError) console.warn('Banner was unpublished, but the old file could not be deleted:', removeError.message);
      }
      setNotice('Banner removed. It will no longer appear on the member Home screen.');
    } catch (e) {
      setError(e?.message || 'Could not remove the banner.');
    } finally { setBannerBusy(false); }
  };

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

          <Card title="Home banner" subtitle="Optional image shown on the member Home screen. No image is displayed until you upload one.">
            {!!bannerUrl && <Image source={{ uri: bannerUrl }} contentFit="cover" style={styles.bannerPreview} />}
            <View style={styles.cta}>
              <Btn label={bannerUrl ? 'Replace banner' : 'Upload banner'} icon="image-plus" onPress={chooseBanner} loading={bannerBusy} />
              {!!bannerUrl && <Btn label="Remove banner" icon="delete-outline" kind="danger" onPress={removeBanner} disabled={bannerBusy} />}
            </View>
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
  bannerPreview: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12 },
  updated: { color: ADMIN.textMuted, fontSize: 12, marginBottom: 16 },
  help: { color: ADMIN.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  cta: { marginTop: 14, alignItems: 'flex-start' },
});
