import { TrackingView } from '@/components/routes/tracking-view';
import { logisticsRoutes } from '@/lib/mocks/operations';

export default function WestTrackingPage() {
  return <TrackingView route={logisticsRoutes.find((route) => route.id === 'rota-oeste')!} />;
}
