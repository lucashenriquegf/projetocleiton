import { TrackingView } from '@/components/routes/tracking-view';
import { logisticsRoutes } from '@/lib/mocks/operations';

export default function TrackingPage() {
  return <TrackingView route={logisticsRoutes[0]} />;
}
