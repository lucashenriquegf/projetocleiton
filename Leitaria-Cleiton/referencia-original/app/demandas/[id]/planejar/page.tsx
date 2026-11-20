import { redirect } from 'next/navigation';

import { PlanningFlow } from '@/components/demands/planning-flow';
import { ManagerShell } from '@/components/layout/manager-shell';
import { demandRecords } from '@/lib/mocks/demands';

export default async function DemandPlanningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demand = demandRecords.find((item) => item.id === id);
  if (!demand) redirect('/demandas');

  return (
    <ManagerShell>
      <PlanningFlow demand={demand} />
    </ManagerShell>
  );
}
