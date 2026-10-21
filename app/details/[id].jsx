import { useLocalSearchParams } from 'expo-router';
import PlanDetailsScreen from '../../components/PlanDetailsScreen';
import { getPlanById } from '../../data/subscriptionPlans';

// The file name [id].jsx means "id" changes in the URL.
// /details/1 -> id is "1", /details/2 -> id is "2", and so on.
export default function Details() {
  const { id } = useLocalSearchParams();
  const plan = getPlanById(id);

  return <PlanDetailsScreen plan={plan} id={id} />;
}
