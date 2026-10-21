import InfoScreen from '../../components/InfoScreen';
import { useRouter } from 'expo-router';

export default function History() {
  const router = useRouter();
  return (
    <InfoScreen
      title="Payment History"
      icon="receipt-text-outline"
      heading="No payments recorded"
      text="Subscribe Now is a demo and never creates a payment, so your history is empty. Payment records would appear here once a real payment system is connected."
      buttonLabel="BROWSE PLANS"
      onPress={() => router.navigate('/')}
    />
  );
}
