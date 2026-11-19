import { Stack } from 'expo-router';
import AdminShell from '../../components/admin/AdminShell';
import { ADMIN } from '../../theme/adminTheme';

// The Admin Console. Only reachable by admin accounts (see app/_layout.jsx).
// Every screen in this folder is shown inside the sidebar / menu of AdminShell.
export default function AdminLayout() {
  return (
    <AdminShell>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: ADMIN.bg },
        }}
      />
    </AdminShell>
  );
}
