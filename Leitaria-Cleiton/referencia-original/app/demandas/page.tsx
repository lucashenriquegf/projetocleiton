import { DemandsWorkspace } from '@/components/demands/demands-workspace';
import { ManagerShell } from '@/components/layout/manager-shell';
import { demandRecords } from '@/lib/mocks/demands';

export default async function DemandsPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string }>;
}) {
  const { visao } = await searchParams;

  return (
    <ManagerShell>
      <DemandsWorkspace
        demands={demandRecords}
        initialView={visao === 'historico' ? 'historico' : 'atuais'}
      />
    </ManagerShell>
  );
}
