import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { PlansProvider } from '../context/PlansContext';
import { SubscriptionProvider } from '../context/SubscriptionContext';

function RootNavigator() {
  const { isLoggedIn, loading } = useAuth();

  // Wait until the saved login is restored, so the Login screen does not flash.
  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>

      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="details/[id]" />
        <Stack.Screen name="payment/[id]" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PlansProvider>
        <SubscriptionProvider>
          <RootNavigator />
        </SubscriptionProvider>
      </PlansProvider>
    </AuthProvider>
  );
}
