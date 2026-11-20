import { FleetAssignmentScreen } from '@/components/fleet/fleet-assignment-screen';

export default async function FleetAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  return <FleetAssignmentScreen assignmentId={(await params).id} />;
}
