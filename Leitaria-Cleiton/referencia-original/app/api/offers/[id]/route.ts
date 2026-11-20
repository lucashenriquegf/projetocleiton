import { NextRequest, NextResponse } from 'next/server';

import { updateProducerOffer } from '@/db/repository';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status: string; quantity?: number };
    if (!['CONFIRMADA', 'ALTERADA', 'CANCELADA'].includes(body.status)) {
      return NextResponse.json({ message: 'Ação inválida.' }, { status: 400 });
    }
    const result = await updateProducerOffer({
      id,
      status: body.status as 'CONFIRMADA' | 'ALTERADA' | 'CANCELADA',
      quantity: body.quantity,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível atualizar a oferta.' },
      { status: 500 },
    );
  }
}
