import { NextRequest, NextResponse } from 'next/server';

import { createVehicle, FleetError, listVehicles } from '@/db/fleet-repository';
import type { VehicleInput } from '@/lib/domain';

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;
    return NextResponse.json(await listVehicles({
      query: search.get('busca') ?? undefined,
      category: search.get('categoria') ?? undefined,
      traction: search.get('tracao') ?? undefined,
      status: search.get('situacao') ?? undefined,
      base: search.get('base') ?? undefined,
      page: Number(search.get('pagina')) || 1,
      pageSize: Number(search.get('porPagina')) || 10,
    }));
  } catch (error) {
    return handleError(error, 'Não foi possível carregar os veículos.');
  }
}

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(await createVehicle((await request.json()) as VehicleInput), { status: 201 });
  } catch (error) {
    return handleError(error, 'Não foi possível cadastrar o veículo.');
  }
}

function handleError(error: unknown, fallback: string) {
  return NextResponse.json(
    { message: error instanceof Error ? error.message : fallback },
    { status: error instanceof FleetError ? error.status : 500 },
  );
}
