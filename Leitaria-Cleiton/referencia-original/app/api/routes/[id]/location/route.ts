import { NextRequest, NextResponse } from 'next/server';

import { recordRouteLocation } from '@/db/repository';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      latitude: number;
      longitude: number;
      accuracyMeters?: number;
    };
    if (!Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) {
      return NextResponse.json({ message: 'Localização inválida.' }, { status: 400 });
    }
    return NextResponse.json(await recordRouteLocation({ routeId: id, ...body }));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível registrar a localização.' },
      { status: 500 },
    );
  }
}
