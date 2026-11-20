import { DriverNavigationMap } from '@/components/driver/driver-navigation-map';
import { PersonaShell } from '@/components/layout/persona-shell';

export default function DriverMapPage() {
  return (
    <PersonaShell persona="driver" contentClassName="max-w-none p-0 sm:p-0">
      <DriverNavigationMap />
    </PersonaShell>
  );
}
