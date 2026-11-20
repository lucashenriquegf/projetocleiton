import { NextRequest, NextResponse } from 'next/server';

import { FleetError, getDriver, updateDriver } from '@/db/fleet-repository';
import type { DriverInput } from '@/lib/domain';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const driver = await getDriver((await context.params).id);
    return driver ? NextResponse.json(driver) : NextResponse.json({ message: 'Motorista não encontrado.' }, { status: 404 });
  } catch (error) { return handleError(error); }
}
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await updateDriver((await context.params).id, (await request.json()) as DriverInput)); }
  catch (error) { return handleError(error); }
}
function handleError(error: unknown) {
  return NextResponse.json({ message: error instanceof Error ? error.message : 'Não foi possível atualizar o motorista.' }, { status: error instanceof FleetError ? error.status : 500 });
}
