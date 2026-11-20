import { NextResponse } from 'next/server';

import { listReferenceLocations } from '@/db/fleet-repository';

export async function GET() {
  try {
    return NextResponse.json({ items: await listReferenceLocations() });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível carregar as bases.' },
      { status: 500 },
    );
  }
}
