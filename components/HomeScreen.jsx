import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PlanCard from './PlanCard';
import ConfirmDialog from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { usePlans } from '../context/PlansContext';
import { bannerImage } from '../data/subscriptionPlans';
import { COLORS, SHADES } from '../theme/colors';
import { BRAND } from '../constants/brand';

// The GymFit Home tab. Only logged-in users can reach it.
const HomeScreen = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { plans } = usePlans();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const firstName = user?.name ? user.name.trim().split(' ')[0] : '';

  // Plan id 3 -> opens /details/3 (file: app/details/[id].jsx)
  const handleViewDetails = (plan) => {
    router.push(`/details/${plan.id}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={plans}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PlanCard plan={item} onViewDetails={() => handleViewDetails(item)} />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.topBar}>
              <Image source={require('../assets/image/ourlogo.png')} style={styles.logo} />
              <View style={styles.brandWrap}>
                <Text style={styles.brand}>{BRAND.name}</Text>
                <Text style={styles.slogan}>{BRAND.slogan}</Text>
              </View>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.navigate('/profile')}
                accessibilityLabel="Open profile"
              >
                <MaterialCommunityIcons name="account-circle-outline" size={26} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setConfirmLogout(true)}
                accessibilityRole="button"
                accessibilityLabel="Log out"
              >
                <MaterialCommunityIcons name="logout" size={24} color={COLORS.accent} />
              </TouchableOpacity>
            </View>

            {/* Welcome banner */}
            <View style={styles.banner}>
              <View style={styles.bannerText}>
                <Text style={styles.hello}>{firstName ? `Hello, ${firstName}!` : 'Hello!'}</Text>
                <Text style={styles.bannerTitle}>Ready to achieve your fitness goals?</Text>
                <Text style={styles.bannerSub}>
                  Choose a membership plan that fits your goals.
                </Text>
              </View>
              <Image source={bannerImage} style={styles.bannerPhoto} contentFit="cover" transition={150} />
            </View>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Membership Plans</Text>
              <Text style={styles.sectionCount}>{plans.length} plans</Text>
            </View>
          </View>
        }
      />

      <ConfirmDialog
        visible={confirmLogout}
        title="Log out?"
        message="You will need to log in again to see your membership."
        confirmLabel="Log out"
        destructive
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  logo: { width: 42, height: 42, borderRadius: 10, marginRight: 10 },
  brandWrap: { flex: 1 },
  brand: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  slogan: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  iconButton: { padding: 9, marginLeft: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SHADES.maroonDeep,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 22,
    overflow: 'hidden',
  },
  bannerPhoto: {
    width: 120,
    height: 120,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  bannerText: { flex: 1, paddingRight: 8 },
  hello: { color: COLORS.accent, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  bannerTitle: { color: COLORS.text, fontSize: 21, fontWeight: '800', lineHeight: 27 },
  bannerSub: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18, marginTop: 8 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { color: COLORS.text, fontSize: 19, fontWeight: '800' },
  sectionCount: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
});

export default HomeScreen;
