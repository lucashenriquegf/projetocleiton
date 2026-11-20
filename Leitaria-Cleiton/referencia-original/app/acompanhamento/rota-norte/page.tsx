import { TrackingView } from '@/components/routes/tracking-view';
import { logisticsRoutes } from '@/lib/mocks/operations';

export default function NorthTrackingPage() {
  return <TrackingView route={logisticsRoutes.find((route) => route.id === 'rota-norte')!} />;
}
