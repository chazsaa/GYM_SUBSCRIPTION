import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Page, Card, Field, Btn, Banner, DetailRow, ConfirmModal, useIsWide } from '../../components/admin/ui';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ADMIN } from '../../theme/adminTheme';

// The admin's own account: name, email, password and log out.
// (The same rules as the member's Edit profile and Change password screens.)
export default function Settings() {
  const { user, logout } = useAuth();
  const wide = useIsWide();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileMsg, setProfileMsg] = useState({ tone: 'success', text: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ tone: 'success', text: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  const [confirmLogout, setConfirmLogout] = useState(false);

  const saveProfile = async () => {
    if (savingProfile) return;
    const newName = name.trim();
    const newEmail = email.trim().toLowerCase();
    if (!newName) return setProfileMsg({ tone: 'danger', text: 'Enter your full name.' });
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) return setProfileMsg({ tone: 'danger', text: 'Enter a valid email address.' });

    setSavingProfile(true);
    setProfileMsg({ tone: 'success', text: '' });
    try {
      const { data } = await supabase.auth.getUser();
      const authUser = data?.user;
      if (!authUser) throw new Error('You are signed out. Log in again.');

      const { error: profileError } = await supabase.from('profiles').update({ full_name: newName }).eq('id', authUser.id);
      if (profileError) throw profileError;
      const { error: metaError } = await supabase.auth.updateUser({ data: { full_name: newName } });
      if (metaError) throw metaError;

      const emailChanged = newEmail !== (authUser.email ?? '').toLowerCase();
      if (emailChanged) {
        const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
        if (emailError) throw emailError;
      }
      setProfileMsg({
        tone: 'success',
        text: emailChanged ? 'Saved. Check your new email for a link to confirm the change.' : 'Your changes are saved.',
      });
    } catch (e) {
      setProfileMsg({ tone: 'danger', text: e?.message ?? 'Could not save your changes. Try again.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (savingPassword) return;
    const fail = (text) => setPasswordMsg({ tone: 'danger', text });
    if (!current) return fail('Enter your current password.');
    if (next.length < 8) return fail('The new password must be at least 8 characters.');
    if (next === current) return fail('The new password must be different from the current one.');
    if (next !== confirm) return fail('The new passwords do not match.');

    setSavingPassword(true);
    setPasswordMsg({ tone: 'success', text: '' });
    try {
      const { data } = await supabase.auth.getUser();
      const authEmail = data?.user?.email ?? user?.email;
      if (!authEmail) throw new Error('You are signed out. Log in again.');
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: authEmail, password: current });
      if (verifyError) return fail('The current password is incorrect.');
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;
      setCurrent('');
      setNext('');
      setConfirm('');
      setPasswordMsg({ tone: 'success', text: 'Password updated. Use it the next time you log in.' });
    } catch (e) {
      fail(e?.message ?? 'Could not change the password. Try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Page title="Settings" subtitle="Your admin account.">
      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={styles.col}>
          <Card title="Profile" subtitle="Shown in the sidebar and in the admin log">
            <Banner tone={profileMsg.tone} text={profileMsg.text} onClose={() => setProfileMsg((m) => ({ ...m, text: '' }))} />
            <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.noMargin} />
            <View style={styles.cta}>
              <Btn label="Save profile" onPress={saveProfile} loading={savingProfile} />
            </View>
          </Card>

          <Card title="Change password">
            <Banner tone={passwordMsg.tone} text={passwordMsg.text} onClose={() => setPasswordMsg((m) => ({ ...m, text: '' }))} />
            <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />
            <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" hint="At least 8 characters." />
            <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" style={styles.noMargin} />
            <View style={styles.cta}>
              <Btn label="Update password" onPress={savePassword} loading={savingPassword} />
            </View>
          </Card>
        </View>

        <View style={styles.col}>
          <Card title="Access">
            <DetailRow label="Role">Gym administrator</DetailRow>
            <DetailRow label="Signed in as">{user?.email ?? '-'}</DetailRow>
            <Text style={styles.help}>
              Admin access is given and removed in Supabase, never inside the app. An admin account does not have a
              membership. To train at the gym, use a separate member account.
            </Text>
          </Card>
          <Card title="Session">
            <Text style={styles.help}>Log out when you leave a shared computer.</Text>
            <View style={styles.cta}>
              <Btn label="Log out" icon="logout" kind="danger" onPress={() => setConfirmLogout(true)} />
            </View>
          </Card>
        </View>
      </View>

      <ConfirmModal
        visible={confirmLogout}
        title="Log out?"
        message="You will need to log in again to use the Admin Console."
        confirmLabel="Log out"
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  columns: { gap: 0 },
  columnsWide: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  col: { flex: 1, minWidth: 0 },
  noMargin: { marginBottom: 0 },
  cta: { marginTop: 16, alignItems: 'flex-start' },
  help: { color: ADMIN.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
});
