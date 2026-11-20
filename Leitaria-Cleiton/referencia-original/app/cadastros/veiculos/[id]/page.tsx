import { VehicleFormScreen } from '@/components/fleet/vehicle-form-screen';

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  return <VehicleFormScreen vehicleId={(await params).id} />;
}
