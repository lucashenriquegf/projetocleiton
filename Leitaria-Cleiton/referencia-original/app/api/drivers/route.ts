import { NextRequest, NextResponse } from 'next/server';

import { createDriver, FleetError, listDrivers } from '@/db/fleet-repository';
import type { DriverInput } from '@/lib/domain';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ items: await listDrivers({ query: request.nextUrl.searchParams.get('busca') ?? undefined, status: request.nextUrl.searchParams.get('status') ?? undefined }) });
  } catch (error) { return handleError(error); }
}

export async function POST(request: NextRequest) {
  try { return NextResponse.json(await createDriver((await request.json()) as DriverInput), { status: 201 }); }
  catch (error) { return handleError(error); }
}

function handleError(error: unknown) {
  return NextResponse.json({ message: error instanceof Error ? error.message : 'Não foi possível salvar o motorista.' }, { status: error instanceof FleetError ? error.status : 500 });
}
