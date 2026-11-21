
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { GymInfoProvider } from '../context/GymInfoContext';
import { PlansProvider } from '../context/PlansContext';
import { SubscriptionProvider } from '../context/SubscriptionContext';

function RootNavigator() {
  const {
    isLoggedIn,
    isAdmin,
    isStaff,
    isMember,
    loading,
    roleLoading,
  } = useAuth();

  // Wait until authentication and role detection are complete.
  if (loading || (isLoggedIn && roleLoading)) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Logged-out visitors */}
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>

      {/* Regular members */}
      <Stack.Protected guard={isLoggedIn && isMember}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="details/[id]" />
        <Stack.Screen name="payment/[id]" />
        <Stack.Screen name="receipt/[id]" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="change-password" />
      </Stack.Protected>

      {/* Staff */}
      <Stack.Protected guard={isLoggedIn && isStaff}>
        <Stack.Screen name="staff" />
      </Stack.Protected>

      {/* Admins */}
      <Stack.Protected guard={isLoggedIn && isAdmin}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PlansProvider>
        <GymInfoProvider>
          <SubscriptionProvider>
            <RootNavigator />
          </SubscriptionProvider>
        </GymInfoProvider>
      </PlansProvider>
    </AuthProvider>
  );
}
