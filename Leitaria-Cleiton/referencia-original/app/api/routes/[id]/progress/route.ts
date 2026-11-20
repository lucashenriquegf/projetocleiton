import { NextRequest, NextResponse } from 'next/server';

import { updateRouteProgress } from '@/db/repository';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { stopId: string; status: string };
    if (!body.stopId || !['EM_CURSO', 'CONCLUIDA'].includes(body.status)) {
      return NextResponse.json({ message: 'Atualização inválida.' }, { status: 400 });
    }
    return NextResponse.json(
      await updateRouteProgress({
        routeId: id,
        stopId: body.stopId,
        status: body.status as 'EM_CURSO' | 'CONCLUIDA',
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível atualizar a parada.' },
      { status: 500 },
    );
  }
}
