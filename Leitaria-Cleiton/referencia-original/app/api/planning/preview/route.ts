import { NextRequest, NextResponse } from 'next/server';

import { previewDemand } from '@/db/repository';
import type { DemandInput } from '@/lib/domain';

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as DemandInput;
    const error = validateDemand(input);
    if (error) return NextResponse.json({ message: error }, { status: 400 });
    return NextResponse.json({ proposals: await previewDemand(input) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível calcular as rotas.' },
      { status: 500 },
    );
  }
}

function validateDemand(input: DemandInput) {
  if (!input?.destinationId) return 'Escolha o local de entrega.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deliveryDate)) return 'Informe uma data válida.';
  if (!/^\d{2}:\d{2}$/.test(input.deadline)) return 'Informe o horário limite.';
  if (!Array.isArray(input.items) || !input.items.some((item) => item.quantity > 0)) {
    return 'Informe ao menos um produto com quantidade maior que zero.';
  }
  if (input.items.some((item) => !item.productId || !Number.isFinite(item.quantity) || item.quantity < 0)) {
    return 'Revise as quantidades informadas.';
  }
  return null;
}
