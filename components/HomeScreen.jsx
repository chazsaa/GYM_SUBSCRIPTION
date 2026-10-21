import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { bannerImage, subscriptionPlans } from '../data/subscriptionPlans';
import { COLORS, SHADES } from '../theme/colors';
import PlanCard from './PlanCard';

// The Gym Subscription Home tab. Only logged-in users can reach it.
const HomeScreen = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const firstName = user?.name ? user.name.trim().split(' ')[0] : '';

  // Plan id 3 -> opens /details/3 (file: app/details/[id].jsx)
  const handleViewDetails = (plan) => {
    router.push(`/details/${plan.id}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={subscriptionPlans}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PlanCard plan={item} onViewDetails={() => handleViewDetails(item)} />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.topBar}>
              <Image source={require('../assets/image/ourlogo.jpg')} style={styles.logo} />
              <View style={styles.brandWrap}>
                <Text style={styles.brand}>GymFit</Text>
                <Text style={styles.slogan}>Stronger • Healthier • Happier</Text>
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
                onPress={logout}
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
              <Image source={bannerImage} style={styles.bannerPhoto} resizeMode="cover" />
            </View>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Membership Plans</Text>
              <Text style={styles.sectionCount}>{subscriptionPlans.length} plans</Text>
            </View>
          </View>
        }
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
  iconButton: { padding: 6, marginLeft: 2 },
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
