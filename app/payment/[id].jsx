import { useLocalSearchParams } from 'expo-router';
import PaymentScreen from '../../components/PaymentScreen';
import { getPlanById } from '../../data/subscriptionPlans';

// /payment/2 -> pay for plan 2. Same idea as /details/[id].
export default function Payment() {
  const { id } = useLocalSearchParams();
  return <PaymentScreen plan={getPlanById(id)} id={id} />;
}
