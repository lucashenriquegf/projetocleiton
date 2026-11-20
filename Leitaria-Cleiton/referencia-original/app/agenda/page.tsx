import { redirect } from 'next/navigation';

export default function AgendaPage() {
  redirect('/demandas?visao=historico');
}
