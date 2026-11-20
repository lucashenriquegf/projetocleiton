import { NextResponse } from 'next/server';

import { getRouteTracking } from '@/db/repository';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const result = await getRouteTracking(id);
    return result
      ? NextResponse.json(result)
      : NextResponse.json({ message: 'Rota não encontrada.' }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível consultar a rota.' },
      { status: 500 },
    );
  }
}
