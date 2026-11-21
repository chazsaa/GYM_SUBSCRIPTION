import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TabScreen from '../../components/TabScreen';
import PrimaryButton from '../../components/PrimaryButton';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADES } from '../../theme/colors';

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name,email,phone,address,avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (!error) setProfile(data);
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  return (
    <TabScreen title="Profile">
      <View style={styles.card}>
        <View style={styles.avatar}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <MaterialCommunityIcons name="account" size={44} color={COLORS.text} />
          )}
        </View>
        <Text style={styles.name}>{profile?.full_name || user?.name || 'Member'}</Text>
        <Text style={styles.email}>{user?.email || profile?.email}</Text>
        {loading ? <ActivityIndicator color={COLORS.accent} style={{ marginTop: 12 }} /> : (
          <View style={styles.details}>
            {!!profile?.phone && <Text style={styles.detail}>{profile.phone}</Text>}
            {!!profile?.address && <Text style={styles.detail}>{profile.address}</Text>}
          </View>
        )}
      </View>

      <Pressable style={styles.editBtn} onPress={() => router.push('/edit-profile')}>
        <MaterialCommunityIcons name="pencil" size={18} color={COLORS.text} />
        <Text style={styles.editText}>Edit profile</Text>
      </Pressable>

      <Pressable style={styles.editBtn} onPress={() => router.push('/change-password')}>
        <MaterialCommunityIcons name="lock-outline" size={18} color={COLORS.text} />
        <Text style={styles.editText}>Change password</Text>
      </Pressable>

      <PrimaryButton label="LOG OUT" onPress={() => setConfirmLogout(true)} />
      <ConfirmDialog
        visible={confirmLogout}
        title="Log out?"
        message="You will need to log in again to see your membership."
        confirmLabel="Log out"
        destructive
        onConfirm={() => { setConfirmLogout(false); logout(); }}
        onCancel={() => setConfirmLogout(false)}
      />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: COLORS.cardBackground, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 28, marginBottom: 16 },
  avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: SHADES.maroonDeep, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  name: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  email: { color: COLORS.textMuted, fontSize: 14, marginTop: 4 },
  details: { alignItems: 'center', marginTop: 10, gap: 4 },
  detail: { color: COLORS.textMuted, fontSize: 13 },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingVertical: 14, marginBottom: 16 },
  editText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
});
