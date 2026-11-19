import { useLocalSearchParams } from 'expo-router';
import ReceiptScreen from '../../components/ReceiptScreen';

export default function Receipt() {
  const { id } = useLocalSearchParams();
  return <ReceiptScreen id={id} />;
}
