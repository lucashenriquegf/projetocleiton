import { DriverFormScreen } from '@/components/fleet/driver-form-screen';

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DriverFormScreen driverId={id} />;
}
