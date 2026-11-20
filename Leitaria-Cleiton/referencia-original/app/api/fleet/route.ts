import { NextRequest, NextResponse } from 'next/server';

import { assignFleet, FleetError, listFleet } from '@/db/fleet-repository';

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;
    return NextResponse.json(await listFleet({
      view: search.get('visao') === 'historico' ? 'history' : 'current',
      query: search.get('busca') ?? undefined,
      status: search.get('situacao') ?? undefined,
      driver: search.get('motorista') ?? undefined,
      driverId: search.get('motoristaId') ?? undefined,
      vehicle: search.get('veiculo') ?? undefined,
      vehicleId: search.get('veiculoId') ?? undefined,
      base: search.get('base') ?? undefined,
      from: search.get('inicio') ?? undefined,
      to: search.get('fim') ?? undefined,
      page: Number(search.get('pagina')) || 1,
      pageSize: Number(search.get('porPagina')) || 10,
    }));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { vehicleId: string; driverId: string; notes?: string };
    if (!body.vehicleId || !body.driverId) {
      return NextResponse.json({ message: 'Escolha um veículo e um motorista.' }, { status: 400 });
    }
    return NextResponse.json(await assignFleet(body), { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  return NextResponse.json(
    { message: error instanceof Error ? error.message : 'Não foi possível atualizar a frota.' },
    { status: error instanceof FleetError ? error.status : 500 },
  );
}
