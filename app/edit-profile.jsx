import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { COLORS, SHADES } from '../theme/colors';
import { supabase } from '../lib/supabase';

const BUCKET = 'gym-media';

export default function EditProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [originalProfile, setOriginalProfile] = useState({ name: '', email: '', phone: '', address: '', avatarUrl: null });
  const [successVisible, setSuccessVisible] = useState(false);
  const [successChanges, setSuccessChanges] = useState([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('full_name,phone,address,avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      setName(data?.full_name || user.name || '');
      setEmail(user.email || '');
      setPhone(data?.phone || '');
      setAddress(data?.address || '');
      setAvatarUrl(data?.avatar_url || null);
      setOriginalProfile({
        name: data?.full_name || user.name || '',
        email: user.email || '',
        phone: data?.phone || '',
        address: data?.address || '',
        avatarUrl: data?.avatar_url || null,
      });
    } catch (e) {
      setError(e?.message || 'Could not load your profile.');
    } finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Keep the success message visible briefly, then return to the Profile tab.
  useEffect(() => {
    if (!successVisible) return undefined;
    const timer = setTimeout(() => {
      router.replace('/(tabs)/profile');
    }, 2000);
    return () => clearTimeout(timer);
  }, [successVisible, router]);

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow GymFit to access your photos to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) setSelectedImage(result.assets[0]);
  };

  const save = async () => {
    if (saving) return;
    setError('');
    const newName = name.trim();
    const newEmail = email.trim().toLowerCase();
    if (!newName) return setError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) return setError('Enter a valid email address.');
    if (!user?.id) return setError('You are signed out. Log in again.');

    setSaving(true);
    let uploadedPath = null;
    let oldPath = null;
    let profileSaved = false;
    try {
      let nextAvatarUrl = avatarUrl;
      if (selectedImage) {
        const response = await fetch(selectedImage.uri);
        const imageData = await response.arrayBuffer();
        const extension = (selectedImage.fileName?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        uploadedPath = `avatars/${user.id}/${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(uploadedPath, imageData, {
          contentType: selectedImage.mimeType || 'image/jpeg', upsert: false,
        });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(uploadedPath);
        nextAvatarUrl = publicData.publicUrl;
      }

      const { data: previous } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle();
      if (previous?.avatar_url) {
        const marker = `/storage/v1/object/public/${BUCKET}/`;
        const index = previous.avatar_url.indexOf(marker);
        if (index >= 0) oldPath = decodeURIComponent(previous.avatar_url.slice(index + marker.length).split('?')[0]);
      }

      const { error: profileError } = await supabase.from('profiles').update({
        full_name: newName, phone: phone.trim(), address: address.trim(), avatar_url: nextAvatarUrl,
      }).eq('id', user.id);
      if (profileError) throw profileError;
      profileSaved = true;

      const { error: metaError } = await supabase.auth.updateUser({ data: { full_name: newName } });
      if (metaError) throw metaError;
      const emailChanged = newEmail !== (user.email || '').toLowerCase();
      if (emailChanged) {
        const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
        if (emailError) throw emailError;
      }

      if (uploadedPath && oldPath && oldPath !== uploadedPath) {
        await supabase.storage.from(BUCKET).remove([oldPath]);
      }

      const changed = [];
      if (newName !== originalProfile.name) changed.push('Name updated');
      if (phone.trim() !== originalProfile.phone) changed.push('Phone number updated');
      if (address.trim() !== originalProfile.address) changed.push('Address updated');
      if (selectedImage) changed.push('Profile picture updated');
      if (emailChanged) changed.push('Email change requested — check your new email for a confirmation link');
      setSuccessChanges(changed.length ? changed : ['Your profile details were saved.']);
      setSuccessVisible(true);
    } catch (e) {
      if (uploadedPath && !profileSaved) await supabase.storage.from(BUCKET).remove([uploadedPath]);
      setError(e?.message || 'Could not save your changes. Please try again.');
    } finally { setSaving(false); }
  };

  const previewUri = selectedImage?.uri || avatarUrl;

  return (
    <SafeAreaView style={styles.screen}>
      <Modal
        visible={successVisible}
        transparent
        animationType="fade"
        onRequestClose={() => router.replace('/(tabs)/profile')}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <MaterialCommunityIcons name="check" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>Profile updated!</Text>
            <Text style={styles.successMessage}>Your changes have been saved successfully.</Text>
            <View style={styles.successList}>
              {successChanges.map((item, index) => (
                <View key={`${index}-${item}`} style={styles.successRow}>
                  <MaterialCommunityIcons name="check-circle" size={17} color={COLORS.accent} />
                  <Text style={styles.successItem}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.successRedirect}>Returning to your Profile…</Text>
            <Pressable style={styles.successButton} onPress={() => router.replace('/(tabs)/profile')}>
              <Text style={styles.successButtonText}>GO TO PROFILE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <MaterialCommunityIcons name="chevron-left" size={32} color={COLORS.text} />
            </Pressable>
            <Text style={styles.title}>Edit profile</Text>
          </View>

          {loading ? <ActivityIndicator color={COLORS.accent} size="large" /> : <>
            <View style={styles.card}>
              <View style={styles.avatar}>
                {previewUri ? <Image source={{ uri: previewUri }} style={styles.avatarImage} contentFit="cover" />
                  : <MaterialCommunityIcons name="account" size={48} color={COLORS.text} />}
              </View>
              <Pressable style={styles.photoButton} onPress={choosePhoto}>
                <MaterialCommunityIcons name="camera" size={18} color={COLORS.accent} />
                <Text style={styles.photoText}>{avatarUrl || selectedImage ? 'Change profile picture' : 'Upload profile picture'}</Text>
              </Pressable>
              {!!selectedImage && <Text style={styles.previewHint}>Preview only — save changes to upload it.</Text>}
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Full name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor={COLORS.textMuted} autoCapitalize="words" />
              <Text style={[styles.label, { marginTop: 18 }]}>Email</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" keyboardType="email-address" />
              <Text style={styles.hint}>Changing your email sends a confirmation link to the new address.</Text>
              <Text style={[styles.label, { marginTop: 18 }]}>Phone number</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Your phone number" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />
              <Text style={[styles.label, { marginTop: 18 }]}>Address</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Your address (optional)" placeholderTextColor={COLORS.textMuted} />
            </View>
          </>}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <PrimaryButton label={saving ? 'SAVING...' : 'SAVE CHANGES'} onPress={save} disabled={loading || saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background ?? '#0d0d0d' },
  content: { padding: 20, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginLeft: 4 },
  card: { backgroundColor: COLORS.cardBackground, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 22, marginBottom: 16, alignItems: 'stretch' },
  avatar: { width: 112, height: 112, borderRadius: 56, alignSelf: 'center', backgroundColor: SHADES.maroonDeep, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  photoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, padding: 10 },
  photoText: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },
  previewHint: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },
  label: { color: COLORS.textMuted, fontSize: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, color: COLORS.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  hint: { color: COLORS.textMuted, fontSize: 12, marginTop: 8 },
  error: { color: '#ff6b6b', fontSize: 14, marginBottom: 16 },
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard: { width: '100%', maxWidth: 390, backgroundColor: '#171717', borderColor: COLORS.border, borderWidth: 1, borderRadius: 20, padding: 24, alignItems: 'center' },
  successIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#238653', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  successTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  successMessage: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginTop: 7, lineHeight: 20 },
  successList: { alignSelf: 'stretch', marginTop: 18, gap: 11 },
  successRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  successItem: { flex: 1, color: COLORS.text, fontSize: 13, lineHeight: 19 },
  successRedirect: { color: COLORS.textMuted, fontSize: 12, marginTop: 20 },
  successButton: { marginTop: 14, backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'stretch', alignItems: 'center' },
  successButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
});
