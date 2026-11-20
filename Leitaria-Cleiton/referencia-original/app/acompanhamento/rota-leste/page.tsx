import { TrackingView } from '@/components/routes/tracking-view';
import { logisticsRoutes } from '@/lib/mocks/operations';

export default function EastTrackingPage() {
  return <TrackingView route={logisticsRoutes.find((route) => route.id === 'rota-leste')!} />;
}
