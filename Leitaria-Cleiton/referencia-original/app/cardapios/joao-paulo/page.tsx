import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { MenuEditor } from '@/components/menus/menu-editor';

export default function SchoolMenuPage() {
  return (
    <ManagerShell>
      <PageFrame
        wide
        backHref="/cardapios"
        eyebrow="Escola Municipal João Paulo II"
        title="Cardápio de setembro"
        description="Selecione uma data para conferir os produtos ativos e decidir substituições pontuais."
      >
        <MenuEditor actor="manager" />
      </PageFrame>
    </ManagerShell>
  );
}
