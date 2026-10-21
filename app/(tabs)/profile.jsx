import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TabScreen from '../../components/TabScreen';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SHADES } from '../../theme/colors';

export default function Profile() {
  const { user, logout } = useAuth();
  return (
    <TabScreen title="Profile">
      <View style={styles.card}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="account" size={44} color={COLORS.text} />
        </View>
        <Text style={styles.name}>{user?.name || 'Member'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      <PrimaryButton label="LOG OUT" onPress={logout} />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 28,
    marginBottom: 24,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: SHADES.maroonDeep,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  name: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  email: { color: COLORS.textMuted, fontSize: 14, marginTop: 4 },
});
