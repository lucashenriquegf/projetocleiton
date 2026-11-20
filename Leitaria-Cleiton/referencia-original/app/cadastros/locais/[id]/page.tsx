import { RegistryDetailScreen } from '@/components/registries/registry-detail-screen';

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RegistryDetailScreen category="locais" id={id} />;
}
