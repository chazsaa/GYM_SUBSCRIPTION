import { useRouter } from 'expo-router';
import {
    ChevronRight,
    ClipboardCheck,
    CreditCard,
    Dumbbell,
    LogOut,
    Users,
} from 'lucide-react-native';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../theme/colors';

export default function StaffDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const staffFeatures = [
    {
      title: 'Member Management',
      description: 'View registered members and their membership status.',
      icon: Users,
      available: true,
      onPress: () => router.push('/staff/members'),
    },
    {
      title: 'Payment Verification',
      description: 'Review and verify pending cash payments.',
      icon: CreditCard,
      available: true,
      onPress: () => router.push('/staff/payments'),
    },
    {
      title: 'Attendance Monitoring',
      description: 'Monitor member attendance records.',
      icon: ClipboardCheck,
      available: true,
      onPress: () => router.push('/staff/attendance'),
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>GYMFIT</Text>
          <Text style={styles.headerSubtitle}>STAFF PORTAL</Text>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <LogOut size={18} color="#FFFFFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.welcomeCard}>
        <View style={styles.iconCircle}>
          <Dumbbell size={26} color={COLORS.primary} />
        </View>

        <Text style={styles.welcomeTitle}>
          Welcome, {user?.name || 'Staff'}!
        </Text>

        <Text style={styles.welcomeDescription}>
          Manage daily gym operations from your staff dashboard.
        </Text>

        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>STAFF ACCOUNT</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>STAFF TOOLS</Text>

      <View style={styles.featureList}>
        {staffFeatures.map((feature) => {
          const Icon = feature.icon;

          return (
            <TouchableOpacity
              key={feature.title}
              style={styles.featureCard}
              onPress={feature.onPress}
              disabled={!feature.available}
              activeOpacity={0.75}
            >
              <View style={styles.featureIcon}>
                <Icon size={23} color={COLORS.primary} />
              </View>

              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>
                  {feature.title}
                </Text>

                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </View>

              {feature.available ? (
                <ChevronRight size={20} color={COLORS.textMuted} />
              ) : (
                <Text style={styles.comingSoon}>Soon</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.footer}>
        GymFit Staff Portal
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 35,
  },
  brand: {
    fontSize: 25,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 2,
    marginTop: 3,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 9,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  welcomeCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 35,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 9,
    lineHeight: 21,
  },
  roleBadge: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  featureList: {
    gap: 13,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 18,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  featureDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 5,
  },
  comingSoon: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 35,
  },
});
