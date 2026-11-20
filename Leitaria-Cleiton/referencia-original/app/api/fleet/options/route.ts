import { NextRequest, NextResponse } from 'next/server';

import { FleetError, listFleetOptions } from '@/db/fleet-repository';

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;
    const type = search.get('tipo') === 'motoristas' ? 'drivers' : 'vehicles';
    return NextResponse.json(await listFleetOptions({
      type,
      query: search.get('busca') ?? undefined,
      plate: search.get('placa') ?? undefined,
      model: search.get('modelo') ?? undefined,
      driver: search.get('motorista') ?? undefined,
      name: search.get('nome') ?? undefined,
      phone: search.get('telefone') ?? undefined,
      vehiclePlate: search.get('placaVeiculo') ?? undefined,
      status: search.get('situacao') ?? undefined,
      category: search.get('categoria') ?? undefined,
      base: search.get('base') ?? undefined,
      page: Number(search.get('pagina')) || 1,
      pageSize: Number(search.get('porPagina')) || 10,
    }));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível carregar as opções.' },
      { status: error instanceof FleetError ? error.status : 500 },
    );
  }
}
