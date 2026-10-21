import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';

// The router shows different screens depending on the login state.
// Stack.Protected hides screens when "guard" is false. If someone tries to open
// a hidden screen (for example /details/2 while logged out), Expo Router
// sends them to a screen that is available instead.
function RootNavigator() {
  const { isLoggedIn } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Only for logged-out users */}
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>

      {/* Only for logged-in users */}
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="details/[id]" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
