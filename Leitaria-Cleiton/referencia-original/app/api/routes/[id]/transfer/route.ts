import { NextRequest, NextResponse } from 'next/server';

import { FleetError, transferRouteResponsibility } from '@/db/fleet-repository';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { vehicleId: string; driverId: string; notes?: string };
    if (!body.vehicleId || !body.driverId) {
      return NextResponse.json({ message: 'Escolha o novo veículo e o novo motorista.' }, { status: 400 });
    }
    return NextResponse.json(await transferRouteResponsibility({ routeId: id, ...body }));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível transferir a rota.' },
      { status: error instanceof FleetError ? error.status : 500 },
    );
  }
}
