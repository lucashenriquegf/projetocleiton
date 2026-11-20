import { ManagerOperationsHub } from '@/components/dashboard/manager-operations-hub';
import { ManagerShell } from '@/components/layout/manager-shell';
import { dashboardAlerts } from '@/lib/mocks/dashboard';
import { logisticsRoutes } from '@/lib/mocks/operations';

export default async function ManagerHomePage({
  searchParams,
}: {
  searchParams: Promise<{ rota?: string }>;
}) {
  const { rota } = await searchParams;
  return (
    <ManagerShell>
      <ManagerOperationsHub
        routes={logisticsRoutes}
        alerts={dashboardAlerts}
        initialRouteId={rota}
      />
    </ManagerShell>
  );
}
