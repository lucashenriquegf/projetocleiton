import { redirect } from 'next/navigation';

import { DemandDetailView } from '@/components/demands/demand-detail-view';
import { ManagerShell } from '@/components/layout/manager-shell';
import { demandRecords } from '@/lib/mocks/demands';

export default async function DemandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demand = demandRecords.find((item) => item.id === id);
  if (!demand) redirect('/demandas');

  return (
    <ManagerShell>
      <DemandDetailView demand={demand} />
    </ManagerShell>
  );
}
