import { NextRequest, NextResponse } from 'next/server';

import { FleetError, getVehicle, setVehicleArchived, updateVehicle } from '@/db/fleet-repository';
import type { VehicleInput } from '@/lib/domain';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const vehicle = await getVehicle((await context.params).id);
    return vehicle
      ? NextResponse.json(vehicle)
      : NextResponse.json({ message: 'Veículo não encontrado.' }, { status: 404 });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as VehicleInput | { archived: boolean };
    if ('archived' in body) return NextResponse.json(await setVehicleArchived(id, body.archived));
    return NextResponse.json(await updateVehicle(id, body));
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  return NextResponse.json(
    { message: error instanceof Error ? error.message : 'Não foi possível atualizar o veículo.' },
    { status: error instanceof FleetError ? error.status : 500 },
  );
}
