import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { PlansProvider } from '../context/PlansContext';
import { GymInfoProvider } from '../context/GymInfoContext';
import { SubscriptionProvider } from '../context/SubscriptionContext';

function RootNavigator() {
  const { isLoggedIn, isAdmin, loading, roleLoading } = useAuth();

  // Wait until the saved login is restored and we know the account's role, so
  // neither the Login screen nor the wrong dashboard flashes on screen.
  if (loading || (isLoggedIn && roleLoading)) return null;

  const isMember = isLoggedIn && !isAdmin;

  // Three kinds of visitor, three separate sets of screens:
  //   logged out -> login screens
  //   member     -> the Member app (tabs, plans, payment, receipts, profile)
  //   admin      -> the Admin Console (app/admin/*)
  // A screen outside the visitor's set cannot be opened, even by typing its web
  // address: the app sends them to their own home instead.
  // (The database enforces the same rule, so this is not the only protection.)
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>

      <Stack.Protected guard={isMember}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="details/[id]" />
        <Stack.Screen name="payment/[id]" />
        <Stack.Screen name="receipt/[id]" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="change-password" />
      </Stack.Protected>

      <Stack.Protected guard={isAdmin}>
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
