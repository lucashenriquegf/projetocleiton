import { redirect } from 'next/navigation';

export default function NewBlockedRoadPage() {
  redirect('/cadastros/vias-bloqueadas/nova');
}
