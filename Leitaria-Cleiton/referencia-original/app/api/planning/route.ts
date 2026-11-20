import { NextResponse } from 'next/server';

import { getPlanningData } from '@/db/repository';

export async function GET() {
  try {
    return NextResponse.json(await getPlanningData());
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível carregar os dados.' },
      { status: 500 },
    );
  }
}
