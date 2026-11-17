import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/colors';
// TODO: point this to your Supabase client file (same path as in edit-profile.jsx)
import { supabase } from '../lib/supabase';

export default function ChangePassword() {
  const router = useRouter();
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (saving) return;
    setError('');

    if (!current) return setError('Enter your current password.');
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    if (next === current) return setError('New password must be different from the current one.');
    if (next !== confirm) return setError('New passwords do not match.');

    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email ?? user?.email;
      if (!email) throw new Error('You are signed out. Log in again.');

      // Verify the current password before allowing the change
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (verifyError) {
        setError('Current password is incorrect.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;

      Alert.alert('Password updated', 'Use your new password the next time you log in.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      setError(e?.message ?? 'Could not change your password. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const field = (label, value, setter, extra = {}) => (
    <>
      <Text style={[styles.label, extra.gap && { marginTop: 18 }]}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setter}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={COLORS.textMuted}
      />
    </>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="chevron-left" size={32} color={COLORS.text} />
            </Pressable>
            <Text style={styles.title}>Change password</Text>
          </View>

          <View style={styles.card}>
            {field('Current password', current, setCurrent)}
            {field('New password', next, setNext, { gap: true })}
            {field('Confirm new password', confirm, setConfirm, { gap: true })}

            <Pressable style={styles.toggle} onPress={() => setShow((s) => !s)}>
              <MaterialCommunityIcons
                name={show ? 'eye-off' : 'eye'}
                size={18}
                color={COLORS.textMuted}
              />
              <Text style={styles.toggleText}>{show ? 'Hide passwords' : 'Show passwords'}</Text>
            </Pressable>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <PrimaryButton label={saving ? 'SAVING...' : 'UPDATE PASSWORD'} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background ?? '#0d0d0d' },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginLeft: 4 },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 22,
    marginBottom: 20,
  },
  label: { color: COLORS.textMuted, fontSize: 14, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    color: COLORS.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  toggleText: { color: COLORS.textMuted, fontSize: 14 },
  error: { color: '#ff6b6b', fontSize: 14, marginBottom: 16 },
});