import { NextRequest, NextResponse } from 'next/server';

import { FleetError, getRoadRestriction, saveRoadRestriction } from '@/db/fleet-repository';
import type { RoadRestrictionInput } from '@/lib/domain';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { const item = await getRoadRestriction((await context.params).id); return item ? NextResponse.json(item) : NextResponse.json({ message: 'Via não encontrada.' }, { status: 404 }); }
  catch (error) { return handleError(error); }
}
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await saveRoadRestriction((await context.params).id, (await request.json()) as RoadRestrictionInput)); }
  catch (error) { return handleError(error); }
}
function handleError(error: unknown) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Não foi possível atualizar a via.' }, { status: error instanceof FleetError ? error.status : 500 }); }
