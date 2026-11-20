import { RoadFormScreen } from '@/components/fleet/road-form-screen';

export default async function BlockedRoadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RoadFormScreen roadId={id} />;
}
