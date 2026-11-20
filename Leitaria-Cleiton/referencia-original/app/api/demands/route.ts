import { NextRequest, NextResponse } from 'next/server';

import { createDemandWithRoute } from '@/db/repository';
import type { DemandInput, RouteProposal } from '@/lib/domain';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      demand: DemandInput;
      proposal: RouteProposal;
      driverId: string;
      vehicleId: string;
    };
    if (!body.driverId || !body.vehicleId || !body.demand || !body.proposal) {
      return NextResponse.json({ message: 'Escolha uma rota, um motorista e um veículo.' }, { status: 400 });
    }
    const result = await createDemandWithRoute(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível aprovar a rota.' },
      { status: 500 },
    );
  }
}
