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
// TODO: point this to your Supabase client file
import { supabase } from '../lib/supabase';

export default function EditProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (saving) return;
    setError('');
    const newName = name.trim();
    const newEmail = email.trim().toLowerCase();

    if (!newName) return setError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) return setError('Enter a valid email address.');

    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      const authUser = data?.user;
      if (!authUser) throw new Error('You are signed out. Log in again.');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: newName })
        .eq('id', authUser.id);
      if (profileError) throw profileError;

      const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: newName },
      });
      if (metaError) throw metaError;

      const emailChanged = newEmail !== (authUser.email ?? '').toLowerCase();
      if (emailChanged) {
        const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
        if (emailError) throw emailError;
      }

      Alert.alert(
        'Profile updated',
        emailChanged
          ? 'Check your new email for a link to confirm the change.'
          : 'Your changes are saved.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      setError(e?.message ?? 'Could not save your changes. Try again.');
    } finally {
      setSaving(false);
    }
  };

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
            <Text style={styles.title}>Edit profile</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
            />

            <Text style={[styles.label, { marginTop: 18 }]}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={styles.hint}>
              Changing your email sends a confirmation link to the new address.
            </Text>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <PrimaryButton label={saving ? 'SAVING...' : 'SAVE CHANGES'} onPress={save} />
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
  hint: { color: COLORS.textMuted, fontSize: 12, marginTop: 8 },
  error: { color: '#ff6b6b', fontSize: 14, marginBottom: 16 },
});