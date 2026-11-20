import { PersonaShell } from '@/components/layout/persona-shell';
import { MenuEditor } from '@/components/menus/menu-editor';

export default function NewNutritionistMenuPage() {
  return (
    <PersonaShell persona="nutritionist" contentClassName="max-w-6xl">
      <header className="border-b pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Escola João Paulo II
        </p>
        <h1 className="mt-2 text-[1.8rem] font-semibold tracking-[-0.04em]">
          Novo cardápio mensal
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha cada dia, selecione os produtos do catálogo e informe as
          quantidades e alternativas possíveis.
        </p>
      </header>
      <div className="mt-5">
        <MenuEditor actor="nutritionist" newMenu />
      </div>
    </PersonaShell>
  );
}
