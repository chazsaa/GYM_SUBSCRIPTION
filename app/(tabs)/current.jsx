import InfoScreen from '../../components/InfoScreen';
import { useRouter } from 'expo-router';

export default function Current() {
  const router = useRouter();
  return (
    <InfoScreen
      title="Current Subscription"
      icon="card-account-details-outline"
      heading="No active membership yet"
      text="This app does not process payments or store memberships, so there is no current plan to show. Pick a plan on the Home tab to see what is included."
      buttonLabel="BROWSE PLANS"
      onPress={() => router.navigate('/')}
    />
  );
}
