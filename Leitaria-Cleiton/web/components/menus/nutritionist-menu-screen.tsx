import { PersonaShell } from '@/components/layout/persona-shell';
import { MenuEditor } from '@/components/menus/menu-editor';

export function NutritionistMenuScreen({ schoolName }: { schoolName: string }) {
  return (
    <PersonaShell persona="nutritionist" contentClassName="max-w-6xl">
      <header className="border-b pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          {schoolName}
        </p>
        <h1 className="mt-2 text-[1.8rem] font-semibold tracking-[-0.04em]">
          Cardápio de setembro
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Selecione uma data para editar o cardápio ou cadastrar uma alternativa
          para um produto.
        </p>
      </header>
      <div className="mt-5">
        <MenuEditor actor="nutritionist" schoolName={schoolName} />
      </div>
    </PersonaShell>
  );
}
