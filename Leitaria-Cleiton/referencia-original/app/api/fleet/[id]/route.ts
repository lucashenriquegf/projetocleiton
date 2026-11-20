import { NextResponse } from 'next/server';

import { FleetError, getFleetAssignment, unassignFleet } from '@/db/fleet-repository';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const assignment = await getFleetAssignment((await context.params).id);
    return assignment
      ? NextResponse.json(assignment)
      : NextResponse.json({ message: 'Vínculo não encontrado.' }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível carregar o vínculo.' },
      { status: error instanceof FleetError ? error.status : 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(await unassignFleet((await context.params).id));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível encerrar o vínculo.' },
      { status: error instanceof FleetError ? error.status : 500 },
    );
  }
}
