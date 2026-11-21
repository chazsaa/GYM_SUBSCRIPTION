import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import PaymentScreen from '../../components/PaymentScreen';
import { usePlans } from '../../context/PlansContext';

// /payment/2                -> subscribe to plan 2
// /payment/2?mode=renew     -> renew (plan 2 is the plan being renewed)
// /payment/5?mode=change    -> switch the current membership to plan 5
export default function Payment() {
  const { id, mode } = useLocalSearchParams();
  const { getPlanById, refreshPlans } = usePlans();

  // Make sure the price on the payment screen is the current one.
  useEffect(() => {
    refreshPlans();
  }, [refreshPlans]);

  return <PaymentScreen plan={getPlanById(id)} id={id} mode={mode} />;
}
