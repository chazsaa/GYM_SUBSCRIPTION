import { useLocalSearchParams } from 'expo-router';
import PlanDetailsScreen from '../../components/PlanDetailsScreen';
import { usePlans } from '../../context/PlansContext';

export default function Details() {
  const { id } = useLocalSearchParams();
  const { getPlanById } = usePlans();

  return <PlanDetailsScreen plan={getPlanById(id)} id={id} />;
}
