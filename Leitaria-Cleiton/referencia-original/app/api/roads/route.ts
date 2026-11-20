import { NextRequest, NextResponse } from 'next/server';

import { FleetError, listRoadRestrictions, saveRoadRestriction } from '@/db/fleet-repository';
import type { RoadRestrictionInput } from '@/lib/domain';

export async function GET(request: NextRequest) {
  try { return NextResponse.json({ items: await listRoadRestrictions(request.nextUrl.searchParams.get('busca') ?? '') }); }
  catch (error) { return handleError(error); }
}
export async function POST(request: NextRequest) {
  try { return NextResponse.json(await saveRoadRestriction(null, (await request.json()) as RoadRestrictionInput), { status: 201 }); }
  catch (error) { return handleError(error); }
}
function handleError(error: unknown) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Não foi possível salvar a via.' }, { status: error instanceof FleetError ? error.status : 500 }); }
