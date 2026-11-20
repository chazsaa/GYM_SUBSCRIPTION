import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BRAND } from '../../constants/brand';
import { useAuth } from '../../context/AuthContext';
import { ADMIN } from '../../theme/adminTheme';
import { ConfirmModal, useIsWide } from './ui';

export const ADMIN_NAV = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin', icon: 'view-dashboard-outline' },
    ],
  },
  {
    group: 'Manage',
    items: [
      { label: 'Members', href: '/admin/members', icon: 'account-group-outline' },
      { label: 'Subscriptions', href: '/admin/subscriptions', icon: 'card-account-details-outline' },
      { label: 'Payments', href: '/admin/payments', icon: 'cash-multiple' },
      { label: 'Gym', href: '/admin/gym', icon: 'dumbbell' },
    ],
  },
  {
    group: 'Insights',
    items: [
      { label: 'Reports', href: '/admin/reports', icon: 'chart-box-outline' },
    ],
  },
  {
    group: 'Account',
    items: [
      { label: 'Settings', href: '/admin/settings', icon: 'cog-outline' },
    ],
  },
];

const isActive = (pathname, href) =>
  href === '/admin'
    ? pathname === '/admin'
    : pathname === href || pathname.startsWith(`${href}/`);

function Sidebar({ pathname, onNavigate, onLogout }) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.brandRow}>
        <Image
          source={require('../../assets/image/ourlogo.png')}
          style={styles.logo}
          contentFit="cover"
        />
        <Text style={styles.brandName}>{BRAND.name}</Text>
      </View>

      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navContent}
      >
        {ADMIN_NAV.map((section) => (
          <View key={section.group} style={styles.section}>
            <Text style={styles.sectionLabel}>
              {section.group.toUpperCase()}
            </Text>

            {section.items.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Pressable
                  key={item.href}
                  onPress={() => onNavigate(item.href)}
                  accessibilityRole="link"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: active }}
                  style={({ hovered }) => [
                    styles.navItem,
                    active && styles.navItemActive,
                    hovered && !active && styles.navItemHover,
                  ]}
                >
                  <View
                    style={[
                      styles.marker,
                      active && styles.markerOn,
                    ]}
                  />

                  <MaterialCommunityIcons
                    name={item.icon}
                    size={20}
                    color={
                      active
                        ? ADMIN.sidebarAccent
                        : ADMIN.sidebarMuted
                    }
                  />

                  <Text
                    style={[
                      styles.navText,
                      active && styles.navTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ hovered }) => [
            styles.logout,
            hovered && styles.navItemHover,
          ]}
        >
          <MaterialCommunityIcons
            name="logout"
            size={18}
            color={ADMIN.sidebarText}
          />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminShell({ children }) {
  const wide = useIsWide();
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const go = (href) => {
    setMenuOpen(false);
    if (pathname !== href) router.replace(href);
  };

  const current =
    ADMIN_NAV.flatMap((section) => section.items)
      .find((item) => isActive(pathname, item.href))?.label ?? 'Admin';

  const logoutDialog = (
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
  );

  if (wide) {
    return (
      <ImageBackground
        source={require('../../assets/image/banner.jpg')}
        style={styles.root}
        imageStyle={styles.backgroundImage}
      >
        <View pointerEvents="none" style={styles.backgroundScrim} />
        <StatusBar style="light" />

        <View style={styles.sidebarWrap}>
          <Sidebar
            pathname={pathname}
            onNavigate={go}
            onLogout={() => setConfirmLogout(true)}
          />
        </View>

        <View style={styles.main}>{children}</View>
        {logoutDialog}
      </ImageBackground>
    );
  }

  return (
    <SafeAreaView style={styles.phoneRoot} edges={['top']}>
      <ImageBackground
        source={require('../../assets/image/banner.jpg')}
        style={styles.phoneBackground}
        imageStyle={styles.backgroundImage}
      >
        <View pointerEvents="none" style={styles.backgroundScrim} />
        <StatusBar style="light" />

        <View style={styles.topBar}>
          <Pressable
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            hitSlop={8}
            style={styles.menuBtn}
          >
            <MaterialCommunityIcons
              name="menu"
              size={26}
              color="#FFFFFF"
            />
          </Pressable>

          <Text style={styles.topTitle} accessibilityRole="header">
            {current}
          </Text>

          <Text style={styles.topBrand}>
            {BRAND.name} Admin
          </Text>
        </View>

        <View style={styles.main}>{children}</View>

        {menuOpen && (
          <View style={styles.drawerLayer}>
            <Pressable
              style={styles.drawerBackdrop}
              onPress={() => setMenuOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
            />

            <SafeAreaView style={styles.drawer} edges={['top', 'bottom']}>
              <Sidebar
                pathname={pathname}
                onNavigate={go}
                onLogout={() => {
                  setMenuOpen(false);
                  setConfirmLogout(true);
                }}
              />
            </SafeAreaView>
          </View>
        )}

        {logoutDialog}
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: ADMIN.bg,
  },
  backgroundImage: {
    resizeMode: 'cover',
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 4, 7, 0.72)',
  },
  main: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  phoneRoot: {
    flex: 1,
    backgroundColor: ADMIN.bg,
  },
  phoneBackground: {
    flex: 1,
    backgroundColor: ADMIN.bg,
  },
  sidebarWrap: {
    width: 252,
    borderRightWidth: 1,
    borderRightColor: ADMIN.sidebarBorder,
  },
  sidebar: {
    backgroundColor: ADMIN.sidebar,
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN.sidebarBorder,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  navScroll: {
    flex: 1,
  },
  navContent: {
    paddingVertical: 14,
  },
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    color: ADMIN.sidebarMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    paddingHorizontal: 24,
    marginBottom: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingRight: 16,
    marginHorizontal: 10,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: ADMIN.sidebarActive,
  },
  navItemHover: {
    backgroundColor: '#1B1E26',
  },
  marker: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginLeft: 4,
  },
  markerOn: {
    backgroundColor: ADMIN.sidebarAccent,
  },
  navText: {
    color: ADMIN.sidebarText,
    fontSize: 15,
    fontWeight: '600',
  },
  navTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: ADMIN.sidebarBorder,
    padding: 14,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  logoutText: {
    color: ADMIN.sidebarText,
    fontSize: 14,
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(10, 8, 13, 0.92)',
    paddingHorizontal: 14,
    minHeight: 56,
  },
  menuBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  topBrand: {
    color: ADMIN.sidebarAccent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  drawerLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 20,
  },
  drawer: {
    backgroundColor: ADMIN.sidebar,
    width: 272,
    maxWidth: '82%',
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
