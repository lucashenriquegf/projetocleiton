import { NextRequest, NextResponse } from 'next/server';

import { findSimilarProducts, ProductError } from '@/db/product-repository';

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;
    return NextResponse.json({
      items: await findSimilarProducts(search.get('nome') ?? '', search.get('excludeId') ?? undefined),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Não foi possível verificar produtos semelhantes.' },
      { status: error instanceof ProductError ? error.status : 500 },
    );
  }
}
