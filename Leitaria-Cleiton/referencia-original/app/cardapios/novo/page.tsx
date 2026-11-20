import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { MenuEditor } from '@/components/menus/menu-editor';

export default function NewSchoolMenuPage() {
  return (
    <ManagerShell>
      <PageFrame
        wide
        backHref="/cardapios"
        eyebrow="Planejamento das escolas"
        title="Novo cardápio"
        description="Escolha uma data, selecione os produtos do catálogo e informe as quantidades e alternativas possíveis."
      >
        <MenuEditor actor="manager" newMenu />
      </PageFrame>
    </ManagerShell>
  );
}
